import type { ClientGrpc } from '@nestjs/microservices';
import { of, throwError } from 'rxjs';
import { CatalogService } from '../catalog/catalog.service';
import { CATALOG } from '../catalog/catalog.data';
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
        maxPrice: 1750,
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
                averageRating: 4.5,
                reviewCount: 2,
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
            {
                getCatalogItems: jest.fn().mockResolvedValue(CATALOG),
            } as unknown as CatalogService,
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
            maxPrice: 1750,
        });
        expect(request.limit).toBe(5);
        expect(request.services.find((item) => item.id === 102)).toEqual({
            id: 102,
            species: ['cat'],
            tags: ['coat-care', 'low-stress'],
            price: 1600,
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

    it('defaults ratings to 0 when proto3 omits them', async () => {
        engine.recommend.mockReturnValue(
            of({ matches: [{ serviceId: 102, score: 1 }] }),
        );
        const result = await service.recommendForPet(1);
        expect(result.recommendations[0]).toMatchObject({
            matchedNeeds: [],
            averageRating: 0,
            reviewCount: 0,
        });
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

describe('RecommendationService.recommendForMap', () => {
    // A stand-in for the Python engine: species and price filter, needs must
    // overlap tags, score is the share of needs covered. Each service's rating
    // is the last digit of its id divided by 2, so minRating can be tested.
    function fakeRecommend(request: RecommendationRequest) {
        const { species, needs, maxPrice } = request.pet;
        const matches = request.services
            .filter(
                (item) =>
                    item.species.includes(species) &&
                    (maxPrice <= 0 || item.price <= maxPrice),
            )
            .map((item) => {
                const matchedNeeds = needs.filter((need) =>
                    item.tags.includes(need),
                );
                return {
                    serviceId: item.id,
                    score: needs.length
                        ? matchedNeeds.length / needs.length
                        : 0,
                    matchedNeeds,
                    averageRating: (item.id % 10) / 2,
                    reviewCount: 1,
                };
            })
            .filter((match) => !needs.length || match.matchedNeeds.length > 0)
            .sort((a, b) => b.score - a.score || a.serviceId - b.serviceId)
            .slice(0, request.limit);
        return of({ matches });
    }

    const engine = { recommend: jest.fn() };
    const client = {
        getService: jest.fn().mockReturnValue(engine),
    } as unknown as ClientGrpc;
    const dog = {
        id: 2,
        userId: 1,
        name: 'Rex',
        species: 'dog',
        needs: ['exercise', 'social'],
        maxPrice: 1750,
    };
    const profile = {
        getPetById: jest.fn(),
    } as unknown as PetProfileService;
    // Roughly the view at zoom 15 around Chulalongkorn University.
    const chula = {
        minLat: 13.728,
        minLng: 100.518,
        maxLat: 13.749,
        maxLng: 100.546,
    };
    const silom = {
        minLat: 13.718,
        minLng: 100.522,
        maxLat: 13.73,
        maxLng: 100.54,
    };
    const catalog = {
        getCatalogItems: jest.fn().mockResolvedValue(CATALOG),
    } as unknown as CatalogService;
    const byId = new Map(CATALOG.map((item) => [item.id, item]));
    let service: RecommendationService;

    beforeEach(() => {
        engine.recommend.mockReset().mockImplementation(fakeRecommend);
        (profile.getPetById as jest.Mock).mockReset().mockResolvedValue(dog);
        service = new RecommendationService(client, catalog, profile);
        service.onModuleInit();
    });

    function sent(call = 0): RecommendationRequest {
        const calls = engine.recommend.mock.calls as [RecommendationRequest][];
        return calls[call][0];
    }

    it('sends only in-bounds services to gRPC', async () => {
        await service.recommendForMap(2, {
            bounds: chula,
            zoom: 15,
            includeUnmatched: false,
        });
        const ids = sent().services.map((item) => item.id);
        expect(ids.length).toBeGreaterThan(0);
        expect(ids.length).toBeLessThan(CATALOG.length);
        for (const id of ids) {
            const location = byId.get(id)?.location;
            if (!location) throw new Error(`Unknown service ${id}`);
            expect(location.lat).toBeGreaterThanOrEqual(chula.minLat);
            expect(location.lat).toBeLessThanOrEqual(chula.maxLat);
            expect(location.lng).toBeGreaterThanOrEqual(chula.minLng);
            expect(location.lng).toBeLessThanOrEqual(chula.maxLng);
        }
    });

    it('returns different services after panning', async () => {
        const here = await service.recommendForMap(2, {
            bounds: chula,
            zoom: 16,
            includeUnmatched: false,
        });
        const there = await service.recommendForMap(2, {
            bounds: silom,
            zoom: 16,
            includeUnmatched: false,
        });
        const ids = (list: typeof here) =>
            list.recommendations.map((item) => item.service.id);
        expect(ids(there)).not.toEqual(ids(here));
        expect(
            there.recommendations.some(
                (item) => item.service.location.lat < chula.minLat,
            ),
        ).toBe(true);
    });

    it('switches from detail to top N when zoomed out', async () => {
        const wide = {
            minLat: 13.7,
            minLng: 100.48,
            maxLat: 13.78,
            maxLng: 100.58,
        };
        const detail = await service.recommendForMap(2, {
            bounds: wide,
            zoom: 15,
            includeUnmatched: false,
        });
        const top = await service.recommendForMap(2, {
            bounds: wide,
            zoom: 12,
            includeUnmatched: false,
        });
        expect(detail.mode).toBe('detail');
        expect(detail.recommendations.length).toBe(detail.total);
        expect(detail.total).toBeGreaterThan(10);
        expect(top.mode).toBe('top');
        expect(top.total).toBe(detail.total);
        expect(top.recommendations).toEqual(
            detail.recommendations.slice(0, 10),
        );
        expect(top.detailZoom).toBe(15);
    });

    it('applies text, category, and price before calling gRPC', async () => {
        await service.recommendForMap(2, {
            bounds: chula,
            zoom: 15,
            q: 'walk',
            category: 'Walking',
            maxPrice: 700,
            includeUnmatched: false,
        });
        const request = sent();
        expect(request.services.length).toBeGreaterThan(0);
        for (const { id } of request.services) {
            expect(byId.get(id)).toMatchObject({ category: 'Walking' });
            expect(byId.get(id)?.price).toBeLessThanOrEqual(700);
        }
        expect(request.pet.maxPrice).toBe(700);
    });

    it('never widens the pet budget', async () => {
        await service.recommendForMap(2, {
            bounds: chula,
            zoom: 15,
            maxPrice: 5000,
            includeUnmatched: false,
        });
        expect(sent().pet.maxPrice).toBe(1750);
    });

    it('filters by minimum rating after ranking', async () => {
        const result = await service.recommendForMap(2, {
            bounds: chula,
            zoom: 15,
            minRating: 3,
            includeUnmatched: false,
        });
        expect(result.recommendations.length).toBeGreaterThan(0);
        expect(
            result.recommendations.every((item) => item.averageRating >= 3),
        ).toBe(true);
        expect(result.total).toBe(result.recommendations.length);
    });

    it('skips gRPC when nothing is in view', async () => {
        const result = await service.recommendForMap(2, {
            bounds: { minLat: 1, minLng: 1, maxLat: 2, maxLng: 2 },
            zoom: 15,
            includeUnmatched: true,
        });
        expect(engine.recommend).not.toHaveBeenCalled();
        expect(result).toMatchObject({ total: 0, recommendations: [] });
    });

    it('reports services hidden only by the budget', async () => {
        (profile.getPetById as jest.Mock).mockResolvedValue({
            ...dog,
            maxPrice: 55,
        });
        const result = await service.recommendForMap(2, {
            bounds: chula,
            zoom: 15,
            includeUnmatched: true,
        });
        const dogPrices = CATALOG.filter(
            (item) =>
                item.species.includes('dog') &&
                item.location.lat >= chula.minLat &&
                item.location.lat <= chula.maxLat &&
                item.location.lng >= chula.minLng &&
                item.location.lng <= chula.maxLng,
        ).map((item) => item.price);
        expect(result.total).toBe(0);
        expect(result.overBudget).toEqual({
            count: dogPrices.length,
            cheapestPrice: Math.min(...dogPrices),
            maxPrice: 55,
        });
    });

    it('leaves out overBudget when something fits', async () => {
        const result = await service.recommendForMap(2, {
            bounds: chula,
            zoom: 15,
            includeUnmatched: true,
        });
        expect(result.total).toBeGreaterThan(0);
        expect(result.overBudget).toBeUndefined();
    });

    it('does not blame the budget when nothing is in view', async () => {
        const result = await service.recommendForMap(2, {
            bounds: { minLat: 1, minLng: 1, maxLat: 2, maxLng: 2 },
            zoom: 15,
            includeUnmatched: true,
        });
        expect(result.overBudget).toBeUndefined();
    });

    it('adds unmatched services last with score 0 when asked', async () => {
        const result = await service.recommendForMap(2, {
            bounds: chula,
            zoom: 15,
            includeUnmatched: true,
        });
        expect(engine.recommend).toHaveBeenCalledTimes(2);
        expect(sent(1).pet.needs).toEqual([]);
        const flags = result.recommendations.map((item) => item.matched);
        const firstUnmatched = flags.indexOf(false);
        expect(firstUnmatched).toBeGreaterThan(0);
        expect(flags.slice(firstUnmatched).every((flag) => !flag)).toBe(true);
        for (const item of result.recommendations.slice(firstUnmatched)) {
            expect(item).toMatchObject({ score: 0, matchedNeeds: [] });
        }
        const ids = result.recommendations.map((item) => item.service.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('maps gRPC failures to 503', async () => {
        engine.recommend.mockReturnValue(
            throwError(() => new Error('connection refused')),
        );
        await expect(
            service.recommendForMap(2, {
                bounds: chula,
                zoom: 15,
                includeUnmatched: false,
            }),
        ).rejects.toMatchObject({ status: 503 });
    });

    it('returns 404 for an unknown pet without calling gRPC', async () => {
        (profile.getPetById as jest.Mock).mockResolvedValue(undefined);
        await expect(
            service.recommendForMap(9, {
                bounds: chula,
                zoom: 15,
                includeUnmatched: false,
            }),
        ).rejects.toMatchObject({ status: 404 });
        expect(engine.recommend).not.toHaveBeenCalled();
    });
});
