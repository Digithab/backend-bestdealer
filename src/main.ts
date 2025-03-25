import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: '*', // Permite todas las solicitudes de cualquier origen. Puedes restringirlo a dominios específicos.
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    allowedHeaders: ['Content-Type', 'Accept', 'Authorization'], // Añadido Authorization
    credentials: true, // Importante si estás enviando cookies o credenciales

  });
  // Configuración de Swagger
  const config = new DocumentBuilder()
    .setTitle('Bestdealer APIS')
    .setDescription('Bestdealer')
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  app.setGlobalPrefix('api/v1');


  // app.useGlobalPipes(new ValidationPipe({
  //   whitelist: true,    // Ignora propiedades no declaradas en el DTO
  //   forbidNonWhitelisted: true, // Retorna un error si se pasan propiedades no válidas
  //   transform: true, // Transforma el payload de entrada en instancias de las clases DTO
  // }));

  await app.listen(4080);
}
bootstrap();
