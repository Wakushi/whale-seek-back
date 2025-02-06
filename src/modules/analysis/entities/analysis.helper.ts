import { CoinCodexCsvDailyMetrics } from 'src/modules/tokens/entities/coin-codex.type';
import {
  FormattedTransfer,
  PortfolioPerformance,
  ProfitLossResult,
  TokenPerformanceMetrics,
} from './analysis.type';
import { AssetTransfersResult } from 'alchemy-sdk';
import { Address } from 'viem';
import { getDateFromBlock } from 'src/utils/blockchain.helper';

export function getPriceAtTimestamp(
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

export function calculateProfitAndLoss(
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

export function calculatePortfolioPerformance(
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

export function formatTransfer(
  transfers: AssetTransfersResult[],
  wallet: Address,
): FormattedTransfer[] {
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
