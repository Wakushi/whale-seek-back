import {
  Injectable,
  HttpException,
  HttpStatus,
  Inject,
  Logger,
} from '@nestjs/common';
import fetch from 'node-fetch';
import { WebhookPayload } from './entities/webhook.type';
import { TransactionsService } from '../transactions/transactions.service';

@Injectable()
export class WebhookService {
  processedTransactions: Set<string> = new Set();

  private readonly logger = new Logger(WebhookService.name);

  constructor(
    @Inject('WEBHOOK_CONFIG')
    private readonly config: { alchemyAuthKey: string; webhookId: string },
    private readonly transactionsService: TransactionsService,
  ) {}

  async addAddresses(updateDto: { addresses_to_add: string[] }) {
    try {
      const response = await fetch(
        'https://dashboard.alchemy.com/api/update-webhook-addresses',
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'X-Alchemy-Token': this.config.alchemyAuthKey,
          },
          body: JSON.stringify({
            webhook_id: this.config.webhookId,
            addresses_to_add: updateDto.addresses_to_add || [],
            addresses_to_remove: [],
          }),
        },
      );

      if (!response.ok) {
        throw new HttpException(await response.text(), response.status);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to add webhook addresses',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async removeAddresses(updateDto: {
    webhook_id: string;
    addresses_to_remove: string[];
  }) {
    try {
      const response = await fetch(
        'https://dashboard.alchemy.com/api/update-webhook-addresses',
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'X-Alchemy-Token': this.config.alchemyAuthKey,
          },
          body: JSON.stringify({
            webhook_id: this.config.webhookId,
            addresses_to_add: [],
            addresses_to_remove: updateDto.addresses_to_remove || [],
          }),
        },
      );

      if (!response.ok) {
        throw new HttpException(await response.text(), response.status);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to remove webhook addresses',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async processTransaction(webhookData: WebhookPayload) {
    try {
      if (
        !webhookData?.event?.activity ||
        !Array.isArray(webhookData.event.activity)
      ) {
        return {
          success: true,
          message: 'No transactions to process',
          data: [],
        };
      }

      for (const activity of webhookData.event.activity) {
        if (
          this.processedTransactions.has(activity.hash) ||
          activity.category !== 'token'
        ) {
          continue;
        }

        this.logger.log(
          `Processing ${webhookData.id} for hash ${activity.hash}...`,
        );

        await this.transactionsService.recordWebhookEvent(
          activity,
          webhookData.event.network,
        );

        this.processedTransactions.add(activity.hash);
      }

      return {
        success: true,
        message: `Transactions processed successfully`,
      };
    } catch (error) {
      console.error('Error processing transaction:', error);
      throw new HttpException(
        'Failed to process transaction',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
