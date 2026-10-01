import { Test, TestingModule } from '@nestjs/testing';
import { PetProfileController } from './pet-profile.controller';
import { PetProfileService } from './pet-profile.service';
import { PG_CONNECTION } from '../database/database.module';

describe('PetProfileController', () => {
    let controller: PetProfileController;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [PetProfileController],
            providers: [PetProfileService, { provide: PG_CONNECTION, useValue: {} }],
        }).compile();

        controller = module.get<PetProfileController>(PetProfileController);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });
});
