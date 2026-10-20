import {
    BadRequestException,
    Controller,
    Get,
    Param,
    ParseIntPipe,
    Query,
} from '@nestjs/common';
import { Upstream } from '../gateway/upstreams';
import { RecommendationService } from './recommendation.service';

@Upstream('recommender')
@Controller('recommendation')
export class RecommendationController {
    constructor(
        private readonly recommendationService: RecommendationService,
    ) {}

    @Get('pets/:petId')
    getForPet(
        @Param('petId', ParseIntPipe) petId: number,
        @Query('limit') limit?: string,
    ) {
        if (limit === undefined) {
            return this.recommendationService.recommendForPet(petId);
        }
        if (!/^[1-9]\d*$/.test(limit) || Number(limit) > 100) {
            throw new BadRequestException('limit must be between 1 and 100');
        }
        return this.recommendationService.recommendForPet(
            petId,
            Number(limit),
        );
    }
}
