import { Inject, Injectable } from '@nestjs/common';
import { Alchemy, Network, TokenBalanceType } from 'alchemy-sdk';
import { hexToDecimal } from 'src/utils/math.helper';

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
  }

  public get client() {
    return this._client;
  }

  /**
   * Gets and formats token balances for an address.
   * @param walletAddress - The wallet address.
   * @returns The formatted token balances.
   */
  public async getTokenBalances(walletAddress: string): Promise<any> {
    try {
      const balances = await this.client.core.getTokenBalances(walletAddress, {
        type: TokenBalanceType.ERC20,
      });

      const formattedBalances = await Promise.all(
        balances.tokenBalances.map(async (balance) => {
          const metadata = await this.getTokenMetadata(balance.contractAddress);

          const tokenAmount = hexToDecimal(
            balance.tokenBalance,
            metadata.decimals,
          );

          const tokenPrice = await this.getTokenPriceInUSD(
            balance.contractAddress,
          );

          const valueInUSD = tokenAmount * tokenPrice;

          return {
            contractAddress: balance.contractAddress,
            name: metadata.name,
            symbol: metadata.symbol,
            balance: tokenAmount.toFixed(4),
            valueInUSD: valueInUSD.toFixed(2),
          };
        }),
      );

      return {
        address: walletAddress,
        tokens: formattedBalances,
      };
    } catch (error) {
      console.error('Error fetching token balances:', error);
      throw new Error('Failed to fetch token balances');
    }
  }

  /**
   * Gets a token's metadata (name, symbol, decimals).
   * @param contractAddress - The token's contract address.
   * @returns The token's metadata.
   */
  public async getTokenMetadata(contractAddress: string): Promise<{
    name: string;
    symbol: string;
    decimals: number;
  }> {
    try {
      const metadata = await this.client.core.getTokenMetadata(contractAddress);
      return {
        name: metadata.name || 'Unknown Token',
        symbol: metadata.symbol || 'UNKNOWN',
        decimals: metadata.decimals || 18,
      };
    } catch (error) {
      console.error('Error fetching token metadata:', error);
      return {
        name: 'Unknown Token',
        symbol: 'UNKNOWN',
        decimals: 18,
      };
    }
  }

  /**
   * Gets a token's price in USD .
   * @param contractAddress - The token's contract address.
   * @returns The token's price in USD.
   */
  private async getTokenPriceInUSD(contractAddress: string): Promise<number> {
    return 0;
  }
}
