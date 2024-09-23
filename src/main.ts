import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,    // Ignora propiedades no declaradas en el DTO
    forbidNonWhitelisted: true, // Retorna un error si se pasan propiedades no válidas
    transform: true, // Transforma el payload de entrada en instancias de las clases DTO
  }));

  await app.listen(4080);
}
bootstrap();
