import { Inject, Injectable, Logger } from '@nestjs/common';

@Injectable()
export class BraveService {
  private readonly logger = new Logger(BraveService.name);

  constructor(
    @Inject('BRAVE_CONFIG') private readonly config: { apiKey: string },
  ) {}

  public async search(query: string): Promise<any> {
    const start = Date.now();
    this.logger.log('Starting Brave news search...');
    this.logger.debug(`Search query: ${query}`);

    try {
      const url = new URL('https://api.search.brave.com/res/v1/news/search');
      url.searchParams.append('q', query);

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip',
          'X-Subscription-Token': this.config.apiKey,
        },
      });

      if (!response.ok) {
        const errorBody = await response.text();
        this.logger.error(
          `HTTP error! Status: ${response.status}, Body: ${errorBody}`,
        );
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();

      const duration = Date.now() - start;
      this.logger.log(`Brave news search completed! (${duration}ms)`);

      return data;
    } catch (error) {
      this.logger.error('Error during Brave news search:', error);
      throw error;
    }
  }
}
