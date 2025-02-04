import { Injectable, Logger } from '@nestjs/common';
import { TokensService } from '../tokens/tokens.services';
import { AlchemyService } from '../alchemy/alchemy.service';
import { Address } from 'viem';
import { BlockExplorerService } from '../block-explorer/block-explorer.service';
import { AssetTransfersResult } from 'alchemy-sdk';
import {
  CoinCodexCsvDailyMetrics,
  SupplyMetrics,
} from '../tokens/entities/coin-codex.type';

type FormattedTransfer = {
  transactionHash: string;
  timestamp: number;
  type: 'SELL' | 'BUY';
  value: number;
};

type TransferToken = {
  name: string;
  address: Address;
};

@Injectable()
export class AnalysisService {
  private readonly logger = new Logger(AnalysisService.name);

  constructor(
    private readonly alchemyService: AlchemyService,
    private readonly tokenService: TokensService,
    private readonly blockExplorerService: BlockExplorerService,
  ) {}

  // We create some pre-worked data to then pass to the agent because here we
  // want to have a uniformed data set to begin with (The agent would maybe skip one step
  // between two wallet and therefore our results will be biased)
  // The goal is to gather as much data as possible for each wallet to see if it's worth tracking
  // Should return an analysis with a score
  public async analyseWallet(wallet: Address): Promise<void> {
    try {
      // const walletHoldings: Wallet =
      //   await this.alchemyService.getTokenBalances(wallet);

      const transfers =
        await this.alchemyService.getWalletTokenTransfers(wallet);

      this.logger.log(
        `Found ${transfers.length} ERC20 transfers for wallet ${wallet}!`,
      );

      await this.analyseTransfers(transfers, wallet);
    } catch (error) {
      console.error('Error analysing wallet: ', error);
    }
  }

  private async analyseTransfers(
    transfers: AssetTransfersResult[],
    wallet: Address,
  ) {
    const tokenTransfers: Map<string, AssetTransfersResult[]> = new Map();
    const tokenByAddress: Map<string, TransferToken> = new Map();

    const coinCodexList = await this.tokenService.getCoinCodexCoinList();

    if (!coinCodexList || !coinCodexList.length) {
      this.logger.log(
        `Coin Codex list not fetched, aborting analyse for wallet ${wallet}`,
      );

      return;
    }

    transfers.forEach((transfer) => {
      const tokenAddress = transfer.rawContract.address as Address;

      if (!tokenByAddress.has(tokenAddress)) {
        tokenByAddress.set(tokenAddress, {
          name: transfer.asset,
          address: tokenAddress,
        });
      }

      if (tokenTransfers.has(tokenAddress)) {
        tokenTransfers.set(tokenAddress, [
          ...tokenTransfers.get(tokenAddress),
          transfer,
        ]);
      } else {
        tokenTransfers.set(tokenAddress, [transfer]);
      }
    });

    const BLACK_LIST = ['well'];

    for (const [tokenAddress, transfers] of tokenTransfers.entries()) {
      const token = tokenByAddress.get(tokenAddress);
      const tokenName = token.name.toLowerCase();

      if (
        !token ||
        tokenName.includes('usd') ||
        BLACK_LIST.includes(tokenName)
      ) {
        this.logger.log(`Skipping ${tokenName}...`);
        continue;
      }

      const matchings = coinCodexList.filter((t) => {
        return (
          (t.shortname && t.shortname.toLowerCase() === tokenName) ||
          (t.display && t.display.toLowerCase() === tokenName) ||
          (t.ccu_slug && t.ccu_slug.toLowerCase() === tokenName) ||
          (t.symbol && t.symbol.toLowerCase() === tokenName) ||
          (t.name && t.name.toLowerCase() === tokenName)
        );
      });

      const matchTokenSymbol = matchings?.length
        ? matchings[0].symbol
        : token.name;

      const dailyMetrics = await this.getTokenDailyMetrics(
        token,
        matchTokenSymbol,
      );

      return dailyMetrics;

      // const formattedTransfers = await this.formatTransfer(transfers, wallet);
    }
  }

  private async getTokenDailyMetrics(
    token: TransferToken,
    symbol: string,
  ): Promise<CoinCodexCsvDailyMetrics[]> {
    const staticSupplyMetrics: SupplyMetrics | null =
      await this.tokenService.fetchSupplyMetrics(symbol.toLowerCase());

    let dailyMetrics: CoinCodexCsvDailyMetrics[] = [];

    try {
      if (staticSupplyMetrics) {
        dailyMetrics = await this.tokenService.fetchDailyMetrics(
          staticSupplyMetrics.name,
        );
      }
    } catch (error) {
      dailyMetrics = await this.tokenService.fetchDailyMetrics(
        symbol.toLowerCase(),
      );
    }

    if (!dailyMetrics.length) {
      this.logger.log(
        `No daily metrics found for token ${token.name.toLowerCase()}`,
      );

      return [];
    }

    dailyMetrics.sort(
      (a, b) => new Date(a.Start).getTime() - new Date(b.Start).getTime(),
    );

    return dailyMetrics;
  }

  private async formatTransfer(
    transfers: AssetTransfersResult[],
    wallet: Address,
  ): Promise<FormattedTransfer[]> {
    const formattedTransfers: FormattedTransfer[] = [];

    for (const transfer of transfers) {
      const { blockNum, hash, from, value } = transfer;

      try {
        const block = await this.alchemyService.client.core.getBlock(blockNum);

        const timestamp = block.timestamp;

        formattedTransfers.push({
          timestamp,
          transactionHash: hash,
          type: from === wallet ? 'SELL' : 'BUY',
          value: value ?? 0,
        });
      } catch (error) {
        console.log('Error formatting transfers: ', error);
      }
    }

    return formattedTransfers.sort((a, b) => a.timestamp - b.timestamp);
  }
}
