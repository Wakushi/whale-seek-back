import { Injectable } from '@nestjs/common';
import { TransactionRecord } from './entities/transaction.entity';
import { SupabaseService } from '../supabase/supabase.service';
import { Collection } from '../supabase/entities/collections';
import { Activity } from '../webhook/entities/webhook.type';
import { AgentService } from '../agent/agent.service';
import { TransactionAnalystResult } from '../coinbase/entities/agent.type';

@Injectable()
export class TransactionsService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly agentService: AgentService,
  ) {}

  public async findAll(): Promise<TransactionRecord[]> {
    return await this.supabaseService.getAll<TransactionRecord>(
      Collection.TRANSACTIONS,
    );
  }

  public async recordWebhookEvent(
    activity: Activity,
    network: string,
  ): Promise<void> {
    const transactionRecord: Omit<TransactionRecord, 'id'> = {
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

    await this.analyseTransaction(transactionRecord);
  }

  public async analyseTransaction(
    transactionRecord: Omit<TransactionRecord, 'id'>,
  ): Promise<any> {
    const analysis: TransactionAnalystResult | null =
      await this.agentService.askTransactionAnalysisAgent(transactionRecord);

    if (!analysis) return;

    const MIN_THRESHOLD = 70;

    if (analysis.score < MIN_THRESHOLD) return;

    await this.copyTransaction(transactionRecord);
  }

  private async copyTransaction(
    transactionRecord: Omit<TransactionRecord, 'id'>,
  ): Promise<void> {
    // Fetch on the factory contract all the deployed wallets
    //
    //   for(let user of users){
    //     - Fetch token balance (ERC20)
    //     - Analyze portofolio
    //     - Decide if swap or not
    //     - Call swap() on the wallet
    //   }
  }

  private async saveTransaction(transaction: TransactionRecord): Promise<void> {
    await this.supabaseService.insertSingle(
      Collection.TRANSACTIONS,
      transaction,
    );
  }
}
