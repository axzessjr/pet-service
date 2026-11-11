import {
    BadRequestException,
    Inject,
    Injectable,
    Logger,
    NotFoundException,
    OnModuleInit,
    ServiceUnavailableException,
} from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom, Observable, timeout } from 'rxjs';
import { CatalogService } from '../catalog/catalog.service';
import { CatalogItem } from '../catalog/catalog.types';
import { PetProfileService } from '../pet-profile/pet-profile.service';
import { Pet } from '../pet-profile/pet-profile.types';
import {
    cutForZoom,
    effectiveMaxPrice,
    filterForMap,
    MAP_LIMITS,
    MapQuery,
    overBudget,
} from './map';
import {
    MapRecommendation,
    MapRecommendations,
    Recommendation,
    RecommendationRequest,
    RecommendationResponse,
} from './recommendation.types';

interface RecommendationEngine {
    recommend(
        request: RecommendationRequest,
    ): Observable<RecommendationResponse>;
}

@Injectable()
export class RecommendationService implements OnModuleInit {
    private readonly logger = new Logger(RecommendationService.name);
    private engine!: RecommendationEngine;

    constructor(
        @Inject('RECOMMENDATION_ENGINE') private readonly client: ClientGrpc,
        private readonly catalogService: CatalogService,
        private readonly petProfileService: PetProfileService,
    ) {}

    onModuleInit(): void {
        this.engine = this.client.getService<RecommendationEngine>(
            'RecommendationEngine',
        );
    }

    private async loadPet(petId: number): Promise<Pet> {
        if (!Number.isSafeInteger(petId) || petId <= 0 || petId > 2147483647) {
            throw new BadRequestException('petId must be a positive integer');
        }
        const pet = await this.petProfileService.getPetById(petId);
        if (!pet) {
            throw new NotFoundException(`Pet ${petId} was not found`);
        }
        return pet;
    }

    private static toRequest(
        pet: Pet,
        services: CatalogItem[],
        needs: string[],
        maxPrice: number,
    ): RecommendationRequest {
        return {
            pet: { species: pet.species, needs, maxPrice },
            services: services.map(({ id, species, tags, price }) => ({
                id,
                species,
                tags,
                price,
            })),
            // Rank every candidate; cutForZoom trims the list afterwards.
            limit: services.length,
        };
    }

    // Keeps the matches for services that were sent, in the engine's order.
    private static join(
        response: RecommendationResponse,
        services: CatalogItem[],
    ): Recommendation[] {
        const byId = new Map(services.map((item) => [item.id, item]));
        return (response.matches ?? []).flatMap((match) => {
            const service = byId.get(match.serviceId);
            return service
                ? [
                      {
                          service,
                          score: match.score ?? 0,
                          matchedNeeds: match.matchedNeeds ?? [],
                          averageRating: match.averageRating ?? 0,
                          reviewCount: match.reviewCount ?? 0,
                      },
                  ]
                : [];
        });
    }

    private async call<T>(response: Observable<T>): Promise<T> {
        try {
            return await firstValueFrom(response.pipe(timeout(3000)));
        } catch (error: unknown) {
            this.logger.warn(
                `Recommendation engine unavailable: ${String(error)}`,
            );
            throw new ServiceUnavailableException(
                'Recommendations are temporarily unavailable',
            );
        }
    }

    // Ranks only the services inside the visible map area that pass the
    // search filters, then keeps all of them or just the best few depending
    // on the zoom (see MAP_LIMITS).
    async recommendForMap(
        petId: number,
        query: MapQuery,
    ): Promise<MapRecommendations> {
        // Independent database reads, so they run at the same time.
        const [pet, items] = await Promise.all([
            this.loadPet(petId),
            this.catalogService.getCatalogItems(),
        ]);
        const maxPrice = effectiveMaxPrice(pet.maxPrice, query.maxPrice);
        const candidates = filterForMap(items, query, maxPrice);

        let ranked: MapRecommendation[] = [];
        if (candidates.length > 0) {
            const rank = (needs: string[]) =>
                this.call(
                    this.engine.recommend(
                        RecommendationService.toRequest(
                            pet,
                            candidates,
                            needs,
                            maxPrice,
                        ),
                    ),
                );
            // With no needs the engine returns every eligible service (right
            // species and price) ordered by rating, each with its rating. That
            // fills in the services the needs-based ranking leaves out.
            const wantOthers = query.includeUnmatched && pet.needs.length > 0;
            const [matched, others] = await Promise.all([
                rank(pet.needs),
                wantOthers
                    ? rank([])
                    : Promise.resolve<RecommendationResponse>({}),
            ]);
            const first = RecommendationService.join(matched, candidates);
            const seen = new Set(first.map((item) => item.service.id));
            ranked = [
                ...first.map((item) => ({ ...item, matched: true })),
                ...RecommendationService.join(others, candidates)
                    .filter((item) => !seen.has(item.service.id))
                    .map((item) => ({
                        ...item,
                        score: 0,
                        matchedNeeds: [],
                        matched: false,
                    })),
            ];
        }

        // Checked before minRating, so a rating filter that empties the list
        // is not blamed on the budget.
        const hidden =
            ranked.length === 0
                ? overBudget(items, query, maxPrice, pet.species)
                : undefined;

        const { minRating } = query;
        if (minRating !== undefined) {
            ranked = ranked.filter((item) => item.averageRating >= minRating);
        }
        const { mode, recommendations } = cutForZoom(
            ranked,
            query.zoom,
            query.limit,
        );
        return {
            pet,
            mode,
            bounds: query.bounds,
            zoom: query.zoom,
            detailZoom: MAP_LIMITS.DETAIL_ZOOM,
            total: ranked.length,
            recommendations,
            ...(hidden && { overBudget: hidden }),
        };
    }
}
