import { Address } from 'viem';
import { TokenAnalysis } from '../wallet-analyser';

export type FormattedTransfer = {
  transactionHash: string;
  timestamp: number;
  type: 'SELL' | 'BUY';
  value: number;
};

export type TransferToken = {
  name: string;
  address: Address;
};

export type ProfitLossResult = {
  totalProfit: number;
  totalLoss: number;
  netProfit: number;
  tradeCount: number;
};

export type TokenPerformanceMetrics = {
  totalProfit: number;
  totalLoss: number;
  netProfit: number;
  tradeCount: number;
  profitabilityScore: number;
  contribution: number;
};

export type PortfolioPerformance = {
  globalScore: number;
  totalNetProfit: number;
  tokenMetrics: Map<string, TokenPerformanceMetrics>;
  profitableTokens: number;
  unprofitableTokens: number;
};

export type AccountAnalysis = {
  walletAnalysis: TokenAnalysis;
  profitabilityScore: PortfolioPerformance;
};
