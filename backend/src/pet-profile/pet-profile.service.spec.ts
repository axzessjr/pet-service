import { Test, TestingModule } from '@nestjs/testing';
import { PetProfileService } from './pet-profile.service';
import { PG_CONNECTION } from '../database/database.module';

describe('PetProfileService', () => {
    let service: PetProfileService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [PetProfileService, { provide: PG_CONNECTION, useValue: {} }],
        }).compile();

        service = module.get<PetProfileService>(PetProfileService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });
});
