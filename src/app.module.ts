import { Module } from '@nestjs/common';
import { OpenAIModule } from './modules/openai/openai.module';
import { AlchemyModule } from './modules/alchemy/alchemy.module';
import { Network } from 'alchemy-sdk';
import { TokensModule } from './modules/tokens/tokens.module';
import { DiscoveryModule } from './modules/discovery/discovery.module';
import { GraphModule } from './modules/graph/graph.module';
import { ConfigModule } from '@nestjs/config';
import { envSchema } from 'config/env.validation';

@Module({
  imports: [
    DiscoveryModule,
    ConfigModule.forRoot({
      validate: (config) => envSchema.parse(config),
      isGlobal: true,
    }),
    OpenAIModule.forRoot({
      openAiApiKey: process.env.OPENAI_API_KEY,
    }),
    AlchemyModule.forRoot({
      apiKey: process.env.ALCHEMY_API_KEY,
      network: Network.BASE_SEPOLIA,
    }),
    TokensModule.forRoot(),
    GraphModule.forRoot({ graphApiKey: process.env.GRAPH_API_KEY }),
  ],
})
export class AppModule {}
