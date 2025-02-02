import { DynamicModule, Module } from '@nestjs/common';
import { BraveService } from './brave.service';

@Module({})
export class BraveModule {
  static forRoot(config: { apiKey: string }): DynamicModule {
    return {
      module: BraveModule,
      providers: [
        {
          provide: 'BRAVE_CONFIG',
          useValue: config,
        },
        BraveService,
      ],
      exports: [BraveService],
      global: true,
    };
  }
}