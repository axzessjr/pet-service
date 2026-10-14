import {
    BadRequestException,
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    ParseIntPipe,
    Patch,
    Post,
    Query,
} from '@nestjs/common';
import { positiveIntegerParam } from '../common/validation';
import { ReviewsService } from './reviews.service';

@Controller('reviews')
export class ReviewsController {
    constructor(private readonly reviewsService: ReviewsService) {}

    @Post()
    create(@Body() body: Record<string, unknown>) {
        return this.reviewsService.create(body);
    }

    // Filter by exactly one of ?serviceId= or ?ownerId=
    @Get()
    list(
        @Query('serviceId') serviceId?: string,
        @Query('ownerId') ownerId?: string,
    ) {
        if ((serviceId === undefined) === (ownerId === undefined)) {
            throw new BadRequestException(
                'Provide either serviceId or ownerId',
            );
        }
        return this.reviewsService.list(
            serviceId !== undefined
                ? { serviceId: positiveIntegerParam(serviceId, 'serviceId') }
                : { ownerId: positiveIntegerParam(ownerId, 'ownerId') },
        );
    }

    @Get(':id')
    get(@Param('id', ParseIntPipe) id: number) {
        return this.reviewsService.get(id);
    }

    @Patch(':id')
    update(
        @Param('id', ParseIntPipe) id: number,
        @Body() body: Record<string, unknown>,
    ) {
        return this.reviewsService.update(id, body);
    }

    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    remove(
        @Param('id', ParseIntPipe) id: number,
        @Query('ownerId') ownerId: string,
    ) {
        return this.reviewsService.delete(
            id,
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
