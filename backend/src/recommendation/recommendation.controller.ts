import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { Upstream } from '../gateway/upstreams';
import { parseMapQuery } from './map';
import { RecommendationService } from './recommendation.service';

@Upstream('recommender')
@Controller('recommendation')
export class RecommendationController {
    constructor(
        private readonly recommendationService: RecommendationService,
    ) {}

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
