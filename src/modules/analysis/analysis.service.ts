import { Injectable, Logger } from '@nestjs/common';
import { TokensService } from '../tokens/tokens.services';
import { AlchemyService } from '../alchemy/alchemy.service';
import { Address } from 'viem';
import { BlockExplorerService } from '../block-explorer/block-explorer.service';
import { AssetTransfersResult } from 'alchemy-sdk';
import { MOCK_TRANSFERS } from './mock-transfer';

type FormattedTransfer = {
  transactionHash: string;
  timestamp: number;
  type: 'SELL' | 'BUY';
  value: number;
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

      // const transfers =
      //   await this.alchemyService.getWalletTokenTransfers(wallet);

      // this.logger.log(
      //   `Found ${transfers.length} ERC20 transfers for wallet ${wallet}!`,
      // );

      await this.analyseTransfers(MOCK_TRANSFERS, wallet);
    } catch (error) {
      console.error('Error analysing wallet: ', error);
    }
  }

  private async analyseTransfers(
    transfers: AssetTransfersResult[],
    wallet: Address,
  ) {
    const tokenTransfers: Map<string, AssetTransfersResult[]> = new Map();

    transfers.forEach((transfer) => {
      const tokenAddress = transfer.rawContract.address;

      if (tokenTransfers.has(tokenAddress)) {
        tokenTransfers.set(tokenAddress, [
          ...tokenTransfers.get(tokenAddress),
          transfer,
        ]);
        return;
      }

      tokenTransfers.set(tokenAddress, [transfer]);
    });

    for (const [token, transfers] of tokenTransfers.entries()) {
      const formattedTransfers = await this.formatTransfer(transfers, wallet);
    }
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
