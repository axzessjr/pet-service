import {
    BadRequestException,
    Controller,
    Get,
    Param,
    ParseIntPipe,
    Query,
} from '@nestjs/common';
import { Upstream } from '../gateway/upstreams';
import { parseMapQuery } from './map';
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
        return this.recommendationService.recommendForPet(petId, Number(limit));
    }

    // GET /recommendation/pets/1/map?minLat=&minLng=&maxLat=&maxLng=&zoom=15
    // plus optional q, category, maxPrice, minRating, limit, includeUnmatched.
    @Get('pets/:petId/map')
    getMapForPet(
        @Param('petId', ParseIntPipe) petId: number,
        @Query() query: Record<string, unknown>,
    ) {
        return this.recommendationService.recommendForMap(
            petId,
            parseMapQuery(query),
        );
    }
}
