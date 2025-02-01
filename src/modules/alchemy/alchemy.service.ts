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

  /**
   * Convertit un solde hexadécimal en une valeur décimale lisible.
   * @param hexBalance - Le solde en hexadécimal.
   * @param decimals - Le nombre de décimales du token.
   * @returns Le solde en unités du token.
   */
  private hexToDecimal(hexBalance: string, decimals: number): number {
    const decimalBalance = BigInt(hexBalance);
    return Number(decimalBalance) / Math.pow(10, decimals);
  }

  /**
   * Récupère les métadonnées d'un token (nom, symbole, décimales).
   * @param contractAddress - L'adresse du contrat du token.
   * @returns Les métadonnées du token.
   */
  private async getTokenMetadata(contractAddress: string): Promise<{
    name: string;
    symbol: string;
    decimals: number;
  }> {
    try {
      const metadata = await this._client.core.getTokenMetadata(contractAddress);
      return {
        name: metadata.name || 'Unknown Token',
        symbol: metadata.symbol || 'UNKNOWN',
        decimals: metadata.decimals || 18, // Par défaut, 18 décimales
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
   * Récupère le prix d'un token en USD via CoinGecko.
   * @param contractAddress - L'adresse du contrat du token.
   * @returns Le prix du token en USD.
   */
  private async getTokenPriceInUSD(contractAddress: string): Promise<number> {
    try {
      const url = `https://api.coingecko.com/api/v3/simple/token_price/ethereum?contract_addresses=${contractAddress}&vs_currencies=usd`;
      const response = await fetch(url);
      const data = await response.json();
      return data[contractAddress.toLowerCase()]?.usd || 0;
    } catch (error) {
      console.error('Error fetching token price:', error);
      return 0;
    }
  }

  /**
   * Récupère et formate les soldes de tokens d'une adresse.
   * @param walletAddress - L'adresse du portefeuille.
   * @returns Les soldes de tokens formatés.
   */
  async getTokenBalances(walletAddress: string): Promise<any> {
    try {
      if (!this._client) {
        throw new Error('Alchemy client is not initialized.');
      }

      // Récupérer les soldes bruts
      const balances = await this._client.core.getTokenBalances(walletAddress, {
        type: TokenBalanceType.ERC20,
      });

      // Formater les soldes
      const formattedBalances = await Promise.all(
        balances.tokenBalances.map(async (balance) => {
          const metadata = await this.getTokenMetadata(balance.contractAddress);
          const tokenValue = this.hexToDecimal(balance.tokenBalance, metadata.decimals);
          const tokenPrice = await this.getTokenPriceInUSD(balance.contractAddress);
          const valueInUSD = tokenValue * tokenPrice;

          return {
            contractAddress: balance.contractAddress,
            name: metadata.name,
            symbol: metadata.symbol,
            balance: tokenValue.toFixed(4), 
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

  public get client() {
    return this._client;
  }
}