import { OpenAIService } from './openai.service';
import { DynamicModule, Module } from '@nestjs/common';

@Module({})
export class OpenAIModule {
  static forRoot(config: { openai: string }): DynamicModule {
    return {
      module: OpenAIModule,
      providers: [
        {
          provide: 'OPENAI_CONFIG',
          useValue: config,
        },
        OpenAIService,
      ],
      exports: [OpenAIService],
      global: true,
    };
  }
}
