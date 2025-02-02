import { DynamicModule, Module } from '@nestjs/common';
import { ContractService } from './contract.service';

@Module({})
export class ContractModule {
  static forRoot(config: { rpcUrl: string }): DynamicModule {
    return {
      module: ContractModule,
      providers: [
        {
          provide: 'CONTRACT_CONFIG',
          useValue: config,
        },
        ContractService,
      ],
      exports: [ContractService],
      global: true,
    };
  }
}
