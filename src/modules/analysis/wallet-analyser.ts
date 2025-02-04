import { Wallet, WalletTokenBalance } from '../tokens/entities/token.type';

export type TokenAnalysis = {
  tokenCount: number;
  diversificationScore: number;
  concentrationScore: number;
  stablecoinRatioScore: number;
  bluechipScore: number;
  totalScore: number;
};

export class WalletAnalyzer {
  private readonly BLUE_CHIP_TOKENS = new Set(
    [
      'BTC',
      'ETH',
      'BNB',
      'SOL',
      'ADA',
      'DOT',
      'AVAX',
      'MATIC',
      'LINK',
      'UNI',
    ].map((symbol) => symbol.toLowerCase()),
  );

  private readonly STABLECOINS = new Set(
    ['USDT', 'USDC', 'DAI', 'BUSD', 'TUSD', 'USDP', 'GUSD', 'FRAX'].map(
      (symbol) => symbol.toLowerCase(),
    ),
  );

  public analyzeWalletDistribution(wallet: Wallet): TokenAnalysis {
    const tokenBalances = this.normalizeTokenBalances(wallet.tokens);
    const totalPortfolioValue =
      this.calculateTotalPortfolioValue(tokenBalances);

    const diversificationScore = this.calculateDiversificationScore(
      tokenBalances.length,
    );
    const concentrationScore = this.calculateConcentrationScore(
      tokenBalances,
      totalPortfolioValue,
    );
    const stablecoinRatioScore = this.calculateStablecoinRatioScore(
      tokenBalances,
      totalPortfolioValue,
    );
    const bluechipScore = this.calculateBluechipScore(
      tokenBalances,
      totalPortfolioValue,
    );

    const totalScore = this.calculateTotalScore({
      diversificationScore,
      concentrationScore,
      stablecoinRatioScore,
      bluechipScore,
    });

    return {
      tokenCount: tokenBalances.length,
      diversificationScore,
      concentrationScore,
      stablecoinRatioScore,
      bluechipScore,
      totalScore,
    };
  }

  private normalizeTokenBalances(
    tokens: WalletTokenBalance[],
  ): (WalletTokenBalance & {
    numericBalance: number;
    numericValue: number;
  })[] {
    return tokens
      .map((token) => ({
        ...token,
        numericBalance: parseFloat(token.balance),
        numericValue: parseFloat(token.valueInUSD),
      }))
      .filter((token) => token.numericValue > 0); 
  }

  private calculateTotalPortfolioValue(
    tokens: (WalletTokenBalance & {
      numericValue: number;
    })[],
  ): number {
    return tokens.reduce((total, token) => total + token.numericValue, 0);
  }

  private calculateDiversificationScore(tokenCount: number): number {
    if (tokenCount < 2) return 20;
    if (tokenCount >= 2 && tokenCount < 5) return 60;
    if (tokenCount >= 5 && tokenCount <= 15) return 100;
    if (tokenCount > 15 && tokenCount <= 25) return 80;
    return 40; 
  }

  private calculateConcentrationScore(
    tokens: (WalletTokenBalance & { numericValue: number })[],
    totalValue: number,
  ): number {
    const sortedTokens = [...tokens].sort(
      (a, b) => b.numericValue - a.numericValue,
    );

    const top1Percentage = (sortedTokens[0]?.numericValue || 0) / totalValue;
    const top3Percentage =
      sortedTokens.slice(0, 3).reduce((sum, t) => sum + t.numericValue, 0) /
      totalValue;

    let score = 100;
    if (top1Percentage > 0.5)
      score -= 40; 
    else if (top1Percentage > 0.3) score -= 20; 

    if (top3Percentage > 0.8)
      score -= 30; 
    else if (top3Percentage > 0.6) score -= 15; 

    return Math.max(0, score);
  }

  private calculateStablecoinRatioScore(
    tokens: (WalletTokenBalance & { numericValue: number })[],
    totalValue: number,
  ): number {
    const stablecoinValue = tokens
      .filter((t) => this.STABLECOINS.has(t.symbol.toLowerCase()))
      .reduce((sum, t) => sum + t.numericValue, 0);

    const stablecoinRatio = stablecoinValue / totalValue;

    if (stablecoinRatio < 0.05) return 60; 
    if (stablecoinRatio >= 0.05 && stablecoinRatio <= 0.3) return 100;
    if (stablecoinRatio > 0.3 && stablecoinRatio <= 0.5) return 80;
    return 40; 
  }

  private calculateBluechipScore(
    tokens: (WalletTokenBalance & { numericValue: number })[],
    totalValue: number,
  ): number {
    const bluechipValue = tokens
      .filter((t) => this.BLUE_CHIP_TOKENS.has(t.symbol.toLowerCase()))
      .reduce((sum, t) => sum + t.numericValue, 0);

    const bluechipRatio = bluechipValue / totalValue;

    if (bluechipRatio < 0.2) return 40; 
    if (bluechipRatio >= 0.2 && bluechipRatio < 0.4) return 70;
    if (bluechipRatio >= 0.4 && bluechipRatio <= 0.8) return 100;
    return 80; 
  }

  private calculateTotalScore(scores: {
    diversificationScore: number;
    concentrationScore: number;
    stablecoinRatioScore: number;
    bluechipScore: number;
  }): number {
    const weights = {
      diversification: 0.25,
      concentration: 0.3,
      stablecoin: 0.2,
      bluechip: 0.25,
    };

    return Math.round(
      scores.diversificationScore * weights.diversification +
        scores.concentrationScore * weights.concentration +
        scores.stablecoinRatioScore * weights.stablecoin +
        scores.bluechipScore * weights.bluechip,
    );
  }
}
