import { Injectable, Logger } from '@nestjs/common';
import { GraphService } from '../graph/graph.service';
import { WethTransferQuery } from '../graph/entities/graph.types';
import { Address } from 'viem';
import { SupabaseService } from '../supabase/supabase.service';
import { Collection } from '../supabase/entities/collections';
import { Whale, WhaleDetection } from './entities/discovery.type';
import { AnalysisService } from '../analysis/analysis.service';
import { AccountAnalysis } from '../analysis/entities/analysis.type';
import { TokensService } from '../tokens/tokens.services';
import { sortWhalesByEfficiency } from 'src/utils/performances.helper';
import { WebhookService } from '../webhook/webhook.service';

@Injectable()
export class DiscoveryService {
  private readonly logger = new Logger(DiscoveryService.name);

  constructor(
    private readonly graphService: GraphService,
    private readonly supabaseService: SupabaseService,
    private readonly analysisService: AnalysisService,
    private readonly tokenService: TokensService,
    private readonly webhookService: WebhookService,
  ) {}

  public async discoverWhales(): Promise<void> {
    const foundWhales = await this.findWhales();

    const registeredWhales = await this.supabaseService.getAll<Whale>(
      Collection.WHALE_INFO,
    );

    const newWhales = foundWhales.filter(
      (foundWhale) =>
        !registeredWhales.some(
          (registeredWhale) =>
            registeredWhale.whale_address === foundWhale.address,
        ),
    );

    this.logger.log(`Detected ${newWhales.length} new whales...`);

    const walletScores: Map<WhaleDetection, AccountAnalysis> = new Map();

    const coinCodexList = await this.tokenService.getCoinCodexCoinList();

    if (!coinCodexList || !coinCodexList.length) {
      this.logger.log('Coin Codex list not fetched, cancelling discovery');
      return;
    }

    for (const whale of newWhales) {
      this.logger.log(`Analysing whale ${whale.address}`);

      const accountAnalysis = await this.analysisService.analyseAccount(
        whale.address,
        coinCodexList,
      );

      if (!accountAnalysis) continue;

      walletScores.set(whale, accountAnalysis);
    }

    const sortedWhales = sortWhalesByEfficiency(walletScores);
    const filteredWhales = sortedWhales.filter((whale) => whale.score > 70);

    if (filteredWhales.length) {
      await this.saveWhales(filteredWhales.map((w) => w.whaleDetection));
    }

    this.logger.log(
      `Completed whale discovery. Saved ${filteredWhales.length} new whales!`,
    );
  }

  public async findWhales(): Promise<WhaleDetection[]> {
    const recentTransfers = await this.queryLargeTransfers();

    const whalesMap: Map<Address, WhaleDetection> = new Map();

    recentTransfers.forEach((transfer) => {
      const { transactionHash, initiator } = transfer;

      if (!whalesMap.has(initiator)) {
        whalesMap.set(initiator, { address: initiator, transactionHash });
      }
    });

    const whales = Array.from(whalesMap.values());

    return whales;
  }

  private async saveWhales(detectedWhales: WhaleDetection[]): Promise<void> {
    const now = new Date();

    const whalesInfo = detectedWhales.map(({ address, transactionHash }) => ({
      whale_address: address,
      detected_transaction_id: transactionHash,
      first_seen: now,
      last_seen: now,
    }));

    this.supabaseService.batchInsert({
      collection: Collection.WHALE_INFO,
      items: whalesInfo,
      conflictTarget: 'whale_address',
    });

    try {
      const addresses = detectedWhales.map((whale) => whale.address);
      await this.webhookService.addAddresses({
        addresses_to_add: addresses,
      });
      this.logger.log(
        `Successfully added ${addresses.length} whale addresses to webhook tracking`,
      );
    } catch (error) {
      console.error('Error adding addresses to webhook:', error);
    }
  }

  private async queryLargeTransfers(): Promise<WethTransferQuery[]> {
    const today = Math.floor(Date.now() / 1000);
    const ONE_MONTH = 30 * 24 * 60 * 60;
    const oneMonthAgo = today - ONE_MONTH;

    try {
      const transfers = await this.graphService.queryLargeWethTransfers({
        fromTimestamp: oneMonthAgo,
        minWethTransfered: 50,
      });

      return transfers;
    } catch (error) {
      console.error(error);
    }
  }
}
