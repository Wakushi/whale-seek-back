import { Inject, Injectable } from '@nestjs/common';
import {
  BlockExplorerConfig,
  BlockExplorerResponse,
  BlockExplorerTransaction,
  CHAIN_CONFIGS,
  FetchTransactionsParams,
} from './entities/block-explorer.type';
import { Address } from 'viem';
import { Transaction } from './entities/transaction.type';
import { ContractVerification } from './entities/source-code.type';

@Injectable()
export class BlockExplorerService {
  private readonly rateLimit: number = 5;
  private lastRequestTime: number = 0;

  constructor(
    @Inject('BASESCAN_CONFIG')
    private readonly config: { apiKey: string },
  ) {}

  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    const minimumInterval = 1000 / this.rateLimit;

    if (timeSinceLastRequest < minimumInterval) {
      await new Promise((resolve) =>
        setTimeout(resolve, minimumInterval - timeSinceLastRequest),
      );
    }
    this.lastRequestTime = Date.now();
  }

  public async fetchBaseTransactionByWallet({
    walletAddress,
    startDate,
    endDate,
  }: {
    walletAddress: Address;
    startDate: Date;
    endDate: Date;
  }): Promise<Transaction[]> {
    const baseTransactions = await this.fetchTransactions({
      address: walletAddress,
      config: CHAIN_CONFIGS[8453],
      startDate,
      endDate,
      includeERC20: true,
      includeNormalTxs: false,
      sort: 'asc',
    });

    const processedTxs = baseTransactions.map((tx) => ({
      hash: tx.hash,
      timestamp: new Date(parseInt(tx.timeStamp) * 1000),
      from: tx.from,
      to: tx.to,
      value: tx.value,
      gasUsed: tx.gasUsed,
      gasPrice: tx.gasPrice,
      tokenTransfer: tx.contractAddress
        ? {
            contract: tx.contractAddress,
            token: tx.tokenSymbol,
            decimals: parseInt(tx.tokenDecimal || '18'),
          }
        : null,
    }));

    return processedTxs;
  }

  public async fetchTransactions({
    address,
    startBlock = 0,
    endBlock = 99999999,
    startDate,
    endDate,
    sort = 'asc',
    config,
    includeERC20 = true,
    includeNormalTxs = true,
  }: FetchTransactionsParams): Promise<BlockExplorerTransaction[]> {
    const allTransactions: BlockExplorerTransaction[] = [];

    try {
      if (startDate) {
        startBlock = await this.getBlockNumberFromTimestamp(startDate, config);
      }
      if (endDate) {
        endBlock = await this.getBlockNumberFromTimestamp(endDate, config);
      }

      if (includeNormalTxs) {
        const normalTxs = await this.fetchTransactionList({
          address,
          startBlock,
          endBlock,
          sort,
          config,
          action: 'txlist',
        });
        allTransactions.push(...normalTxs);
      }

      if (includeERC20) {
        const erc20Txs = await this.fetchTransactionList({
          address,
          startBlock,
          endBlock,
          sort,
          config,
          action: 'tokentx',
        });
        allTransactions.push(...erc20Txs);
      }

      return allTransactions.sort((a, b) =>
        sort === 'asc'
          ? parseInt(a.timeStamp) - parseInt(b.timeStamp)
          : parseInt(b.timeStamp) - parseInt(a.timeStamp),
      );
    } catch (error) {
      console.error(`Error fetching transactions from ${config.name}:`, error);
      throw error;
    }
  }

  public async fetchSourceCode(contractAddress: Address): Promise<string> {
    const url = new URL('https://api.basescan.org/api');
    url.searchParams.append('module', 'contract');
    url.searchParams.append('action', 'getsourcecode');
    url.searchParams.append('address', contractAddress);
    url.searchParams.append('apikey', this.config.apiKey);

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    const verification: ContractVerification = data.result[0];

    return verification.SourceCode;
  }

  private async fetchTransactionList({
    address,
    startBlock,
    endBlock,
    sort,
    config,
    action,
  }: {
    address: string;
    startBlock: number;
    endBlock: number;
    sort: string;
    config: BlockExplorerConfig;
    action: 'txlist' | 'tokentx';
  }): Promise<BlockExplorerTransaction[]> {
    await this.enforceRateLimit();

    const url = new URL(config.apiUrl);
    url.searchParams.append('module', 'account');
    url.searchParams.append('action', action);
    url.searchParams.append('address', address);
    url.searchParams.append('startblock', startBlock.toString());
    url.searchParams.append('endblock', endBlock.toString());
    url.searchParams.append('sort', sort);
    url.searchParams.append('apikey', this.config.apiKey);

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data: BlockExplorerResponse = await response.json();

    if (data.status === '0') {
      if (data.message === 'No transactions found') {
        return [];
      }
      throw new Error(`API error: ${data.message}`);
    }

    return data.result;
  }

  private async getBlockNumberFromTimestamp(
    date: Date,
    config: BlockExplorerConfig,
  ): Promise<number> {
    await this.enforceRateLimit();

    const url = new URL(config.apiUrl);
    url.searchParams.append('module', 'block');
    url.searchParams.append('action', 'getblocknobytime');
    url.searchParams.append(
      'timestamp',
      Math.floor(date.getTime() / 1000).toString(),
    );
    url.searchParams.append('closest', 'before');
    url.searchParams.append('apikey', this.config.apiKey);

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    if (data.status === '0') {
      throw new Error(`API error: ${data.message}`);
    }

    return parseInt(data.result);
  }
}
