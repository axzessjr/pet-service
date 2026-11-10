import './environment';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';

async function bootstrap() {
    const app = await NestFactory.create<NestExpressApplication>(AppModule);
    // Reviews carry up to 4 photos as base64 (resized in the browser first).
    app.useBodyParser('json', { limit: '12mb' });
    // Lets the event publisher close its RabbitMQ connection on docker stop.
    app.enableShutdownHooks();
    await app.listen(process.env.PORT ?? 3001);
}
void bootstrap();
