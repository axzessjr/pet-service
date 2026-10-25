import { Test, TestingModule } from '@nestjs/testing';
import { RecommendationController } from './recommendation.controller';
import { RecommendationService } from './recommendation.service';

describe('RecommendationController', () => {
    let controller: RecommendationController;
    const recommendForPet = jest.fn();

    beforeEach(async () => {
        recommendForPet.mockReset();
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

    it('uses the default limit when none is given', () => {
        controller.getForPet(2);
        expect(recommendForPet).toHaveBeenCalledWith(2);
    });

    it('passes a valid limit through', () => {
        controller.getForPet(2, '10');
        expect(recommendForPet).toHaveBeenCalledWith(2, 10);
    });

    it.each(['0', '101', '2.5', 'abc', ''])('rejects limit %p', (limit) => {
        expect(() => controller.getForPet(2, limit)).toThrow(
            'limit must be between 1 and 100',
        );
    });
});

describe('RecommendationController map route', () => {
    const recommendForMap = jest.fn();
    const controller = new RecommendationController({
        recommendForMap,
    } as unknown as RecommendationService);

    beforeEach(() => recommendForMap.mockReset());

    it('parses the query and passes it on', () => {
        void controller.getMapForPet(3, {
            minLat: '13.73',
            minLng: '100.52',
            maxLat: '13.75',
            maxLng: '100.54',
            zoom: '13',
            q: 'groom',
        });
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
