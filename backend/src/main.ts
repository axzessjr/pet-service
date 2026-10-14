import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';

async function bootstrap() {
    const app = await NestFactory.create<NestExpressApplication>(AppModule);
    // Reviews carry up to 4 photos as base64 (resized in the browser first).
    app.useBodyParser('json', { limit: '12mb' });

    // Enable CORS (Cross-Origin Resource Sharing)
    // This allows our React frontend (running on a different port) to talk to this backend
    app.enableCors();

    await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
