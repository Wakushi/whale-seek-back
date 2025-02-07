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
import { DEX_PROTOCOLS } from './data/dexes';
import { BigNumber, Network } from 'alchemy-sdk';

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
    swapInfo: SwapAnalysis,
    network: string,
  ): Promise<void> {
    this.logger.log(
      `Recording webhook trade event for whale ${swapInfo.initiator}...`,
    );

    const { protocol, initiator, inputToken, outputToken } = swapInfo;

    const transactionRecord: Omit<TransactionRecord, 'id'> = {
      transaction_hash: activity.hash,
      block_number: activity.blockNum,
      whale_address: initiator,
      input_token: inputToken,
      output_token: outputToken,
      value: activity.value,
      asset: activity.asset,
      decimals: activity.rawContract.decimals,
      raw_value: activity.rawContract.rawValue,
      network: network,
      protocol,
    };

    console.log('Transaction record: ', transactionRecord);

    const whalePortfolio = await this.alchemyService.getTokenBalances(
      transactionRecord.whale_address as Address,
      Network.BASE_MAINNET,
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

    const MIN_THRESHOLD = 40;

    this.logger.log(`Analysis score result: ${analysis.score}`);

    if (analysis.score < MIN_THRESHOLD) return;

    await this.saveTransaction(transactionRecord);

    await this.copyTransaction(transactionRecord);
  }

  public async copyTransaction(
    transactionRecord: Omit<TransactionRecord, 'id'>,
  ): Promise<any> {
    const wallets = await this.contractService.fetchAllTradingWallets();

    if (!wallets || !wallets.length) return;

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
    const inputToken = walletBalances.find(
      (token) =>
        token.contractAddress?.toLowerCase() ===
        transaction.input_token?.toLowerCase(),
    );

    const outputToken = walletBalances.find(
      (token) =>
        token.contractAddress?.toLowerCase() ===
        transaction.output_token?.toLowerCase(),
    );

    const totalPortfolioValue = walletBalances.reduce((sum, token) => {
      const tokenValue = parseFloat(token.valueInUSD || '0');
      return sum + tokenValue;
    }, 0);

    if (totalPortfolioValue === 0) {
      console.log('Total Portfolio Value is 0, returning 0');
      return 0;
    }

    let transactionValueInUSD = 0;

    if (inputToken) {
      const inputTokenPriceInUSD =
        parseFloat(inputToken.valueInUSD) / parseFloat(inputToken.balance);
      const inputValueInUSD = transaction.value * inputTokenPriceInUSD;
      transactionValueInUSD = Math.max(transactionValueInUSD, inputValueInUSD);
    }

    if (outputToken) {
      const outputTokenPriceInUSD =
        parseFloat(outputToken.valueInUSD) / parseFloat(outputToken.balance);
      const outputValueInUSD = transaction.value * outputTokenPriceInUSD;
      transactionValueInUSD = Math.max(transactionValueInUSD, outputValueInUSD);
    }

    if (!inputToken && !outputToken) {
      console.log('Neither Input nor Output Token found, returning 0');
      return 0;
    }

    const percentage = (transactionValueInUSD / totalPortfolioValue) * 100;
    const roundedPercentage = Math.round(percentage * 100) / 100;

    return roundedPercentage;
  }

  public async extractSwapInfo(
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
      .map((log, index) => ({
        token: getAddress(log.address),
        from: getAddress('0x' + log.topics[1].slice(26)),
        to: getAddress('0x' + log.topics[2].slice(26)),
        value: BigNumber.from(log.data),
        logIndex: index,
      }))
      .sort((a, b) => a.logIndex - b.logIndex);

    const inputTransfer = transfers.find(
      (transfer) => transfer.from === getAddress(initiator),
    );

    const outputTransfer = transfers.find(
      (transfer) => transfer.to === getAddress(initiator),
    );

    if (!inputTransfer || !outputTransfer) {
      const whaleTransfers = transfers.filter(
        (transfer) =>
          transfer.from === getAddress(activity.fromAddress) ||
          transfer.to === getAddress(activity.toAddress),
      );

      if (whaleTransfers.length >= 2) {
        const firstWhaleTransfer = whaleTransfers.find(
          (transfer) => transfer.from === getAddress(activity.fromAddress),
        );
        const lastWhaleTransfer = [...whaleTransfers]
          .reverse()
          .find((transfer) => transfer.to === getAddress(activity.toAddress));

        if (
          firstWhaleTransfer &&
          lastWhaleTransfer &&
          firstWhaleTransfer.token !== lastWhaleTransfer.token
        ) {
          return {
            protocol: matchedDEX.name,
            inputToken: firstWhaleTransfer.token,
            outputToken: lastWhaleTransfer.token,
            initiator,
          };
        }
      }
      return null;
    }

    if (inputTransfer.token === outputTransfer.token) {
      return null;
    }

    this.logger.log(
      `${initiator} swapped ${inputTransfer.token} for ${outputTransfer.token}`,
    );

    return {
      protocol: matchedDEX.name,
      inputToken: inputTransfer.token,
      outputToken: outputTransfer.token,
      initiator,
    };
  }
}
