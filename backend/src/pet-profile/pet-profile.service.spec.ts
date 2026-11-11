import { Test, TestingModule } from '@nestjs/testing';
import { PetProfileService } from './pet-profile.service';
import { PG_CONNECTION } from '../database/database.module';

describe('PetProfileService', () => {
    let service: PetProfileService;
    const query = jest.fn();

    beforeEach(async () => {
        query.mockReset();
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                PetProfileService,
                { provide: PG_CONNECTION, useValue: { query } },
            ],
        }).compile();

        service = module.get<PetProfileService>(PetProfileService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    it('stores needs in lowercase, once each, so they match catalog tags', async () => {
        query.mockResolvedValue({ rows: [{ id: 1 }] });
        await service.createPet({
            userId: 1,
            name: 'Max',
            species: 'Dog',
            needs: [' Exercise ', 'exercise', 'Social', ''],
            maxPrice: 500,
        });
        const [, values] = query.mock.calls[0] as [string, unknown[]];
        expect(values).toEqual([1, 'Max', 'dog', ['exercise', 'social'], 500]);
    });
});
