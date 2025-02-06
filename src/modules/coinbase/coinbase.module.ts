import { DynamicModule, Module } from '@nestjs/common';
import { CoinbaseService } from './coinbase.service';
import { AgentToolService } from './agent-tool.service';

@Module({})
export class CoinbaseModule {
  static forRoot(config: {
    cdpKeyName: string;
    cdpPrivateKey: string;
    networkId: string;
    privateKey: string;
  }): DynamicModule {
    return {
      module: CoinbaseModule,
      providers: [
        {
          provide: 'COINBASE_CONFIG',
          useValue: config,
        },
        CoinbaseService,
        AgentToolService,
      ],
      exports: [CoinbaseService],
      global: true,
    };
  }
}
