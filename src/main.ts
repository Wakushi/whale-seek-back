import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Ajouter la configuration CORS
  app.enableCors({
    origin: 'http://localhost:3000', // l'URL de votre frontend Next.js
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Accept'],
  });

  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();