import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { Upstream } from '../gateway/upstreams';
import { RecommendationService } from './recommendation.service';

@Upstream('recommender')
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
