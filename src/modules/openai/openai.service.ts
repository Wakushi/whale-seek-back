import OpenAI from 'openai';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { AgentToolService } from './agent-tools.service';
import { zodResponseFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import {
  Agent,
  AnalystResponseFormat,
  RouterResponseFormat,
  GeneralResponseFormat,
  AgentResponse,
  AgentResponseRegistry,
} from './entities/agent.type';
import { ROUTER_PROMPT } from './entities/prompts/router.prompt';
import { TOKEN_ANALYST_PROMPT } from './entities/prompts/token-analyst.prompt';
import { GENERAL_PROMPT } from './entities/prompts/general.prompt';

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

  public async askAgent(userQuery: string): Promise<AgentResponse> {
    const start = Date.now();

    this.logger.log('Agent starting task..');

    const routerAgentCompletion = await this.openai.beta.chat.completions.parse(
      this.buildAgent(userQuery, Agent.ROUTER),
    );

    const routerResponse = this.parseAnswer<
      z.infer<typeof RouterResponseFormat>
    >(routerAgentCompletion);

    this.logger.log(`Routing query to ${routerResponse.agent} agent...`);

    const runner = this.openai.beta.chat.completions
      .runTools(this.buildAgent(userQuery, routerResponse.agent))
      .on('message', (message: any) => this.logAgentProcess(message));

    const rawContent = await runner.finalContent();

    const responseSchema = AgentResponseRegistry[routerResponse.agent];
    const parsedResponse = responseSchema.parse(JSON.parse(rawContent));

    this.logger.log(`Agent completed task! (${Date.now() - start}ms)`);

    return parsedResponse;
  }

  private buildAgent(query: string, agentType: Agent): any {
    const GENERAL_AGENT = {
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: GENERAL_PROMPT,
        },
        { role: 'user', content: query },
      ],
      tools: this.toolService.getAgentTools(Agent.GENERAL),
      response_format: zodResponseFormat(GeneralResponseFormat, 'event'),
    };

    switch (agentType) {
      case Agent.ROUTER:
        return {
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: ROUTER_PROMPT,
            },
            { role: 'user', content: query },
          ],
          response_format: zodResponseFormat(RouterResponseFormat, 'event'),
        };
      case Agent.GENERAL:
        return GENERAL_AGENT;
      case Agent.TOKEN_ANALYST:
        return {
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: TOKEN_ANALYST_PROMPT,
            },
            { role: 'user', content: query },
          ],
          tools: this.toolService.getAgentTools(Agent.TOKEN_ANALYST),
          response_format: zodResponseFormat(AnalystResponseFormat, 'event'),
        };
      default:
        return GENERAL_AGENT;
    }
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

  private parseAnswer<T>(completion: any): T {
    try {
      return JSON.parse(completion.choices[0].message.content) as T;
    } catch (error) {
      throw new Error('Failed to parse agent response');
    }
  }
}
