import { Controller, Get, Inject, Module } from '@nestjs/common';
import { Pool } from 'pg';
import { DatabaseModule, PG_POOL } from './database/database.module';
import { OutboxPublisher } from './events/outbox.publisher';
import {
    RatingsController,
    ReviewsController,
} from './reviews/reviews.controller';
import { ReviewsService } from './reviews/reviews.service';
import { UsagesController } from './usages/usages.controller';
import { UsagesService } from './usages/usages.service';

@Controller('health')
class HealthController {
    constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

    @Get()
    async check() {
        await this.pool.query('SELECT 1');
        return { status: 'ok' };
    }
}

@Module({
    imports: [DatabaseModule],
    controllers: [
        HealthController,
        UsagesController,
        ReviewsController,
        RatingsController,
    ],
    providers: [UsagesService, ReviewsService, OutboxPublisher],
})
export class AppModule {}
