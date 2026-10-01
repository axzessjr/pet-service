import { Controller, Get, Query } from '@nestjs/common';
import { PetProfileService } from './pet-profile.service';

@Controller('pet-profile')
export class PetProfileController {
    constructor(private readonly petProfileService: PetProfileService) { }

    // We use 'me' so the URL is http://localhost:3000/pet-profile/me
    @Get('me')
    getProfile(@Query('userId') userId: string) {
        return this.petProfileService.getProfile(userId);
    }
}
