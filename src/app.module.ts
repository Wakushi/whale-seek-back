import { Module } from '@nestjs/common';
import { OpenAIModule } from './modules/openai.module';
import { OpenAIController } from './controllers/openai.controllers';
import { ConfigModule } from '@nestjs/config';
import { envSchema } from './config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      validate: (config) => envSchema.parse(config),
      isGlobal: true,
    }),
    OpenAIModule.forRoot({
      openai: process.env.OPENAI_API_KEY,
    }),
  ],

  controllers: [OpenAIController],
})
export class AppModule {}
