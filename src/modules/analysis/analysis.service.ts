import { Injectable, Logger } from '@nestjs/common';
import { TokensService } from '../tokens/tokens.services';
import { AlchemyService } from '../alchemy/alchemy.service';
import { Address } from 'viem';
import { AssetTransfersResult, Network } from 'alchemy-sdk';
import {
  CoinCodexBaseTokenData,
  CoinCodexCsvDailyMetrics,
} from '../tokens/entities/coin-codex.type';
import {
  AccountAnalysis,
  PortfolioPerformance,
  ProfitLossResult,
  TransferToken,
} from './entities/analysis.type';
import { WalletAnalyzer } from './wallet-analyser';
import { Wallet } from '../tokens/entities/token.type';
import {
  calculatePortfolioPerformance,
  calculateProfitAndLoss,
  formatTransfer,
} from './entities/analysis.helper';

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
      const walletHoldings: Wallet = await this.alchemyService.getTokenBalances(
        wallet,
        Network.BASE_MAINNET,
      );

      const analyzer = new WalletAnalyzer();

      const walletAnalysis = analyzer.analyzeWalletDistribution(walletHoldings);

      const transfers = await this.alchemyService.getWalletTokenTransfers(
        wallet,
        Network.BASE_MAINNET,
      );

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
        dailyMetrics = await this.tokenService.getTokenDailyMetrics(
          token,
          matchTokenSymbol,
        );
        metricsByTokenSymbol.set(matchTokenSymbol, dailyMetrics);
      }

      if (!dailyMetrics.length) {
        this.logger.log(
          `No metrics found for  ${matchTokenSymbol}. Skipping..`,
        );
        continue;
      }

      this.logger.log(`Formatting ${matchTokenSymbol} transfers ..`);

      const formattedTransfers = formatTransfer(transfers, wallet);

      if (formattedTransfers.length < 2) {
        this.logger.log(
          `Not enough transfers for ${matchTokenSymbol}. Skipping..`,
        );
        continue;
      }

      const profitAndLoss = calculateProfitAndLoss(
        formattedTransfers,
        dailyMetrics,
      );

      tokenResults.set(matchTokenSymbol, profitAndLoss);
      totalAbsoluteValue += Math.abs(profitAndLoss.netProfit);
    }

    return calculatePortfolioPerformance(tokenResults);
  }
}
