import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    ParseIntPipe,
    Patch,
    Post,
    Query,
    UseGuards,
} from '@nestjs/common';
import { CurrentUser, JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { PetProfileService } from './pet-profile.service';
import type { PetInput } from './pet-profile.types';

@UseGuards(JwtAuthGuard)
@Controller('pet-profile')
export class PetProfileController {
    constructor(private readonly petProfileService: PetProfileService) {}

    // We use 'me' so the URL is http://localhost:3000/pet-profile/me
    @Get('me')
    getProfile(
        @Query('userId') userId?: string,
        @CurrentUser() user?: AuthenticatedUser,
    ) {
        return this.petProfileService.getProfile(user?.userId ?? userId);
    }

    @Post()
    createPet(@Body() body: PetInput, @CurrentUser() user?: AuthenticatedUser) {
        return this.petProfileService.createPet(
            user ? { ...body, userId: user.userId } : body,
        );
    }

    @Patch(':id')
    updatePet(
        @Param('id', ParseIntPipe) id: number,
        @Body() body: PetInput,
        @CurrentUser() user?: AuthenticatedUser,
    ) {
        return this.petProfileService.updatePet(
            id,
            user ? { ...body, userId: user.userId } : body,
        );
    }

    @Delete(':id')
    deletePet(
        @Param('id', ParseIntPipe) id: number,
        @Query('userId') userId?: string,
        @CurrentUser() user?: AuthenticatedUser,
    ) {
        return this.petProfileService.deletePet(id, user?.userId ?? userId);
    }
}
