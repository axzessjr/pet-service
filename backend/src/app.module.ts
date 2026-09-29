import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';

import { CatalogModule } from './catalog/catalog.module';
import { PetProfileModule } from './pet-profile/pet-profile.module';
import { RecommendationModule } from './recommendation/recommendation.module';

@Module({
    imports: [CatalogModule, PetProfileModule, RecommendationModule],
    controllers: [AppController],
    providers: [AppService],
})
export class AppModule {}
