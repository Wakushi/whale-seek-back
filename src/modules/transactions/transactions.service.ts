import { Injectable, Logger } from '@nestjs/common';
import { SwapAnalysis, TransactionRecord } from './entities/transaction.entity';
import { SupabaseService } from '../supabase/supabase.service';
import { Collection } from '../supabase/entities/collections';
import { Activity } from '../webhook/entities/webhook.type';
import { AgentService } from '../agent/agent.service';
import { TransactionAnalystResult } from '../coinbase/entities/agent.type';
import { ContractService } from '../contract/contract.service';
import { AlchemyService } from '../alchemy/alchemy.service';
import { Address, getAddress } from 'viem';
import { WalletTokenBalance } from '../tokens/entities/token.type';
import { Whale } from '../discovery/entities/discovery.type';
import { DEX_PROTOCOLS } from './data/dexes';
import { BigNumber } from 'alchemy-sdk';

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly agentService: AgentService,
    private readonly contractService: ContractService,
    private readonly alchemyService: AlchemyService,
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
    console.log('================');
    console.log(
      `Analyzing activity:\n` +
        `  Asset:    ${activity.asset}\n` +
        `  Value:    ${activity.value}\n` +
        `  From:     ${activity.fromAddress}\n` +
        `  To:       ${activity.toAddress}\n` +
        `  Contract: ${activity.rawContract.address}\n` +
        `  Hash:     ${activity.hash}`,
    );

    const swapInfo = await this.extractSwapInfo(activity);

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
      (w) => getAddress(w.whale_address) === getAddress(swapInfo.initiator),
    );

    if (!whale) {
      this.logger.log(
        `No whale found for ${activity.fromAddress} | ${activity.toAddress} addresses`,
      );
      return;
    }

    this.logger.log(
      `Recording webhook trade event for whale ${whale.whale_address}...`,
    );

    const transactionRecord: Omit<TransactionRecord, 'id'> = {
      transaction_hash: activity.hash,
      block_number: activity.blockNum,
      whale_address: whale.whale_address,
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

    const whalePortfolio = await this.alchemyService.getTokenBalances(
      transactionRecord.whale_address as Address,
    );

    const tradePortfolioPercentage = await this.getTradePortfolioRepartition(
      whalePortfolio.tokens,
      transactionRecord,
    );

    transactionRecord.trade_wallet_percentage = tradePortfolioPercentage;

    await this.analyseTransaction(transactionRecord);
  }

  public async analyseTransaction(
    transactionRecord: Omit<TransactionRecord, 'id'>,
  ): Promise<any> {
    this.logger.log(
      `Analyzing transaction ${transactionRecord.transaction_hash}`,
    );

    const analysis: TransactionAnalystResult | null =
      await this.agentService.askTransactionAnalysisAgent(transactionRecord);

    if (!analysis) return;

    const MIN_THRESHOLD = 70;

    this.logger.log(`Analysis score result: ${analysis.score}`);

    if (analysis.score < MIN_THRESHOLD) return;

    await this.saveTransaction(transactionRecord);

    await this.copyTransaction(transactionRecord);
  }

  public async copyTransaction(
    transactionRecord: Omit<TransactionRecord, 'id'>,
  ): Promise<any> {
    const wallets = await this.contractService.fetchAllTradingWallets();

    this.logger.log(
      `Dispatching trade order to ${wallets.length} network wallets (${transactionRecord.transaction_hash})`,
    );

    for (const wallet of wallets) {
      await this.agentService.askTradingAgent(wallet, transactionRecord);
    }
  }

  private async saveTransaction(
    transaction: Omit<TransactionRecord, 'id'>,
  ): Promise<void> {
    await this.supabaseService.insertSingle(
      Collection.TRANSACTIONS,
      transaction,
    );
  }

  private async getTradePortfolioRepartition(
    walletBalances: WalletTokenBalance[],
    transaction: Omit<TransactionRecord, 'id'>,
  ): Promise<number> {
    const transactionToken = walletBalances.find(
      (token) =>
        token.contractAddress?.toLowerCase() ===
        transaction.contract_address?.toLowerCase(),
    );

    if (!transactionToken) {
      return 0;
    }

    const totalPortfolioValue = walletBalances.reduce((sum, token) => {
      const tokenValue = parseFloat(token.valueInUSD || '0');
      return sum + tokenValue;
    }, 0);

    if (totalPortfolioValue === 0) {
      return 0;
    }

    const tokenPriceInUSD =
      parseFloat(transactionToken.valueInUSD) /
      parseFloat(transactionToken.balance);
    const transactionValueInUSD = transaction.value * tokenPriceInUSD;

    const percentage = (transactionValueInUSD / totalPortfolioValue) * 100;

    return Math.round(percentage * 100) / 100;
  }

  private async extractSwapInfo(
    activity: Activity,
  ): Promise<SwapAnalysis | null> {
    const receipt = await this.contractService.provider.getTransactionReceipt(
      activity.hash,
    );

    const initiator = getAddress(receipt.from);

    const involvedAddresses = new Set<string>([
      getAddress(receipt.from),
      getAddress(receipt.to),
      ...receipt.logs.map((log) => getAddress(log.address)),
      ...receipt.logs.flatMap((log) =>
        log.topics
          .filter((topic) => topic.length === 66)
          .map((topic) => getAddress('0x' + topic.slice(26))),
      ),
    ]);

    const matchedDEX = DEX_PROTOCOLS.find((dex) =>
      dex.routers.some((router) => involvedAddresses.has(getAddress(router))),
    );

    if (!matchedDEX) {
      return null;
    }

    const TRANSFER_EVENT_SIGNATURE =
      '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

    const transfers = receipt.logs
      .filter((log) => log.topics[0] === TRANSFER_EVENT_SIGNATURE)
      .map((log) => ({
        token: log.address,
        from: getAddress('0x' + log.topics[1].slice(26)),
        to: getAddress('0x' + log.topics[2].slice(26)),
        value: BigNumber.from(log.data),
      }));

    const userTransfers = transfers.filter(
      (transfer) =>
        transfer.from === getAddress(activity.fromAddress) ||
        transfer.to === getAddress(activity.fromAddress),
    );

    const inputTransfer = userTransfers.find(
      (transfer) => transfer.from === getAddress(activity.fromAddress),
    );

    const outputTransfer = userTransfers.find(
      (transfer) => transfer.to === getAddress(activity.fromAddress),
    );

    return {
      protocol: matchedDEX.name,
      inputToken: inputTransfer?.token,
      outputToken: outputTransfer?.token,
      initiator,
    };
  }
}
