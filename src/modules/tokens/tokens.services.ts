import { Injectable } from '@nestjs/common';

@Injectable()
export class TokensService {
  private readonly COINGECKO_API = 'https://api.coingecko.com/api/v3';

  /**
   * Gets market data for a token by its name.
   * @param tokenName - The token name (e.g. "bitcoin", "ethereum").
   * @returns The market data (price, volume, market cap, etc.).
   */
  async getTokenMarketDataById(tokenName: string): Promise<any> {
    try {
      const tokenId = await this.getTokenIdByName(tokenName);

      if (!tokenId) {
        throw new Error(`Token with name "${tokenName}" not found.`);
      }

      const url = `${this.COINGECKO_API}/coins/${tokenId}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();
      const marketData = data.market_data;

      return {
        name: data.name,
        symbol: data.symbol,
        currentPrice: marketData.current_price.usd,
        marketCap: marketData.market_cap.usd,
        totalVolume: marketData.total_volume.usd,
        priceChange24h: marketData.price_change_percentage_24h,
      };
    } catch (error) {
      console.error('Error fetching token market data by name:', error);
      throw new Error('Failed to fetch token market data by name');
    }
  }

  /**
   * Gets a token ID by its name.
   * @param tokenName - The token name (e.g. "bitcoin", "ethereum").
   * @returns The token ID.
   */
  async getTokenIdByName(tokenName: string): Promise<string | null> {
    try {
      const url = `${this.COINGECKO_API}/coins/list`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const tokens = await response.json();

      const token = tokens.find(
        (t: any) =>
          t.name.toLowerCase() === tokenName.toLowerCase() ||
          t.symbol.toLowerCase() === tokenName.toLowerCase(),
      );

      return token ? token.id : null;
    } catch (error) {
      console.error('Error fetching token ID by name:', error);
      throw new Error('Failed to fetch token ID by name');
    }
  }
}
