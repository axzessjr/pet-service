import { Test, TestingModule } from '@nestjs/testing';
import { PetProfileController } from './pet-profile.controller';
import { PetProfileService } from './pet-profile.service';

describe('PetProfileController', () => {
    let controller: PetProfileController;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [PetProfileController],
            providers: [PetProfileService],
        }).compile();

        controller = module.get<PetProfileController>(PetProfileController);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });
});
