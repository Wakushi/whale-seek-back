import { Injectable, Logger } from '@nestjs/common';
import { GraphService } from '../graph/graph.service';
import { WethTransferQuery } from '../graph/entities/graph.types';
import { Address } from 'viem';
import { SupabaseService } from '../supabase/supabase.service';
import { Collection } from '../supabase/entities/collections';
import { Whale, WhaleDetection } from './entities/discovery.type';
import { AnalysisService } from '../analysis/analysis.service';

@Injectable()
export class DiscoveryService {
  private readonly logger = new Logger(DiscoveryService.name);

  constructor(
    private readonly graphService: GraphService,
    private readonly supabaseService: SupabaseService,
    private readonly analysisService: AnalysisService,
  ) {}

  public async discoverWhales(): Promise<void> {
    // const whales = await this.findWhales();

    const whales = await this.supabaseService.getAll<Whale>(
      Collection.WHALE_INFO,
    );

    // FOR TESTING PURPOSES
    const SMALL_SAMPLE: Address[] = [
      '0xa30965a445963ab0d016c86df1a905c2f58b379f',
    ];

    for (const whale of SMALL_SAMPLE) {
      this.logger.log(`Analysing whale ${whale}`);
      await this.analysisService.analyseWallet(whale);
    }
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
