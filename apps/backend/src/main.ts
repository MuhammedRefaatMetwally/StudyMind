import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = NestFactory.create(AppModule);

  (await app).useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strips unknown fields automatically
      forbidNonWhitelisted: true, // throws error if unknown fields sent
      transform: true, // auto-transforms payloads to DTO instances
    }),
  );

  (await app).enableCors();
  (await app).setGlobalPrefix('api');

  (await app).listen(3001);
}
bootstrap();
