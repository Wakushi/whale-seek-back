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
