import { Injectable } from '@nestjs/common';
import { Address } from 'viem';
import { CoinbaseService } from '../coinbase/coinbase.service';
import { TransactionRecord } from '../transactions/entities/transaction.entity';
import { TransactionAnalystResult } from '../coinbase/entities/agent.type';

@Injectable()
export class AgentService {
  constructor(private readonly coinbaseService: CoinbaseService) {}
  public async askAgent(query: string, user: Address): Promise<string> {
    try {
      return await this.coinbaseService.askAgent(query, user);
    } catch (error) {
      return 'Something wrong happened, please try again.';
    }
  }

  public async askTransactionAnalysisAgent(
    transactionRecord: Omit<TransactionRecord, 'id'>,
  ): Promise<TransactionAnalystResult | null> {
    try {
      if (!transactionRecord) {
        throw new Error('Missing transaction record.');
      }

      return await this.coinbaseService.askTransactionAnalysisAgent(
        transactionRecord,
      );
    } catch (error) {
      return null;
    }
  }

  public async askTradingAgent(
    tradingWallet: Address,
    transactionRecord: Omit<TransactionRecord, 'id'>,
  ): Promise<string> {
    try {
      if (!transactionRecord) {
        throw new Error('Missing transaction record.');
      }

      if (!tradingWallet) {
        throw new Error('Missing trading wallet address.');
      }

      return await this.coinbaseService.askTradingAgent(
        tradingWallet,
        transactionRecord,
      );
    } catch (error) {
      return null;
    }
  }
}
