import { RecommendationController } from './recommendation.controller';
import { RecommendationService } from './recommendation.service';
import type { MapRecommendations } from './recommendation.types';

describe('RecommendationController map route', () => {
    const recommendForMap = jest.fn<
        ReturnType<RecommendationService['recommendForMap']>,
        Parameters<RecommendationService['recommendForMap']>
    >();
    const recommendations: MapRecommendations = {
        pet: {
            id: 3,
            name: 'Luna',
            species: 'cat',
            needs: [],
            maxPrice: 2000,
            userId: 1,
        },
        mode: 'top',
        bounds: {
            minLat: 13.73,
            minLng: 100.52,
            maxLat: 13.75,
            maxLng: 100.54,
        },
        zoom: 13,
        detailZoom: 15,
        total: 0,
        recommendations: [],
    };
    const controller = new RecommendationController({
        recommendForMap,
    } as unknown as RecommendationService);

    beforeEach(() => {
        recommendForMap.mockReset().mockResolvedValue(recommendations);
    });

    it('parses the query and passes it on', async () => {
        await expect(
            controller.getMapForPet(3, {
                minLat: '13.73',
                minLng: '100.52',
                maxLat: '13.75',
                maxLng: '100.54',
                zoom: '13',
                q: 'groom',
            }),
        ).resolves.toBe(recommendations);
        expect(recommendForMap).toHaveBeenCalledWith(
            3,
            expect.objectContaining({ zoom: 13, q: 'groom' }),
        );
    });

    it('rejects a bad query before calling the service', () => {
        expect(() => controller.getMapForPet(3, { zoom: '13' })).toThrow(
            'minLat is required',
        );
        expect(recommendForMap).not.toHaveBeenCalled();
    });
});
