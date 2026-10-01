import type { ClientGrpc } from '@nestjs/microservices';
import { of, throwError } from 'rxjs';
import { CatalogService } from '../catalog/catalog.service';
import { PetProfileService } from '../pet-profile/pet-profile.service';
import { RecommendationService } from './recommendation.service';
import type {
    RecommendationRequest,
    SavedRecommendation,
} from './recommendation.types';

describe('RecommendationService', () => {
    const engine = {
        recommend: jest.fn(),
        createRecommendation: jest.fn(),
        getRecommendation: jest.fn(),
        listRecommendations: jest.fn(),
        updateRecommendation: jest.fn(),
        deleteRecommendation: jest.fn(),
    };
    const client = {
        getService: jest.fn().mockReturnValue(engine),
    } as unknown as ClientGrpc;
    const pet = {
        id: 1,
        userId: 1,
        name: 'Luna',
        species: 'cat',
        needs: ['coat-care', 'low-stress'],
        maxPrice: 50,
    };
    const profile = {
        getPetById: jest.fn(),
    } as unknown as PetProfileService;
    const saved: SavedRecommendation = {
        id: '292b8266-d727-4eba-9bce-598b16117078',
        petId: 1,
        limit: 5,
        matches: [
            {
                serviceId: 102,
                score: 1,
                matchedNeeds: ['coat-care', 'low-stress'],
            },
        ],
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
    };
    let service: RecommendationService;

    beforeEach(() => {
        for (const method of Object.values(engine)) method.mockReset();
        (profile.getPetById as jest.Mock).mockReset().mockResolvedValue(pet);
        service = new RecommendationService(
            client,
            new CatalogService(),
            profile,
        );
        service.onModuleInit();
    });

    it('sends pet and catalog data to gRPC and joins matching services', async () => {
        let request: RecommendationRequest | undefined;
        engine.recommend.mockImplementation((input: RecommendationRequest) => {
            request = input;
            return of({ matches: saved.matches });
        });

        const result = await service.recommendForPet(1);
        if (!request) throw new Error('gRPC recommend was not called');
        expect(request.pet).toEqual({
            species: 'cat',
            needs: ['coat-care', 'low-stress'],
            maxPrice: 50,
        });
        expect(request.limit).toBe(5);
        expect(request.services.find((item) => item.id === 102)).toEqual({
            id: 102,
            species: ['cat'],
            tags: ['coat-care', 'low-stress'],
            price: 45,
        });
        expect(result.recommendations[0].service.title).toBe(
            'Gentle Cat Grooming',
        );
    });

    it('creates a saved set using the current pet and catalog', async () => {
        let request:
            { petId: number; input: RecommendationRequest } | undefined;
        engine.createRecommendation.mockImplementation(
            (input: { petId: number; input: RecommendationRequest }) => {
                request = input;
                return of(saved);
            },
        );
        await expect(service.createSaved(1, 3)).resolves.toEqual(saved);
        if (!request) throw new Error('gRPC create was not called');
        expect(request.petId).toBe(1);
        expect(request.input.limit).toBe(3);
        expect(request.input.pet.species).toBe('cat');
    });

    it('reads and lists saved sets', async () => {
        engine.getRecommendation.mockReturnValue(of(saved));
        engine.listRecommendations.mockReturnValue(
            of({ recommendations: [saved] }),
        );
        await expect(service.getSaved(saved.id)).resolves.toEqual(saved);
        await expect(service.listSaved(1)).resolves.toEqual([saved]);
        expect(engine.getRecommendation).toHaveBeenCalledWith({ id: saved.id });
        expect(engine.listRecommendations).toHaveBeenCalledWith({ petId: 1 });
    });

    it('recalculates an existing set with a new limit', async () => {
        engine.getRecommendation.mockReturnValue(of(saved));
        let request:
            | { id: string; petId: number; input: RecommendationRequest }
            | undefined;
        engine.updateRecommendation.mockImplementation(
            (input: {
                id: string;
                petId: number;
                input: RecommendationRequest;
            }) => {
                request = input;
                return of({ ...saved, limit: 2 });
            },
        );
        await expect(service.updateSaved(saved.id, 2)).resolves.toMatchObject({
            limit: 2,
        });
        if (!request) throw new Error('gRPC update was not called');
        expect(request.id).toBe(saved.id);
        expect(request.petId).toBe(1);
        expect(request.input.limit).toBe(2);
    });

    it('returns empty arrays when proto3 omits repeated fields', async () => {
        engine.recommend.mockReturnValue(of({}));
        engine.createRecommendation.mockReturnValue(
            of({ ...saved, matches: undefined }),
        );
        engine.listRecommendations.mockReturnValue(of({}));
        await expect(service.recommendForPet(1)).resolves.toMatchObject({
            recommendations: [],
        });
        await expect(service.createSaved(1)).resolves.toMatchObject({
            matches: [],
        });
        await expect(service.listSaved(1)).resolves.toEqual([]);
    });

    it('deletes a saved set', async () => {
        engine.deleteRecommendation.mockReturnValue(of({ deleted: true }));
        await expect(service.deleteSaved(saved.id)).resolves.toBeUndefined();
        expect(engine.deleteRecommendation).toHaveBeenCalledWith({
            id: saved.id,
        });
    });

    it('returns 404 for an unknown pet without calling gRPC', async () => {
        (profile.getPetById as jest.Mock).mockResolvedValue(undefined);
        await expect(service.createSaved(999)).rejects.toMatchObject({
            status: 404,
        });
        expect(engine.createRecommendation).not.toHaveBeenCalled();
    });

    it('maps a missing saved set to HTTP 404', async () => {
        engine.getRecommendation.mockReturnValue(
            throwError(() => ({ code: 5 })),
        );
        await expect(service.getSaved(saved.id)).rejects.toMatchObject({
            status: 404,
        });
    });

    it('returns 503 when the Python service fails', async () => {
        engine.recommend.mockReturnValue(
            throwError(() => new Error('connection refused')),
        );
        await expect(service.recommendForPet(1)).rejects.toMatchObject({
            status: 503,
        });
    });
});
