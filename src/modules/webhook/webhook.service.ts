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
import { SupabaseService } from '../supabase/supabase.service';
import { Collection } from '../supabase/entities/collections';
import { Whale } from '../discovery/entities/discovery.type';
import { getAddress } from 'viem';

@Injectable()
export class WebhookService {
  processedTransactions: Set<string> = new Set();

  private readonly logger = new Logger(WebhookService.name);

  constructor(
    @Inject('WEBHOOK_CONFIG')
    private readonly config: { alchemyAuthKey: string; webhookId: string },
    private readonly transactionsService: TransactionsService,
    private readonly supabaseService: SupabaseService,
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

        console.log('=========================');

        console.log(
          `Analyzing activity:\n` +
            `  Asset:    ${activity.asset}\n` +
            `  Value:    ${activity.value}\n` +
            `  From:     ${activity.fromAddress}\n` +
            `  To:       ${activity.toAddress}\n` +
            `  Contract: ${activity.rawContract.address}\n` +
            `  Hash:     ${activity.hash}`,
        );

        this.logger.log(
          `Processing ${webhookData.id} for hash ${activity.hash}...`,
        );

        const swapInfo =
          await this.transactionsService.extractSwapInfo(activity);

        if (!swapInfo) {
          this.logger.log('Could not extract swap information.');
          return;
        }

        console.log('Swap: ', swapInfo);

        const whales = await this.supabaseService.getAll<Whale>(
          Collection.WHALE_INFO,
        );

        this.logger.log(
          `Searching for origin whale ${swapInfo.initiator} in ${whales.length} whales collection..`,
        );

        const whale = whales.find(
          (w) => getAddress(w.whale_address) === swapInfo.initiator,
        );

        if (!whale) {
          this.logger.log(
            `No whale found for ${activity.fromAddress} | ${activity.toAddress} addresses`,
          );
          return;
        }

        this.processedTransactions.add(activity.hash);

        this.logger.log(
          `Added tx ${activity.hash} to processed transactions !`,
        );

        await this.transactionsService.recordWebhookEvent(
          activity,
          swapInfo,
          webhookData.event.network,
        );
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
