import './environment';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { networkInterfaces } from 'node:os';
import { AppModule } from './app.module';

async function bootstrap() {
    const app = await NestFactory.create<NestExpressApplication>(AppModule);
    // Reviews carry up to 4 photos as base64 (resized in the browser first).
    app.useBodyParser('json', { limit: '12mb' });

    // Enable CORS (Cross-Origin Resource Sharing)
    // This allows our React frontend (running on a different port) to talk to this backend
    app.enableCors();

    const port = process.env.PORT ?? 3000;
    await app.listen(port);

    // The same addresses `ipconfig` shows. Inside Docker these are the
    // container's addresses; use the host's IP with the published port instead.
    const logger = new Logger('Gateway');
    for (const address of Object.values(networkInterfaces()).flat()) {
        if (address?.family === 'IPv4' && !address.internal) {
            logger.log(
                `Listening on http://${address.address}:${port} (routes: /gateway/routes)`,
            );
        }
    }
}
void bootstrap();
