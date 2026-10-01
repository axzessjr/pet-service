import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { PetProfileService } from './pet-profile.service';
import type { PetInput } from './pet-profile.types';

@Controller('pet-profile')
export class PetProfileController {
    constructor(private readonly petProfileService: PetProfileService) { }

    // We use 'me' so the URL is http://localhost:3000/pet-profile/me
    @Get('me')
    getProfile(@Query('userId') userId: string) {
        return this.petProfileService.getProfile(userId);
    }

    @Post()
    createPet(@Body() body: PetInput) {
        return this.petProfileService.createPet(body);
    }

    @Patch(':id')
    updatePet(@Param('id', ParseIntPipe) id: number, @Body() body: PetInput) {
        return this.petProfileService.updatePet(id, body);
    }

    @Delete(':id')
    deletePet(@Param('id', ParseIntPipe) id: number, @Query('userId') userId: string) {
        return this.petProfileService.deletePet(id, userId);
    }
}
