import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';

describe('CatalogController', () => {
    let controller: CatalogController;
    let service: CatalogService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [CatalogController],
            providers: [CatalogService],
        }).compile();

        controller = module.get<CatalogController>(CatalogController);
        service = module.get<CatalogService>(CatalogService);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    it('returns the whole catalog without filters', () => {
        expect(controller.getAllItems()).toBe(service.getCatalogItems());
    });

    it('filters by q and category', () => {
        const results = controller.getAllItems('cat', 'Grooming');
        expect(results.length).toBeGreaterThan(0);
        expect(results.every((item) => item.category === 'Grooming')).toBe(
            true,
        );
    });

    it('rejects repeated or overlong params', () => {
        expect(() => controller.getAllItems(['a', 'b'])).toThrow(
            BadRequestException,
        );
        expect(() => controller.getAllItems('x'.repeat(101))).toThrow(
            BadRequestException,
        );
    });
});
