import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Delete,
} from '@nestjs/common';
import { PetProfileService } from './pet-profile.service';

@Controller('pet-profile')
export class PetProfileController {
    constructor(private readonly petProfileService: PetProfileService) {}

    // We use 'me' so the URL is http://localhost:3000/pet-profile/me
    @Get('me')
    getProfile() {
        return this.petProfileService.getProfile();
    }
}
