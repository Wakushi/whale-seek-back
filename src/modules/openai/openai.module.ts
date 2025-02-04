import { AgentToolService } from './agent-tools.service';
import { OpenAIController } from './openai.controllers';
import { OpenAIService } from './openai.service';
import { DynamicModule, Module } from '@nestjs/common';

@Module({})
export class OpenAIModule {
  static forRoot(config: { openAiApiKey: string }): DynamicModule {
    return {
      module: OpenAIModule,
      providers: [
        {
          provide: 'OPENAI_CONFIG',
          useValue: config,
        },
        OpenAIService,
        AgentToolService,
      ],
      exports: [OpenAIService],
      controllers: [OpenAIController],
      global: true,
    };
  }
}
