import type { ClientGrpc } from '@nestjs/microservices';
import { of, throwError } from 'rxjs';
import { CatalogService } from '../catalog/catalog.service';
import { CATALOG } from '../catalog/catalog.data';
import { PetProfileService } from '../pet-profile/pet-profile.service';
import { RecommendationService } from './recommendation.service';
import type { RecommendationRequest } from './recommendation.types';

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

    it('sends the pet and only the ranking fields to gRPC', async () => {
        await service.recommendForMap(2, {
            bounds: chula,
            zoom: 15,
            includeUnmatched: false,
        });
        expect(sent().pet).toEqual({
            species: 'dog',
            needs: ['exercise', 'social'],
            maxPrice: 1750,
        });
        expect(sent().limit).toBe(sent().services.length);
        for (const item of sent().services) {
            expect(Object.keys(item).sort()).toEqual([
                'id',
                'price',
                'species',
                'tags',
            ]);
        }
    });

    it('fills in fields that proto3 leaves out', async () => {
        const query = { bounds: chula, zoom: 15, includeUnmatched: false };
        engine.recommend.mockReturnValue(of({}));
        await expect(service.recommendForMap(2, query)).resolves.toMatchObject({
            recommendations: [],
            total: 0,
        });

        const id = sent().services[0].id;
        engine.recommend.mockReturnValue(
            of({ matches: [{ serviceId: id, score: 1 }] }),
        );
        const result = await service.recommendForMap(2, query);
        expect(result.recommendations[0]).toMatchObject({
            matchedNeeds: [],
            averageRating: 0,
            reviewCount: 0,
        });
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
