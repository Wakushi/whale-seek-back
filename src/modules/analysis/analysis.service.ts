import { Injectable, Logger } from '@nestjs/common';
import { TokensService } from '../tokens/tokens.services';
import { AlchemyService } from '../alchemy/alchemy.service';
import { Address } from 'viem';
import { AssetTransfersResult } from 'alchemy-sdk';
import {
  CoinCodexBaseTokenData,
  CoinCodexCsvDailyMetrics,
  SupplyMetrics,
} from '../tokens/entities/coin-codex.type';
import {
  AccountAnalysis,
  FormattedTransfer,
  PortfolioPerformance,
  ProfitLossResult,
  TokenPerformanceMetrics,
  TransferToken,
} from './entities/analysis.type';
import { WalletAnalyzer } from './wallet-analyser';
import { Wallet } from '../tokens/entities/token.type';
import { getDateFromBlock } from 'src/utils/blockchain.helper';

@Injectable()
export class AnalysisService {
  private readonly logger = new Logger(AnalysisService.name);

  constructor(
    private readonly alchemyService: AlchemyService,
    private readonly tokenService: TokensService,
  ) {}

  public async analyseAccount(
    wallet: Address,
    coinCodexList: CoinCodexBaseTokenData[],
  ): Promise<AccountAnalysis | null> {
    try {
      const walletHoldings: Wallet =
        await this.alchemyService.getTokenBalances(wallet);

      const analyzer = new WalletAnalyzer();

      const walletAnalysis = analyzer.analyzeWalletDistribution(walletHoldings);

      const transfers =
        await this.alchemyService.getWalletTokenTransfers(wallet);

      const profitabilityScore = await this.analyseTransfersProfits(
        transfers,
        wallet,
        coinCodexList,
      );

      return {
        walletAnalysis,
        profitabilityScore,
      };
    } catch (error) {
      console.error(`Error analyzing wallet ${wallet}`, error);
      return null;
    }
  }

