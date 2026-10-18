import {
    BadRequestException,
    Body,
    Controller,
    Delete,
    Get,
    Header,
    HttpCode,
    HttpStatus,
    Param,
    Patch,
    Post,
    Query,
    StreamableFile,
} from '@nestjs/common';
import { Upstream } from '../gateway/upstreams';
import { PHOTO_TIMEOUT_MS, ReviewService } from './review.service';

// Review and photo ids are MongoDB ObjectIds. Checking the shape here keeps
// odd paths from reaching the internal service.
function mongoId(value: string, name: string): string {
    if (!/^[0-9a-f]{24}$/i.test(value)) {
        throw new BadRequestException(`${name} must be a 24-character hex id`);
    }
    return value;
}

@Upstream('review')
@Controller('reviews')
export class ReviewsController {
    constructor(private readonly reviews: ReviewService) {}

    // Body: { serviceId, ownerId, petId?, rating, aspects?, title?, comment?,
    //         visitedOn?, tags?, wouldRecommend?, photos? (base64, up to 4) }
    @Post()
    create(@Body() body: Record<string, unknown>) {
        return this.reviews.createReview(body);
    }

    @Get()
    list(
        @Query('serviceId') serviceId?: string,
        @Query('ownerId') ownerId?: string,
    ) {
        return this.reviews.forward('GET', '/reviews', {
            query: { serviceId, ownerId },
        });
    }

    // Declared before ':id' so "photos" is not read as a review id.
    @Get('photos/:photoId')
    @Header('Cache-Control', 'public, max-age=86400, immutable')
    async photo(@Param('photoId') photoId: string) {
        const { stream, length } = await this.reviews.openPhoto(
            mongoId(photoId, 'photoId'),
        );
        return new StreamableFile(stream, { type: 'image/jpeg', length });
    }

    @Get(':id')
    get(@Param('id') id: string) {
        return this.reviews.forward('GET', `/reviews/${mongoId(id, 'id')}`);
    }

    // Body: { ownerId, rating?, aspects?, title?, comment?, visitedOn?, tags?,
    //         wouldRecommend?, addPhotos?, removePhotoIds? }
    @Patch(':id')
    update(@Param('id') id: string, @Body() body: unknown) {
        return this.reviews.forward('PATCH', `/reviews/${mongoId(id, 'id')}`, {
            body,
            timeoutMs: PHOTO_TIMEOUT_MS,
        });
    }

    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    async remove(@Param('id') id: string, @Query('ownerId') ownerId: string) {
        await this.reviews.forward('DELETE', `/reviews/${mongoId(id, 'id')}`, {
            query: { ownerId },
        });
    }
}

@Upstream('review')
@Controller('ratings')
export class RatingsController {
    constructor(private readonly reviews: ReviewService) {}

    @Get()
    list() {
        return this.reviews.forward('GET', '/ratings');
    }
}
