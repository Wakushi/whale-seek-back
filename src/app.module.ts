import { Module } from '@nestjs/common';
import { OpenAIModule } from './modules/openai/openai.module';
import { OpenAIController } from './modules/openai/openai.controllers';
import { ConfigModule } from '@nestjs/config';
import { envSchema } from './config/env.validation';
import { AlchemyModule } from './modules/alchemy/alchemy.module';
import { Network } from 'alchemy-sdk';
import { TokensModule } from './modules/tokens/tokens.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      validate: (config) => envSchema.parse(config),
      isGlobal: true,
    }),
    OpenAIModule.forRoot({
      openai: process.env.OPENAI_API_KEY,
    }),
    AlchemyModule.forRoot({
      apiKey: process.env.ALCHEMY_API_KEY,
      network: Network.BASE_SEPOLIA,
    }),
    TokensModule.forRoot(),
  ],

  controllers: [OpenAIController],
})
export class AppModule {}
