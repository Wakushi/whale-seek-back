import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import fetch from 'node-fetch';
import { SupabaseService } from '../supabase/supabase.service';
import { Collection } from '../supabase/entities/collections';


@Injectable()
export class WebhookService {
  constructor(private readonly supabaseService: SupabaseService) {}
  async updateAddresses(token: string, updateDto) {
    try {
      const response = await fetch(
        'https://dashboard.alchemy.com/api/update-webhook-addresses',
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'X-Alchemy-Token': token,
          },
          body: JSON.stringify({
            webhook_id: updateDto.webhook_id,
            addresses_to_add: updateDto.addresses_to_add || [],
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
        'Failed to update webhook addresses',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
  
  async processTransaction(webhookData) {
    try {
      const transactions = webhookData.event.activity.map(async (activity) => {
        console.log('Processing activity:', activity);

        const transactionRecord = {
          transaction_hash: activity.hash,
          from_address: activity.fromAddress,
          to_address: activity.toAddress,
          contract_address: activity.toAddress, 
          value: activity.value,
        };

        console.log('Transaction record to insert:', transactionRecord);

        return await this.supabaseService.insertSingle(
          Collection.TRANSACTIONS,
          transactionRecord
        );
      });

      const results = await Promise.all(transactions);

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

