import { Injectable } from '@nestjs/common';
import { TransactionRecord } from './entities/transaction.entity';
import { SupabaseService } from '../supabase/supabase.service';
import { Collection } from '../supabase/entities/collections';
import { Activity } from '../webhook/entities/webhook.type';

@Injectable()
export class TransactionsService {
  constructor(private readonly supabaseService: SupabaseService) {}

  public async findAll(): Promise<TransactionRecord[]> {
    return await this.supabaseService.getAll<TransactionRecord>(
      Collection.TRANSACTIONS,
    );
  }

  public async recordWebhookEvent(
    activity: Activity,
    network: string,
  ): Promise<void> {
    const transactionRecord = {
      transaction_hash: activity.hash,
      block_number: activity.blockNum,
      from_address: activity.fromAddress,
      to_address: activity.toAddress,
      contract_address: activity.rawContract.address,
      value: activity.value,
      asset: activity.asset,
      category: activity.category,
      decimals: activity.rawContract.decimals,
      raw_value: activity.rawContract.rawValue,
      network: network,
    };

    await this.saveTransaction(transactionRecord);
  }

  private async saveTransaction(transaction: TransactionRecord): Promise<void> {
    await this.supabaseService.insertSingle(
      Collection.TRANSACTIONS,
      transaction,
    );
  }
}
