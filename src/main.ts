import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  app.enableCors({
    origin: ['http://localhost:3000', 'https://dashboard.alchemy.com'], // l'URL de votre frontend Next.js
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Accept', 'X-Alchemy-Token'],
  });
  

  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();