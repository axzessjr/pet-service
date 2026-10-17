import { Controller, Get, Inject, Module } from '@nestjs/common';
import { Db } from 'mongodb';
import { MONGO_DB, MongoModule } from './database/mongo.module';
import { ReviewEventsPublisher } from './events/review-events.publisher';
import { PhotoStore } from './reviews/photo-store';
import {
    PhotosController,
    RatingsController,
    ReviewsController,
} from './reviews/reviews.controller';
import { ReviewsService } from './reviews/reviews.service';

@Controller('health')
class HealthController {
    constructor(@Inject(MONGO_DB) private readonly db: Db) {}

    @Get()
    async check() {
        await this.db.command({ ping: 1 });
        return { status: 'ok' };
    }
}

@Module({
    imports: [MongoModule],
    controllers: [
        HealthController,
        ReviewsController,
        RatingsController,
        PhotosController,
    ],
    providers: [ReviewsService, PhotoStore, ReviewEventsPublisher],
})
export class AppModule {}
