import {
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
import { PetProfileService } from '../pet-profile/pet-profile.service';
import {
    PetRecommendations,
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
    private engine: RecommendationEngine;

    constructor(
        @Inject('RECOMMENDATION_ENGINE') private readonly client: ClientGrpc,
        private readonly catalogService: CatalogService,
        private readonly petProfileService: PetProfileService,
    ) { }

    onModuleInit(): void {
        this.engine = this.client.getService<RecommendationEngine>(
            'RecommendationEngine',
        );
    }

    async recommendForPet(petId: number): Promise<PetRecommendations> {
        const pet = await this.petProfileService.getPetById(petId);

        if (!pet) {
            throw new NotFoundException(`Pet ${petId} was not found`);
        }

        const catalog = this.catalogService.getCatalogItems();
        let response: RecommendationResponse;
        try {
            response = await firstValueFrom(
                this.engine
                    .recommend({
                        pet: {
                            species: pet.species,
                            needs: pet.needs,
                            maxPrice: pet.maxPrice,
                        },
                        services: catalog.map(
                            ({ id, species, tags, price }) => ({
                                id,
                                species,
                                tags,
                                price,
                            }),
                        ),
                        limit: 5,
                    })
                    .pipe(timeout(3000)),
            );
        } catch (error) {
            this.logger.warn(
                `Recommendation engine unavailable: ${String(error)}`,
            );
            throw new ServiceUnavailableException(
                'Recommendations are temporarily unavailable',
            );
        }

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

    /*
    async recommendForPetLegacy(petId: number): Promise<PetRecommendations> {
        const pet = this.petProfileService.getPetById(petId);
        if (!pet) {
            throw new NotFoundException(`Pet ${petId} was not found`);
        }

        const catalog = this.catalogService.getCatalogItems();
        let response: RecommendationResponse;
        try {
            response = await firstValueFrom(
                this.engine
                    .recommend({
                        pet: {
                            species: pet.species,
                            needs: pet.needs,
                            maxPrice: pet.maxPrice,
                        },
                        services: catalog.map(
                            ({ id, species, tags, price }) => ({
                                id,
                                species,
                                tags,
                                price,
                            }),
                        ),
                        limit: 5,
                    })
                    .pipe(timeout(3000)),
            );
        } catch (error) {
            this.logger.warn(
                `Recommendation engine unavailable: ${String(error)}`,
            );
            throw new ServiceUnavailableException(
                'Recommendations are temporarily unavailable',
            );
        }

        const byId = new Map(catalog.map((item) => [item.id, item]));
        return {
            pet,
            recommendations: response.matches.flatMap((match) => {
                const service = byId.get(match.serviceId);
                return service
                    ? [
                        {
                            service,
                            score: match.score,
                            matchedNeeds: match.matchedNeeds,
                        },
                    ]
                    : [];
            }),
        };
    }
    */
}
