import { Module } from '@nestjs/common';
import { OpenAIModule } from './modules/openai/openai.module';
import { AlchemyModule } from './modules/alchemy/alchemy.module';
import { Network } from 'alchemy-sdk';
import { TokensModule } from './modules/tokens/tokens.module';
import { DiscoveryModule } from './modules/discovery/discovery.module';
import { GraphModule } from './modules/graph/graph.module';
import { ConfigModule } from '@nestjs/config';
import { envSchema } from 'config/env.validation';
import { SupabaseModule } from './modules/supabase/supabase.module';
import { AnalysisModule } from './modules/analysis/analysis.module';

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
    SupabaseModule.forRoot({
      privateKey: process.env.SUPABASE_API_KEY,
      url: process.env.SUPABASE_URL,
    }),
    TokensModule.forRoot(),
    GraphModule.forRoot({ graphApiKey: process.env.GRAPH_API_KEY }),
    AnalysisModule,
  ],
})
export class AppModule {}
