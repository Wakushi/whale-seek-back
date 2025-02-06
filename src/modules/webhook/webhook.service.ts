import { Injectable, HttpException, HttpStatus, Inject } from '@nestjs/common';
import fetch from 'node-fetch';
import { SupabaseService } from '../supabase/supabase.service';
import { Collection } from '../supabase/entities/collections';
import { WebhookPayload } from './entities/webhook.type';

@Injectable()
export class WebhookService {
  constructor(
    @Inject('WEBHOOK_CONFIG')
    private readonly config: { alchemyAuthKey: string; webhookId: string },
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
    console.log('webhookData: ', webhookData);

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

      const processedTxs = new Set<string>();

      const transactions = webhookData.event.activity.map(async (activity) => {
        if (!activity) return null;

        if (processedTxs.has(activity.hash)) {
          console.log(`Skipping duplicate transaction: ${activity.hash}`);
          return null;
        }
        processedTxs.add(activity.hash);

        const transactionRecord = {
          transaction_hash: activity.hash,
          block_number: activity.blockNum,
          from_address: activity.fromAddress,
          to_address: activity.toAddress,
          contract_address:
            activity.category === 'token'
              ? activity.rawContract.address
              : activity.toAddress,
          value: activity.value,
          asset: activity.asset,
          category: activity.category,
          decimals: activity.rawContract.decimals,
          raw_value: activity.rawContract.rawValue,
          network: webhookData.event.network,
        };

        console.log('Transaction record to insert:', transactionRecord);

        return await this.supabaseService.insertSingle(
          Collection.TRANSACTIONS,
          transactionRecord,
        );
      });

      const results = (await Promise.all(transactions)).filter(
        (result) => result !== null,
      );

      return {
        success: true,
        message: `${results.length} transactions processed successfully`,
        data: results,
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
