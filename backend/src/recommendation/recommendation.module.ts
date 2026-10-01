import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { resolve } from 'node:path';
import { CatalogModule } from '../catalog/catalog.module';
import { PetProfileModule } from '../pet-profile/pet-profile.module';
import { RecommendationService } from './recommendation.service';
import { RecommendationController } from './recommendation.controller';
import { SavedRecommendationController } from './saved-recommendation.controller';

@Module({
    imports: [
        CatalogModule,
        PetProfileModule,
        ClientsModule.register([
            {
                name: 'RECOMMENDATION_ENGINE',
                transport: Transport.GRPC,
                options: {
                    package: 'recommendation',
                    protoPath: resolve(
                        __dirname,
                        '../../../proto/recommendation.proto',
                    ),
                    url:
                        process.env.RECOMMENDATION_GRPC_URL ??
                        'localhost:50051',
                },
            },
        ]),
    ],
    controllers: [RecommendationController, SavedRecommendationController],
    providers: [RecommendationService],
})
export class RecommendationModule {}
