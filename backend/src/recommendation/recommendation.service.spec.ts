import type { ClientGrpc } from '@nestjs/microservices';
import { of, throwError } from 'rxjs';
import { CatalogService } from '../catalog/catalog.service';
import { PetProfileService } from '../pet-profile/pet-profile.service';
import { RecommendationService } from './recommendation.service';
import type { RecommendationRequest } from './recommendation.types';

describe('RecommendationService', () => {
    const recommend = jest.fn();
    const client = {
        getService: jest.fn().mockReturnValue({ recommend }),
    } as unknown as ClientGrpc;
    let service: RecommendationService;

    beforeEach(() => {
        recommend.mockReset();
        service = new RecommendationService(
            client,
            new CatalogService(),
            new PetProfileService(),
        );
        service.onModuleInit();
    });

    it('sends pet and catalog data to gRPC and joins matching services', async () => {
        let sentRequest: RecommendationRequest | undefined;
        recommend.mockImplementation((request: RecommendationRequest) => {
            sentRequest = request;
            return of({
                matches: [
                    {
                        serviceId: 102,
                        score: 1,
                        matchedNeeds: ['coat-care', 'low-stress'],
                    },
                ],
            });
        });

        const result = await service.recommendForPet(1);

        if (!sentRequest) throw new Error('The gRPC client was not called');
        expect(sentRequest.pet).toEqual({
            species: 'cat',
            needs: ['coat-care', 'low-stress'],
            maxPrice: 50,
        });
        expect(sentRequest.limit).toBe(5);
        expect(sentRequest.services.find((item) => item.id === 102)).toEqual({
            id: 102,
            species: ['cat'],
            tags: ['coat-care', 'low-stress'],
            price: 45,
        });
        expect(result.pet.name).toBe('Luna');
        expect(result.recommendations[0].service.title).toBe(
            'Gentle Cat Grooming',
        );
        expect(result.recommendations[0].matchedNeeds).toEqual([
            'coat-care',
            'low-stress',
        ]);
    });

    it('returns 404 for an unknown pet without calling gRPC', async () => {
        await expect(service.recommendForPet(999)).rejects.toMatchObject({
            status: 404,
        });
        expect(recommend).not.toHaveBeenCalled();
    });

    it('returns 503 when the Python service fails', async () => {
        recommend.mockReturnValue(
            throwError(() => new Error('connection refused')),
        );
        await expect(service.recommendForPet(1)).rejects.toMatchObject({
            status: 503,
        });
    });
});
