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
import { objectId, positiveIntegerParam } from '../common/validation';
import { PhotoStore } from './photo-store';
import { ReviewsService } from './reviews.service';

@Controller('reviews')
export class ReviewsController {
    constructor(private readonly reviewsService: ReviewsService) {}

    // Body: serviceId, service {title, provider}, ownerId, pet?, rating,
    // aspects?, title?, comment?, visitedOn?, tags?, wouldRecommend?, photos?
    @Post()
    create(@Body() body: unknown) {
        return this.reviewsService.create(body);
    }

    // Filter by exactly one of ?serviceId= or ?ownerId=
    @Get()
    list(
        @Query('serviceId') serviceId?: string,
        @Query('ownerId') ownerId?: string,
    ) {
        if ((serviceId === undefined) === (ownerId === undefined)) {
            throw new BadRequestException('Provide either serviceId or ownerId');
        }
        return this.reviewsService.list(
            serviceId !== undefined
                ? { serviceId: positiveIntegerParam(serviceId, 'serviceId') }
                : { ownerId: positiveIntegerParam(ownerId, 'ownerId') },
        );
    }

    @Get(':id')
    get(@Param('id') id: string) {
        return this.reviewsService.get(objectId(id, 'id'));
    }

    // Body: ownerId + any of rating, aspects, title, comment, visitedOn,
    // tags, wouldRecommend, addPhotos, removePhotoIds
    @Patch(':id')
    update(@Param('id') id: string, @Body() body: unknown) {
        return this.reviewsService.update(objectId(id, 'id'), body);
    }

    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    remove(@Param('id') id: string, @Query('ownerId') ownerId: string) {
        return this.reviewsService.delete(
            objectId(id, 'id'),
            positiveIntegerParam(ownerId, 'ownerId'),
        );
    }
}

@Controller('ratings')
export class RatingsController {
    constructor(private readonly reviewsService: ReviewsService) {}

    @Get()
    list() {
        return this.reviewsService.ratings();
    }
}

@Controller('photos')
export class PhotosController {
    constructor(private readonly photos: PhotoStore) {}

    // A photo never changes once stored, so browsers may cache it.
    @Get(':id')
    @Header('Cache-Control', 'public, max-age=86400, immutable')
    async get(@Param('id') id: string) {
        const { stream, length } = await this.photos.open(objectId(id, 'id'));
        return new StreamableFile(stream, { type: 'image/jpeg', length });
    }
}
