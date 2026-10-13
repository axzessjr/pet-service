import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { PetProfileModule } from '../pet-profile/pet-profile.module';
import {
    RatingsController,
    ReviewsController,
    UsagesController,
} from './usage-review.controller';
import { UsageReviewService } from './usage-review.service';

@Module({
    imports: [CatalogModule, PetProfileModule],
    controllers: [UsagesController, ReviewsController, RatingsController],
    providers: [UsageReviewService],
})
export class UsageReviewModule {}
