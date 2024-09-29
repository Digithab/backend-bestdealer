import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Configuración de Swagger
  const config = new DocumentBuilder()
    .setTitle('Bestdealer APIS')
    .setDescription('Bestdealer')
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  app.setGlobalPrefix('api/v1');


  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,    // Ignora propiedades no declaradas en el DTO
    forbidNonWhitelisted: true, // Retorna un error si se pasan propiedades no válidas
    transform: true, // Transforma el payload de entrada en instancias de las clases DTO
  }));

  await app.listen(4080);
}
bootstrap();
