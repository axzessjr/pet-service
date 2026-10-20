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
