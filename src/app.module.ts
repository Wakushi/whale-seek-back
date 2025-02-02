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
import { BlockExplorerModule } from './modules/block-explorer/block-explorer.module';
import { ContractModule } from './modules/contract/contract.module';
import { BraveModule } from './modules/brave/brave.module';

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
      network: Network.BASE_MAINNET,
    }),
    SupabaseModule.forRoot({
      privateKey: process.env.SUPABASE_API_KEY,
      url: process.env.SUPABASE_URL,
    }),
    TokensModule.forRoot(),
    GraphModule.forRoot({ graphApiKey: process.env.GRAPH_API_KEY }),
    BraveModule.forRoot({apiKey: process.env.BRAVE_API_KEY}),
    AnalysisModule.forRoot(),
    BlockExplorerModule.forRoot({ apiKey: process.env.BASESCAN_API_KEY }),
    ContractModule.forRoot({
      rpcUrl: `https://base-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
    }),
  ],
})
export class AppModule {}