  private async analyseTransfersProfits(
    transfers: AssetTransfersResult[],
    wallet: Address,
    coinCodexList: CoinCodexBaseTokenData[],
  ): Promise<PortfolioPerformance> {
    this.logger.log(
      `Analysing ${wallet} ${transfers.length} token transfers...`,
    );

    const tokenTransfers: Map<string, AssetTransfersResult[]> = new Map();
    const tokenByAddress: Map<string, TransferToken> = new Map();
    const metricsByTokenSymbol: Map<string, CoinCodexCsvDailyMetrics[]> =
      new Map();

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

    const BLACK_LIST = ['well', 'musicoin', 'aerochain', 'aero'];

    const tokenResults = new Map<string, ProfitLossResult>();
    let totalAbsoluteValue = 0;

    for (const [tokenAddress, transfers] of tokenTransfers.entries()) {
      const token = tokenByAddress.get(tokenAddress);
      const tokenName = token?.name?.toLowerCase();

      if (
        !token ||
        tokenName?.includes('usd') ||
        BLACK_LIST.includes(tokenName)
      ) {
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

      this.logger.log(`Analysing token ${matchTokenSymbol} transfer history..`);

      let dailyMetrics: CoinCodexCsvDailyMetrics[] = [];

      if (metricsByTokenSymbol.has(matchTokenSymbol)) {
        dailyMetrics = metricsByTokenSymbol.get(matchTokenSymbol);
      } else {
        dailyMetrics = await this.getTokenDailyMetrics(token, matchTokenSymbol);
        metricsByTokenSymbol.set(matchTokenSymbol, dailyMetrics);
      }

      if (!dailyMetrics.length) {
        this.logger.log(
          `No metrics found for  ${matchTokenSymbol}. Skipping..`,
        );
        continue;
      }

      this.logger.log(`Formatting ${matchTokenSymbol} transfers ..`);

      const formattedTransfers = await this.formatTransfer(transfers, wallet);

      if (formattedTransfers.length < 2) {
        this.logger.log(
          `Not enough transfers for ${matchTokenSymbol}. Skipping..`,
        );
        continue;
      }

      const profitAndLoss = this.calculateProfitAndLoss(
        formattedTransfers,
        dailyMetrics,
      );

      tokenResults.set(matchTokenSymbol, profitAndLoss);
      totalAbsoluteValue += Math.abs(profitAndLoss.netProfit);
    }

    return this.calculatePortfolioPerformance(tokenResults);
  }

  private async getTokenDailyMetrics(
    token: TransferToken,
    symbol: string,
  ): Promise<CoinCodexCsvDailyMetrics[]> {
    if (!token || !symbol) return [];

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
        const timestamp = getDateFromBlock(blockNum);

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

  private getPriceAtTimestamp(
    timestamp: number,
    dailyMetrics: CoinCodexCsvDailyMetrics[],
  ): number {
    const transferDate = new Date(timestamp * 1000).toISOString().split('T')[0];

    const sortedMetrics = [...dailyMetrics].sort(
      (a, b) => new Date(a.Start).getTime() - new Date(b.Start).getTime(),
    );

    const exactMatch = sortedMetrics.find(
      (m) =>
        m.Start.split('T')[0] <= transferDate &&
        m.End.split('T')[0] >= transferDate,
    );

    if (exactMatch) {
      return exactMatch.Close;
    }

    if (transferDate < sortedMetrics[0].Start.split('T')[0]) {
      return sortedMetrics[0].Close;
    }

    if (
      transferDate > sortedMetrics[sortedMetrics.length - 1].End.split('T')[0]
    ) {
      return sortedMetrics[sortedMetrics.length - 1].Close;
    }

    const closestMetric = sortedMetrics.reduce((closest, current) => {
      const currentDate = new Date(current.Start).getTime();
      const closestDate = new Date(closest.Start).getTime();
      const targetDate = new Date(transferDate).getTime();

      return Math.abs(currentDate - targetDate) <
        Math.abs(closestDate - targetDate)
        ? current
        : closest;
    });

    return closestMetric.Close;
  }

  private calculateProfitAndLoss(
    formattedTransfers: FormattedTransfer[],
    dailyMetrics: CoinCodexCsvDailyMetrics[],
  ): ProfitLossResult {
    let totalProfit = 0;
    let totalLoss = 0;
    let tokenBalance = 0;
    let tradeCount = 0;
    const tokenQueue: { value: number; costBasis: number }[] = [];

    for (const transfer of formattedTransfers) {
      const priceAtTransfer = this.getPriceAtTimestamp(
        transfer.timestamp,
        dailyMetrics,
      );

      if (transfer.type === 'BUY') {
        const costBasis = transfer.value * priceAtTransfer;
        tokenQueue.push({ value: transfer.value, costBasis });
        tokenBalance += transfer.value;
        tradeCount++;
      } else if (transfer.type === 'SELL') {
        tradeCount++;
        if (tokenBalance < transfer.value) {
          const totalQueueValue = tokenQueue.reduce(
            (sum, token) => sum + token.value,
            0,
          );
          const totalQueueCostBasis = tokenQueue.reduce(
            (sum, token) => sum + token.costBasis,
            0,
          );

          const averageCostBasis =
            totalQueueValue > 0
              ? totalQueueCostBasis / totalQueueValue
              : priceAtTransfer;

          const excessTokens = transfer.value - tokenBalance;
          const excessCostBasis = excessTokens * averageCostBasis;

          const totalCostBasis =
            totalQueueValue > 0
              ? totalQueueCostBasis + excessCostBasis
              : transfer.value * averageCostBasis;

          tokenBalance = 0;
          tokenQueue.length = 0;

          const proceeds = transfer.value * priceAtTransfer;
          const profitOrLoss = proceeds - totalCostBasis;

          if (profitOrLoss > 0) {
            totalProfit += profitOrLoss;
          } else {
            totalLoss += Math.abs(profitOrLoss);
          }
        } else {
          let remainingSellValue = transfer.value;
          let totalCostBasis = 0;

          while (remainingSellValue > 0 && tokenQueue.length > 0) {
            const oldestToken = tokenQueue[0];
            if (oldestToken.value <= remainingSellValue) {
              totalCostBasis += oldestToken.costBasis;
              remainingSellValue -= oldestToken.value;
              tokenBalance -= oldestToken.value;
              tokenQueue.shift();
            } else {
              const sellFraction = remainingSellValue / oldestToken.value;
              const partialCostBasis = sellFraction * oldestToken.costBasis;
              totalCostBasis += partialCostBasis;

              oldestToken.value -= remainingSellValue;
              oldestToken.costBasis *= 1 - sellFraction;
              tokenBalance -= remainingSellValue;
              remainingSellValue = 0;
            }
          }

          const proceeds = transfer.value * priceAtTransfer;
          const profitOrLoss = proceeds - totalCostBasis;

          if (profitOrLoss > 0) {
            totalProfit += profitOrLoss;
          } else {
            totalLoss += Math.abs(profitOrLoss);
          }
        }
      }
    }

    const netProfit = totalProfit - totalLoss;

    return {
      totalProfit,
      totalLoss,
      netProfit,
      tradeCount,
    };
  }

  private calculatePortfolioPerformance(
    tokenResults: Map<string, ProfitLossResult>,
  ): PortfolioPerformance {
    const metrics = new Map<string, TokenPerformanceMetrics>();
    let portfolioTotalProfit = 0;
    let portfolioTotalLoss = 0;

    for (const [token, result] of tokenResults) {
      const profitLossRatio =
        result.totalLoss > 0
          ? result.totalProfit / result.totalLoss
          : result.totalProfit > 0
            ? Infinity
            : 0;

      const profitabilityScore =
        result.totalProfit === 0 && result.totalLoss === 0
          ? 0
          : result.totalLoss === 0 && result.totalProfit > 0
            ? 100
            : Math.min(100, profitLossRatio * 50);

      portfolioTotalProfit += result.totalProfit;
      portfolioTotalLoss += result.totalLoss;

      metrics.set(token, {
        totalProfit: result.totalProfit,
        totalLoss: result.totalLoss,
        netProfit: result.netProfit,
        tradeCount: result.tradeCount,
        profitabilityScore,
        contribution: 0,
      });
    }

    if (metrics.has('ETH') && metrics.has('WETH')) {
      const eth = metrics.get('ETH')!;
      const weth = metrics.get('WETH')!;

      const combined = {
        totalProfit: eth.totalProfit + weth.totalProfit,
        totalLoss: eth.totalLoss + weth.totalLoss,
        netProfit: eth.netProfit + weth.netProfit,
        tradeCount: eth.tradeCount + weth.tradeCount,
        profitabilityScore: 0,
        contribution: 0,
      };

      const combinedRatio =
        combined.totalLoss > 0
          ? combined.totalProfit / combined.totalLoss
          : combined.totalProfit > 0
            ? Infinity
            : 0;

      combined.profitabilityScore =
        combined.totalLoss === 0 && combined.totalProfit > 0
          ? 100
          : Math.min(100, combinedRatio * 50);

      metrics.set('ETH/WETH', combined);
      metrics.delete('ETH');
      metrics.delete('WETH');
    }

    const totalAbsoluteProfit = Array.from(metrics.values()).reduce(
      (sum, token) => sum + Math.abs(token.netProfit),
      0,
    );

    for (const [token, metric] of metrics) {
      metric.contribution =
        totalAbsoluteProfit > 0
          ? (Math.abs(metric.netProfit) / totalAbsoluteProfit) *
            100 *
            Math.sign(metric.netProfit)
          : 0;
    }

    const profitableMetrics = Array.from(metrics.values()).filter(
      (m) => m.netProfit > 0,
    );
    const unprofitableMetrics = Array.from(metrics.values()).filter(
      (m) => m.netProfit < 0,
    );

    const weightedScore = profitableMetrics.reduce(
      (score, metric) =>
        score + metric.profitabilityScore * Math.abs(metric.netProfit),
      0,
    );
    const totalWeight = profitableMetrics.reduce(
      (sum, metric) => sum + Math.abs(metric.netProfit),
      0,
    );

    const globalScore = totalWeight > 0 ? weightedScore / totalWeight : 0;

    return {
      globalScore,
      totalNetProfit: portfolioTotalProfit - portfolioTotalLoss,
      tokenMetrics: metrics,
      profitableTokens: profitableMetrics.length,
      unprofitableTokens: unprofitableMetrics.length,
    };
  }
}
