import { Injectable } from '@nestjs/common';
import { AlchemyService } from '../alchemy/alchemy.service';
import { TokensService } from '../tokens/tokens.services';
import { BraveService } from '../brave/brave.service';

@Injectable()
export class AgentToolService {
  constructor(
    private alchemyService: AlchemyService,
    private tokensService: TokensService,
    private braveService: BraveService,
  ) {}

  public tools: any[] = [
    {
      type: 'function',
      function: {
        name: 'getTokenBalances',
        description:
          'Retrieves the ERC-20 token balances for a given wallet address.',
        parse: JSON.parse,
        strict: true,
        parameters: {
          type: 'object',
          properties: {
            walletAddress: {
              type: 'string',
            },
          },
          required: ['walletAddress'],
          additionalProperties: false,
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
        strict: true,
        parameters: {
          type: 'object',
          properties: {
            tokenName: { type: 'string' },
          },
          required: ['tokenName'],
          additionalProperties: false,
        },
        function: (tokenName: any) =>
          this.tokensService.getTokenMarketDataById(tokenName.tokenName),
      },
    },
    {
      type: 'function',
      function: {
        name: 'search',
        description: 'Perform an internet search',
        parse: JSON.parse,
        strict: true,
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string' },
          },
          required: ['query'],
          additionalProperties: false,
        },
        function: (query: any) => this.braveService.search(query.query),
      },
    },
  ];
}
