import {
  AccountAnalysis,
  PortfolioPerformance,
} from 'src/modules/analysis/entities/analysis.type';
import { TokenAnalysis } from 'src/modules/analysis/wallet-analyser';
import { WhaleDetection } from 'src/modules/discovery/entities/discovery.type';

export function calculateTraderEfficiency(
  tokenAnalysis: TokenAnalysis,
  portfolioPerformance: PortfolioPerformance,
): number {
  const weights = {
    tokenStrategy: 0.4,
    performance: 0.6,
  };

  const tokenStrategyScore = calculateTokenStrategyScore(tokenAnalysis);

  const performanceScore = calculatePerformanceScore(portfolioPerformance);

  const finalScore =
    tokenStrategyScore * weights.tokenStrategy +
    performanceScore * weights.performance;

  return Math.min(Math.max(Math.round(finalScore * 100), 0), 100);
}

function calculateTokenStrategyScore(tokenAnalysis: TokenAnalysis): number {
  const normalizedTokenScore = tokenAnalysis.totalScore / 100;

  const strategyBalance =
    (tokenAnalysis.diversificationScore * 0.3 +
      tokenAnalysis.concentrationScore * 0.2 +
      tokenAnalysis.stablecoinRatioScore * 0.2 +
      tokenAnalysis.bluechipScore * 0.3) /
    100;

  return (normalizedTokenScore + strategyBalance) / 2;
}

function calculatePerformanceScore(performance: PortfolioPerformance): number {
  const profitRatio =
    performance.profitableTokens /
    (performance.profitableTokens + performance.unprofitableTokens);

  let avgTokenPerformance = 0;
  let tokenCount = 0;

  performance.tokenMetrics.forEach((metrics) => {
    avgTokenPerformance += metrics.profitabilityScore;
    tokenCount++;
  });

  const normalizedAvgPerformance =
    tokenCount > 0 ? avgTokenPerformance / tokenCount : 0;

  const normalizedGlobalScore = performance.globalScore / 100;

  return (
    normalizedGlobalScore * 0.4 +
    profitRatio * 0.3 +
    normalizedAvgPerformance * 0.3
  );
}

export function sortWhalesByEfficiency(
  walletScores: Map<WhaleDetection, AccountAnalysis>,
): Array<{ whaleDetection: WhaleDetection; score: number }> {
  const scoredWallets: Array<{
    whaleDetection: WhaleDetection;
    score: number;
  }> = [];

  walletScores.forEach((analysis, whaleDetection) => {
    const score = calculateTraderEfficiency(
      analysis.walletAnalysis,
      analysis.profitabilityScore,
    );
    scoredWallets.push({ whaleDetection, score });
  });

  return scoredWallets.sort((a, b) => b.score - a.score);
}
