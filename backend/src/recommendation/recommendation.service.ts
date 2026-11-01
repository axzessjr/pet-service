import {
    BadRequestException,
    Inject,
    Injectable,
    Logger,
    NotFoundException,
    OnModuleInit,
    ServiceUnavailableException,
} from '@nestjs/common';
import { status } from '@grpc/grpc-js';
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
    ListRecommendationsResponse,
    MapRecommendation,
    MapRecommendations,
    PetRecommendations,
    Recommendation,
    RecommendationRequest,
    RecommendationResponse,
    SavedRecommendation,
} from './recommendation.types';

interface RecommendationEngine {
    recommend(
        request: RecommendationRequest,
    ): Observable<RecommendationResponse>;
    createRecommendation(request: {
        petId: number;
        input: RecommendationRequest;
    }): Observable<SavedRecommendation>;
    getRecommendation(request: { id: string }): Observable<SavedRecommendation>;
    listRecommendations(request: {
        petId: number;
    }): Observable<ListRecommendationsResponse>;
    updateRecommendation(request: {
        id: string;
        petId: number;
        input: RecommendationRequest;
    }): Observable<SavedRecommendation>;
    deleteRecommendation(request: {
        id: string;
    }): Observable<{ deleted: boolean }>;
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

    private static toInput(
        pet: Pet,
        services: CatalogItem[],
        limit: number,
        overrides: { needs?: string[]; maxPrice?: number } = {},
    ): RecommendationRequest {
        return {
            pet: {
                species: pet.species,
                needs: overrides.needs ?? pet.needs,
                maxPrice: overrides.maxPrice ?? pet.maxPrice,
            },
            services: services.map(({ id, species, tags, price }) => ({
                id,
                species,
                tags,
                price,
            })),
            limit,
        };
    }

    // proto3 omits empty repeated fields and zero values, so `matches` is
    // undefined when nothing matched and ratings are missing when unreviewed.
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

    private async inputForPet(
        petId: number,
        limit: number,
    ): Promise<{
        pet: Pet;
        catalog: CatalogItem[];
        input: RecommendationRequest;
    }> {
        if (!Number.isSafeInteger(limit) || limit <= 0 || limit > 100) {
            throw new BadRequestException('limit must be between 1 and 100');
        }
        const pet = await this.loadPet(petId);
        const catalog = await this.catalogService.getCatalogItems();
        return {
            pet,
            catalog,
            input: RecommendationService.toInput(pet, catalog, limit),
        };
    }

    private async call<T>(response: Observable<T>): Promise<T> {
        try {
            return await firstValueFrom(response.pipe(timeout(3000)));
        } catch (error: unknown) {
            const code =
                typeof error === 'object' &&
                error !== null &&
                'code' in error &&
                typeof error.code === 'number'
                    ? error.code
                    : undefined;
            if (code === status.NOT_FOUND) {
                throw new NotFoundException('Recommendation was not found');
            }
            if (code === status.INVALID_ARGUMENT) {
                throw new BadRequestException('Invalid recommendation request');
            }
            this.logger.warn(
                `Recommendation engine unavailable: ${String(error)}`,
            );
            throw new ServiceUnavailableException(
                'Recommendations are temporarily unavailable',
            );
        }
    }

    private normalizeSaved(record: SavedRecommendation): SavedRecommendation {
        return {
            ...record,
            matches: (record.matches ?? []).map((match) => ({
                ...match,
                matchedNeeds: match.matchedNeeds ?? [],
                averageRating: match.averageRating ?? 0,
                reviewCount: match.reviewCount ?? 0,
            })),
        };
    }

    async recommendForPet(
        petId: number,
        limit = 5,
    ): Promise<PetRecommendations> {
        const { pet, catalog, input } = await this.inputForPet(petId, limit);
        const response = await this.call(this.engine.recommend(input));
        return {
            pet,
            recommendations: RecommendationService.join(response, catalog),
        };
    }

    // Ranks only the services inside the visible map area that pass the
    // search filters, then keeps all of them or just the best few depending
    // on the zoom (see MAP_LIMITS).
    async recommendForMap(
        petId: number,
        query: MapQuery,
    ): Promise<MapRecommendations> {
        const pet = await this.loadPet(petId);
        const maxPrice = effectiveMaxPrice(pet.maxPrice, query.maxPrice);
        const items = await this.catalogService.getCatalogItems();
        const candidates = filterForMap(items, query, maxPrice);

        let ranked: MapRecommendation[] = [];
        if (candidates.length > 0) {
            const rank = (needs?: string[]) =>
                this.call(
                    this.engine.recommend(
                        RecommendationService.toInput(
                            pet,
                            candidates,
                            candidates.length,
                            { needs, maxPrice },
                        ),
                    ),
                );
            // With no needs the engine returns every eligible service (right
            // species and price) ordered by rating, each with its rating. That
            // fills in the services the needs-based ranking leaves out.
            const wantOthers = query.includeUnmatched && pet.needs.length > 0;
            const [matched, others] = await Promise.all([
                rank(),
                wantOthers ? rank([]) : Promise.resolve({ matches: [] }),
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

    async createSaved(petId: number, limit = 5): Promise<SavedRecommendation> {
        const { input } = await this.inputForPet(petId, limit);
        return this.normalizeSaved(
            await this.call(this.engine.createRecommendation({ petId, input })),
        );
    }

    async getSaved(id: string): Promise<SavedRecommendation> {
        return this.normalizeSaved(
            await this.call(this.engine.getRecommendation({ id })),
        );
    }

    async listSaved(petId: number): Promise<SavedRecommendation[]> {
        if (!Number.isSafeInteger(petId) || petId <= 0 || petId > 2147483647) {
            throw new BadRequestException('petId must be a positive integer');
        }
        const result = await this.call(
            this.engine.listRecommendations({ petId }),
        );
        return (result.recommendations ?? []).map((record) =>
            this.normalizeSaved(record),
        );
    }

    async updateSaved(id: string, limit: number): Promise<SavedRecommendation> {
        const existing = await this.getSaved(id);
        const { input } = await this.inputForPet(existing.petId, limit);
        return this.normalizeSaved(
            await this.call(
                this.engine.updateRecommendation({
                    id,
                    petId: existing.petId,
                    input,
                }),
            ),
        );
    }

    async deleteSaved(id: string): Promise<void> {
        await this.call(this.engine.deleteRecommendation({ id }));
    }
}
