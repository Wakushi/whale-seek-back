import { Inject, Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { AlchemyService } from '../alchemy/alchemy.service';
import { TokensService } from '../tokens/tokens.services';

@Injectable()
export class OpenAIService {
  private openai: OpenAI;

  constructor(
    @Inject('OPENAI_CONFIG') private readonly config: { openai: string },
    private alchemyService: AlchemyService,
    private tokensService: TokensService,
  ) {
    this.openai = new OpenAI({
      apiKey: config.openai,
    });
  }

  tools: any[] = [
    {
      type: 'function',
      function: {
        description: 'Retrieves the ERC-20 token balances for a given wallet address.',
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
        description: 'Retrieves the market data of a token based on its ID.',
        parse: JSON.parse,
        parameters: {
          type: 'object',
          properties: {
            tokenName: { type: 'string' },
          },
        },
        function: (tokenName: any) => this.tokensService.getTokenMarketDataById(tokenName.tokenName),
      },
    },
  ];

  async queryWallet(userQuery: string): Promise<string> {
    const runner = this.openai.beta.chat.completions
      .runTools({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: userQuery }],
        tools: this.tools,
      })
      .on('message', (message) => console.log(message));

    const finalContent = await runner.finalContent();

    return finalContent;
  }
}