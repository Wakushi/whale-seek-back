import OpenAI from 'openai';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { AlchemyService } from '../alchemy/alchemy.service';
import { TokensService } from '../tokens/tokens.services';
import { BraveService } from '../brave/brave.service';

@Injectable()
export class OpenAIService {
  private openai: OpenAI;

  private readonly logger = new Logger(OpenAIService.name);

  private tools: any[] = [
    {
      type: 'function',
      function: {
        name: 'getTokenBalances',
        description:
          'Retrieves the ERC-20 token balances for a given wallet address.',
        parse: JSON.parse,
        parameters: {
          type: 'object',
          properties: {
            walletAddress: {
              type: 'string',
            },
          },
        },
        function: (wallet: any) =>
          this.alchemyService.getTokenBalances(wallet.walletAddress),
      },
    },
    {
      type: 'function',
      function: {
        name: 'getTokenMarketDataById',
        description: 'Retrieves the market data of a token based on its ID.',
        parse: JSON.parse,
        parameters: {
          type: 'object',
          properties: {
            tokenName: { type: 'string' },
          },
        },
        function: (tokenName: any) =>
          this.tokensService.getTokenMarketDataById(tokenName.tokenName),
      },
    },
    {
      type: 'function',
      function: {
        name: "search",
        description : 'internet search',
        parse: JSON.parse,
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string' },
          },
        },
        function: (query: any) => this.braveService.search(query.query)
      }
    }
  ];

  constructor(
    @Inject('OPENAI_CONFIG') private readonly config: { openAiApiKey: string },
    private alchemyService: AlchemyService,
    private tokensService: TokensService,
    private braveService: BraveService
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
        tools: this.tools,
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
      console.log(tool)

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
