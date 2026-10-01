import {
    BadRequestException,
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    ParseUUIDPipe,
    Post,
    Put,
    Query,
} from '@nestjs/common';
import { RecommendationService } from './recommendation.service';

function positiveInteger(
    value: unknown,
    name: string,
    maximum: number,
): number {
    if (
        typeof value !== 'number' ||
        !Number.isSafeInteger(value) ||
        value <= 0 ||
        value > maximum
    ) {
        throw new BadRequestException(
            `${name} must be between 1 and ${maximum}`,
        );
    }
    return value;
}

@Controller('recommendations')
export class SavedRecommendationController {
    constructor(
        private readonly recommendationService: RecommendationService,
    ) {}

    @Post()
    create(@Body() body: { petId?: unknown; limit?: unknown }) {
        const petId = positiveInteger(body?.petId, 'petId', 2147483647);
        const limit = positiveInteger(body?.limit ?? 5, 'limit', 100);
        return this.recommendationService.createSaved(petId, limit);
    }

    @Get()
    list(@Query('petId') petId: string) {
        if (!/^[1-9]\d*$/.test(petId ?? '')) {
            throw new BadRequestException('petId must be a positive integer');
        }
        return this.recommendationService.listSaved(Number(petId));
    }

    @Get(':id')
    get(@Param('id', ParseUUIDPipe) id: string) {
        return this.recommendationService.getSaved(id);
    }

    @Put(':id')
    update(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() body: { limit?: unknown },
    ) {
        const limit = positiveInteger(body?.limit, 'limit', 100);
        return this.recommendationService.updateSaved(id, limit);
    }

    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    remove(@Param('id', ParseUUIDPipe) id: string) {
        return this.recommendationService.deleteSaved(id);
    }
}
