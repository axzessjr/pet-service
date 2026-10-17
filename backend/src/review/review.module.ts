import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { PetProfileModule } from '../pet-profile/pet-profile.module';
import { RatingsController, ReviewsController } from './review.controller';
import { ReviewService } from './review.service';

@Module({
    imports: [CatalogModule, PetProfileModule],
    controllers: [ReviewsController, RatingsController],
    providers: [ReviewService],
})
export class ReviewModule {}
