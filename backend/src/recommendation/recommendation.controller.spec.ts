import { Test, TestingModule } from '@nestjs/testing';
import { RecommendationController } from './recommendation.controller';
import { RecommendationService } from './recommendation.service';
import type {
    MapRecommendations,
    PetRecommendations,
} from './recommendation.types';

describe('RecommendationController', () => {
    let controller: RecommendationController;
    const recommendForPet = jest.fn<
        ReturnType<RecommendationService['recommendForPet']>,
        Parameters<RecommendationService['recommendForPet']>
    >();
    const recommendations: PetRecommendations = {
        pet: {
            id: 2,
            name: 'Milo',
            species: 'dog',
            needs: [],
            maxPrice: 2000,
            userId: 1,
        },
        recommendations: [],
    };

    beforeEach(async () => {
        recommendForPet.mockReset().mockResolvedValue(recommendations);
        const module: TestingModule = await Test.createTestingModule({
            controllers: [RecommendationController],
            providers: [
                {
                    provide: RecommendationService,
                    useValue: { recommendForPet },
                },
            ],
        }).compile();

        controller = module.get<RecommendationController>(
            RecommendationController,
        );
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    it('uses the default limit when none is given', async () => {
        await expect(controller.getForPet(2)).resolves.toBe(recommendations);
        expect(recommendForPet).toHaveBeenCalledWith(2);
    });

    it('passes a valid limit through', async () => {
        await expect(controller.getForPet(2, '10')).resolves.toBe(
            recommendations,
        );
        expect(recommendForPet).toHaveBeenCalledWith(2, 10);
    });

    it.each(['0', '101', '2.5', 'abc', ''])('rejects limit %p', (limit) => {
        expect(() => controller.getForPet(2, limit)).toThrow(
            'limit must be between 1 and 100',
        );
    });
});

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
