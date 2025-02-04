import { Injectable } from '@nestjs/common';
import * as puppeteer from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';
import { CsvService } from 'src/shared/services/csv.service';
import {
  CoinCodexBaseTokenData,
  CoinCodexCsvDailyMetrics,
  CoinCodexTokenData,
  SupplyMetrics,
} from './entities/coin-codex.type';
import { access } from 'fs/promises';

@Injectable()
export class TokensService {
  private readonly COINGECKO_API = 'https://api.coingecko.com/api/v3';

  constructor(private readonly csvService: CsvService) {}
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
  
      const url = `${this.COINGECKO_API}/coins/${tokenId}?localization=false&tickers=true&market_data=true&community_data=true&developer_data=true&sparkline=true`;
      const response = await fetch(url);
  
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
  
      const data = await response.json();
      const marketData = data.market_data;
  
      return {
        // Informations de base
        name: data.name,
        symbol: data.symbol,
        description: data.description.en,
        genesis_date: data.genesis_date,
        categories: data.categories,
        
        // Données de marché
        market_data: {
          current_price: marketData.current_price,
          market_cap: marketData.market_cap,
          total_volume: marketData.total_volume,
          fully_diluted_valuation: marketData.fully_diluted_valuation,
          circulating_supply: marketData.circulating_supply,
          total_supply: marketData.total_supply,
          max_supply: marketData.max_supply,
          
          // Métriques de performance
          price_change_percentage: {
            '1h': marketData.price_change_percentage_1h_in_currency,
            '24h': marketData.price_change_percentage_24h_in_currency,
            '7d': marketData.price_change_percentage_7d_in_currency,
            '14d': marketData.price_change_percentage_14d_in_currency,
            '30d': marketData.price_change_percentage_30d_in_currency,
            '1y': marketData.price_change_percentage_1y_in_currency,
          },
          
          // Données de trading
          high_24h: marketData.high_24h,
          low_24h: marketData.low_24h,
          ath: marketData.ath,
          ath_date: marketData.ath_date,
          atl: marketData.atl,
          atl_date: marketData.atl_date,
        },
  
        // Données communautaires
        community_data: {
          twitter_followers: data.community_data.twitter_followers,
          reddit_subscribers: data.community_data.reddit_subscribers,
          reddit_average_posts_48h: data.community_data.reddit_average_posts_48h,
          reddit_average_comments_48h: data.community_data.reddit_average_comments_48h,
          telegram_channel_user_count: data.community_data.telegram_channel_user_count,
        },
  
        // Données développeurs
        developer_data: {
          forks: data.developer_data.forks,
          stars: data.developer_data.stars,
          subscribers: data.developer_data.subscribers,
          total_issues: data.developer_data.total_issues,
          closed_issues: data.developer_data.closed_issues,
          pull_requests_merged: data.developer_data.pull_requests_merged,
          pull_request_contributors: data.developer_data.pull_request_contributors,
          code_additions_4_weeks: data.developer_data.code_additions_deletions_4_weeks?.additions,
          code_deletions_4_weeks: data.developer_data.code_additions_deletions_4_weeks?.deletions,
          commit_count_4_weeks: data.developer_data.commit_count_4_weeks,
        },
  
        // Liens importants
        links: {
          homepage: data.links?.homepage,
          blockchain_site: data.links?.blockchain_site,
          official_forum_url: data.links?.official_forum_url,
          chat_url: data.links?.chat_url,
          announcement_url: data.links?.announcement_url,
          twitter_screen_name: data.links?.twitter_screen_name,
          telegram_channel_identifier: data.links?.telegram_channel_identifier,
          github_repo: data.links?.repos_url?.github,
        },
  
        // Liquidité et exchanges
        tickers: data.tickers?.map((ticker: any) => ({
          exchange: ticker.market.name,
          pair: ticker.target,
          volume: ticker.volume,
          trade_url: ticker.trade_url,
          trust_score: ticker.trust_score,
        })),
  
        // Score de confiance
        coingecko_scores: {
          developer_score: data.developer_score,
          community_score: data.community_score,
          liquidity_score: data.liquidity_score,
          public_interest_score: data.public_interest_score,
        },
      };
    } catch (error) {
      console.error('Error fetching token market data:', error);
      throw new Error('Failed to fetch token market data');
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

  public async fetchDailyMetrics(
    tokenSymbol: string,
  ): Promise<CoinCodexCsvDailyMetrics[]> {
    const filePath = `token-history/${tokenSymbol}.csv`;

    const fileExists = await access(filePath)
      .then(() => true)
      .catch(() => false);

    if (!fileExists) {
      console.log(
        `File ${filePath} does not exist. Attempting to download metrics...`,
      );
      try {
        await this.downloadCoinCodexCsv(tokenSymbol);
      } catch (error) {
        console.log(`Can't retrieve historical data for ${tokenSymbol}`);
        return [];
      }
    }

    try {
      return await this.csvService.getHistoricalTokenData(filePath);
    } catch (error) {
      console.log(`Error reading data for ${tokenSymbol}: ${error.message}`);
      return [];
    }
  }

  public async fetchSupplyMetrics(
    tokenSymbol: string,
  ): Promise<SupplyMetrics | null> {
    const response = await fetch(
      `https://coincodex.com/api/coincodex/get_coin/${tokenSymbol}`,
    );

    if (!response.ok) {
      return null;
    }

    const data: CoinCodexTokenData = await response.json();

    const totalSupply = Number(data.total_supply);
    const circulatingSupply = data.supply;

    return {
      name: data.slug.toLowerCase(),
      fully_diluted_valuation: totalSupply * data.last_price_usd,
      circulating_supply: circulatingSupply,
      total_supply: totalSupply,
      max_supply: totalSupply,
      supply_ratio: circulatingSupply / totalSupply,
    };
  }

  private async downloadCoinCodexCsv(tokenSymbol: string): Promise<boolean> {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      const downloadPath = path.join(process.cwd(), 'token-history');
      const downloadFolder = path.resolve(downloadPath);
      await fs.promises.mkdir(downloadFolder, { recursive: true });

      const page = await browser.newPage();

      await page.setRequestInterception(true);
      const cdpSession = await page.target().createCDPSession();
      await cdpSession.send('Page.setDownloadBehavior', {
        behavior: 'allow',
        downloadPath: downloadFolder,
      });

      page.on('request', (request) => {
        try {
          request.continue();
        } catch (error) {
          console.error(`Request interception error: ${error.message}`);
          request.abort('failed');
        }
      });

      const url = `https://coincodex.com/crypto/${tokenSymbol}/historical-data`;
      const altUrl = `https://coincodex.com/crypto/${tokenSymbol}-token/historical-data`;

      const EXPORT_BUTTON_SELECTOR = '.export';
      const DATE_SELECT_BUTTON_SELECTOR = '.date-select';

      await page.goto(url);

      try {
        await page.waitForSelector(DATE_SELECT_BUTTON_SELECTOR, {
          timeout: 5000,
        });
      } catch (error) {
        console.log(`Wrong page at url ${url}, trying with '-token' suffix...`);

        await page.goto(altUrl);

        await page.waitForSelector(DATE_SELECT_BUTTON_SELECTOR, {
          timeout: 5000,
        });
      }

      await page.click(DATE_SELECT_BUTTON_SELECTOR);

      await page.waitForSelector('.calendars', {
        timeout: 5000,
      });

      const firstInput = await page.waitForSelector(
        '.calendars input[type="date"]:first-of-type',
        {
          timeout: 5000,
        },
      );

      await firstInput.type('01011970');

      await page.waitForSelector('.select button.button.button-primary', {
        timeout: 5000,
      });

      const buttonText = await page.evaluate(() => {
        const button = document.querySelector(
          '.select button.button.button-primary',
        );
        return button ? button.textContent.trim() : null;
      });

      if (buttonText === 'Select') {
        await page.click('.select button.button.button-primary');
      } else {
        throw new Error(
          `Expected to find "Select" button but found "${buttonText}" instead`,
        );
      }

      await page.evaluate(
        () => new Promise((resolve) => setTimeout(resolve, 3000)),
      );

      await page.waitForSelector(EXPORT_BUTTON_SELECTOR, {
        timeout: 5000,
        visible: true,
      });

      await page.evaluate((selector) => {
        const button = document.querySelector(selector) as HTMLButtonElement;
        if (button) button.click();
      }, EXPORT_BUTTON_SELECTOR);

      const downloadTimeout = 30000;
      const checkInterval = 1000;
      let elapsed = 0;

      const existingFiles = new Set(await fs.promises.readdir(downloadFolder));

      while (elapsed < downloadTimeout) {
        const currentFiles = await fs.promises.readdir(downloadFolder);

        const newCompletedFiles = currentFiles.filter(
          (file) => !file.endsWith('.crdownload') && !existingFiles.has(file),
        );

        if (newCompletedFiles.length > 0) {
          const downloadedFile = newCompletedFiles[0];

          console.log('Downloaded file ' + downloadedFile);

          const oldPath = path.join(downloadFolder, downloadedFile);
          const fileExtension = path.extname(downloadedFile);
          const newFile = `${tokenSymbol}${fileExtension}`;
          const newPath = path.join(downloadFolder, newFile);

          await fs.promises.rename(oldPath, newPath);
          return true;
        }

        await new Promise((resolve) => setTimeout(resolve, checkInterval));
        elapsed += checkInterval;
      }

      throw new Error('Download timeout exceeded');
    } catch (error) {
      console.error(`Download failed: ${error.message}`);
      return false;
    } finally {
      await browser.close();
    }
  }

  public async getCoinCodexCoinList(): Promise<CoinCodexBaseTokenData[]> {
    const url = 'https://coincodex.com/apps/coincodex/cache/all_coins.json';

    try {
      const response = await fetch(url);

      const data: CoinCodexBaseTokenData[] = await response.json();

      return data;
    } catch (error) {
      console.error('Error fetching coin codex list: ', error);
      return [];
    }
  }
}
