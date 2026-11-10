import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { PG_CONNECTION } from '../database/database.module';
import { CATALOG } from './catalog.data';

describe('CatalogController', () => {
    let controller: CatalogController;
    let service: CatalogService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [CatalogController],
            providers: [
                CatalogService,
                {
                    provide: PG_CONNECTION,
                    useValue: {
                        query: jest.fn().mockResolvedValue({ rows: CATALOG }),
                    },
                },
            ],
        }).compile();

        controller = module.get<CatalogController>(CatalogController);
        service = module.get<CatalogService>(CatalogService);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    it('returns the whole catalog without filters', async () => {
        expect(await controller.getAllItems()).toEqual(
            await service.getCatalogItems(),
        );
    });

    it('filters by q and category', async () => {
        const results = await controller.getAllItems('cat', 'Grooming');
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
