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
    ListRecommendationsResponse,
    PetRecommendations,
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

    private async inputForPet(
        petId: number,
        limit: number,
    ): Promise<{
        pet: Pet;
        catalog: CatalogItem[];
        input: RecommendationRequest;
    }> {
        if (!Number.isSafeInteger(petId) || petId <= 0 || petId > 2147483647) {
            throw new BadRequestException('petId must be a positive integer');
        }
        if (!Number.isSafeInteger(limit) || limit <= 0 || limit > 100) {
            throw new BadRequestException('limit must be between 1 and 100');
        }
        const pet = await this.petProfileService.getPetById(petId);
        if (!pet) {
            throw new NotFoundException(`Pet ${petId} was not found`);
        }
        const catalog = this.catalogService.getCatalogItems();
        return {
            pet,
            catalog,
            input: {
                pet: {
                    species: pet.species,
                    needs: pet.needs,
                    maxPrice: pet.maxPrice,
                },
                services: catalog.map(({ id, species, tags, price }) => ({
                    id,
                    species,
                    tags,
                    price,
                })),
                limit,
            },
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
            })),
        };
    }

    async recommendForPet(petId: number): Promise<PetRecommendations> {
        const { pet, catalog, input } = await this.inputForPet(petId, 5);
        const response = await this.call(this.engine.recommend(input));
        const byId = new Map(catalog.map((item) => [item.id, item]));
        // proto3 omits empty repeated fields, so `matches` is undefined when nothing matched.
        return {
            pet,
            recommendations: (response.matches ?? []).flatMap((match) => {
                const service = byId.get(match.serviceId);
                return service
                    ? [
                          {
                              service,
                              score: match.score,
                              matchedNeeds: match.matchedNeeds ?? [],
                          },
                      ]
                    : [];
            }),
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
