import { Inject, Injectable } from '@nestjs/common';
import { Alchemy, Network, TokenBalanceType } from 'alchemy-sdk';

@Injectable()
export class AlchemyService {
  public _client: Alchemy;

  constructor(
    @Inject('ALCHEMY_CONFIG')
    private readonly config: { apiKey: string; network: Network },
  ) {
    this._client = new Alchemy({
      apiKey: config.apiKey,
      network: config.network,
    });

    this.getTokenBalances = this.getTokenBalances.bind(this);
  }

  async getTokenBalances(walletAddress: string): Promise<any> {
    try {
      if (!this._client) {
        throw new Error('Alchemy client is not initialized.');
      }

      const balances = await this._client.core.getTokenBalances(walletAddress, {
        type: TokenBalanceType.ERC20,
      });

      return balances;
    } catch (error) {
      console.error('Error fetching token balances:', error);
      throw new Error('Failed to fetch token balances');
    }
  }

  public get client() {
    return this._client;
  }
}