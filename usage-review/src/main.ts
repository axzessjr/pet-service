import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);
    // Lets OutboxPublisher close its RabbitMQ connection on docker stop.
    app.enableShutdownHooks();
    await app.listen(process.env.PORT ?? 3001);
}
void bootstrap();
