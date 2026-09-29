import { Module } from '@nestjs/common';
import { PetProfileService } from './pet-profile.service';
import { PetProfileController } from './pet-profile.controller';

@Module({
    controllers: [PetProfileController],
    providers: [PetProfileService],
})
export class PetProfileModule {}
