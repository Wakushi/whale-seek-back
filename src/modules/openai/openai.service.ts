import OpenAI from 'openai';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { AgentToolService } from './agent-tools.service';

@Injectable()
export class OpenAIService {
  private openai: OpenAI;

  private readonly logger = new Logger(OpenAIService.name);

  constructor(
    @Inject('OPENAI_CONFIG') private readonly config: { openAiApiKey: string },
    private readonly toolService: AgentToolService,
  ) {
    this.openai = new OpenAI({
      apiKey: config.openAiApiKey,
    });
  }

  public async askAgent(userQuery: string): Promise<string> {
    const start = Date.now();

    this.logger.log('Agent starting task..');

    const runner = this.openai.beta.chat.completions
      .runTools({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: userQuery }],
        tools: this.toolService.tools,
      })
      .on('message', (message: any) => this.logAgentProcess(message));

    const finalContent = await runner.finalContent();

    const duration = Date.now() - start;
    this.logger.log(`Agent completed task! (${duration}ms)`);

    return finalContent;
  }

  private logAgentProcess(message: any): void {
    const isUsingTool = !!message.tool_calls?.length;

    if (!isUsingTool) return;

    message.tool_calls.forEach((tool: any) => {
      let info = '';

      switch (tool.function.name) {
        case 'getTokenBalances':
          info = 'Retrieving wallet token balance';
          break;

        case 'getTokenMarketDataById':
          info = 'Searching for token market data';
          break;

        default:
          info = 'Computing...';
      }

      this.logger.log(info);
    });
  }
}
