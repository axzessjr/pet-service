import {
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
import { UsageReviewService } from './usage-review.service';

@Controller('usages')
export class UsagesController {
    constructor(private readonly usageReview: UsageReviewService) {}

    // Body: { ownerId, petId, serviceId }
    @Post()
    create(@Body() body: Record<string, unknown>) {
        return this.usageReview.createUsage(body);
    }

    @Get()
    list(@Query('ownerId') ownerId: string) {
        return this.usageReview.forward('GET', '/usages', {
            query: { ownerId },
        });
    }

    @Get(':id')
    get(@Param('id', ParseIntPipe) id: number) {
        return this.usageReview.forward('GET', `/usages/${id}`);
    }

    // Body: { ownerId, status: 'completed' | 'cancelled' }
    @Patch(':id')
    updateStatus(@Param('id', ParseIntPipe) id: number, @Body() body: unknown) {
        return this.usageReview.forward('PATCH', `/usages/${id}`, { body });
    }
}

@Controller('reviews')
export class ReviewsController {
    constructor(private readonly usageReview: UsageReviewService) {}

    // Body: { usageId, ownerId, rating, comment? }
    @Post()
    create(@Body() body: unknown) {
        return this.usageReview.forward('POST', '/reviews', { body });
    }

    @Get()
    list(
        @Query('serviceId') serviceId?: string,
        @Query('ownerId') ownerId?: string,
    ) {
        return this.usageReview.forward('GET', '/reviews', {
            query: { serviceId, ownerId },
        });
    }

    @Get(':id')
    get(@Param('id', ParseIntPipe) id: number) {
        return this.usageReview.forward('GET', `/reviews/${id}`);
    }

    // Body: { ownerId, rating?, comment? }
    @Patch(':id')
    update(@Param('id', ParseIntPipe) id: number, @Body() body: unknown) {
        return this.usageReview.forward('PATCH', `/reviews/${id}`, { body });
    }

    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    async remove(
        @Param('id', ParseIntPipe) id: number,
        @Query('ownerId') ownerId: string,
    ) {
        await this.usageReview.forward('DELETE', `/reviews/${id}`, {
            query: { ownerId },
        });
    }
}

@Controller('ratings')
export class RatingsController {
    constructor(private readonly usageReview: UsageReviewService) {}

    @Get()
    list() {
        return this.usageReview.forward('GET', '/ratings');
    }
}
