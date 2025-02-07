import { Injectable, Logger } from '@nestjs/common';
import { TransactionRecord } from './entities/transaction.entity';
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
    this.logger.log(
      `Analyzing activity:\n` +
        `  Asset:    ${activity.asset}\n` +
        `  Value:    ${activity.value}\n` +
        `  From:     ${activity.fromAddress}\n` +
        `  To:       ${activity.toAddress}\n` +
        `  Contract: ${activity.rawContract.address}\n` +
        `  Hash:     ${activity.hash}`,
    );

    const whales = await this.supabaseService.getAll<Whale>(
      Collection.WHALE_INFO,
    );

    this.logger.log(
      `Searching for origin whale in ${whales.length} whales collection..`,
    );

    const whale = whales.find(
      (w) =>
        w.whale_address.toLowerCase() === activity.fromAddress.toLowerCase() ||
        w.whale_address.toLowerCase() === activity.toAddress.toLowerCase(),
    );

    if (!whale) {
      this.logger.log(
        `No whale found for ${activity.fromAddress} | ${activity.toAddress} addresses`,
      );
      return;
    }

    const isSwap = this.isSwapTransaction(activity, whale.whale_address);

    if (!isSwap) {
      this.logger.log('No swap detected.');
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

  private async isSwapTransaction(
    activity: Activity,
    whaleAddress: Address,
  ): Promise<boolean> {
    const BASE_DEX_ADDRESSES = [
      // Uniswap V3
      '0x2626664c2603336E57B271c5C0b26F421741e481', // SwapRouter02
      '0x198EF79F1F515F02dFE9e3115eD9fC07183f02fC', // Universal Router

      // BaseSwap
      '0x327Df1E6de05895d2ab08513aaDD9313Fe505d86', // Router

      // Aerodrome
      '0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43', // Router

      // SushiSwap
      '0x8c47ED459d3688Ca14d67CE84E053600fcB9EC31', // V3 Router

      // Alienbase/RocketSwap
      '0x94cC0AaC535CCDB3C01d6787D6413C27ae39Bf77', // Router

      // Pancakeswap
      '0x678Aa4bF4E210cf2166753e054d5b7c31cc7fa86', // SmartRouter

      // Maverick
      '0x32AED3Bce901DA12ca8489788F3A99fCE1056e14', // Router
    ];

    const CHECKSUM_DEX_ADDRESSES = BASE_DEX_ADDRESSES.map((address) =>
      getAddress(address),
    );

    const isWhaleSellingToDex =
      getAddress(activity.fromAddress) === getAddress(whaleAddress) &&
      CHECKSUM_DEX_ADDRESSES.includes(getAddress(activity.toAddress));

    const isWhaleReceivingTokens =
      getAddress(activity.toAddress) === getAddress(whaleAddress) &&
      CHECKSUM_DEX_ADDRESSES.includes(getAddress(activity.rawContract.address));

    this.logger.log(
      `Swap detection:\n` +
        `  Is whale selling to DEX: ${isWhaleSellingToDex}\n` +
        `  Is whale receiving tokens: ${isWhaleReceivingTokens}\n` +
        `  From: ${activity.fromAddress}\n` +
        `  To: ${activity.toAddress}\n` +
        `  Token Contract: ${activity.rawContract.address}`,
    );

    return isWhaleSellingToDex || isWhaleReceivingTokens;
  }
}
