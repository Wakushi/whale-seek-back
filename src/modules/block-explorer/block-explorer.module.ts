import { DynamicModule, Module } from '@nestjs/common';
import { BlockExplorerService } from './block-explorer.service';

@Module({
  providers: [BlockExplorerService],
})
export class BlockExplorerModule {
  static forRoot(config: { apiKey: string }): DynamicModule {
    return {
      module: BlockExplorerModule,
      providers: [
        {
          provide: 'BASESCAN_CONFIG',
          useValue: config,
        },
        BlockExplorerService,
      ],
      exports: [BlockExplorerService],
      global: true,
    };
  }
}
