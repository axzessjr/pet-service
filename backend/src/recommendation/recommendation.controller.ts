import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { RecommendationService } from './recommendation.service';

@Controller('recommendation')
export class RecommendationController {
    constructor(
        private readonly recommendationService: RecommendationService,
    ) {}

    @Get('pets/:petId')
    getForPet(@Param('petId', ParseIntPipe) petId: number) {
        return this.recommendationService.recommendForPet(petId);
    }
}
