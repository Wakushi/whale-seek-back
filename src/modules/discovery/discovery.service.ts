import { Injectable } from '@nestjs/common';
import { GraphService } from '../graph/graph.service';
import { WethTransferQuery } from '../graph/entities/graph.types';
import { Address } from 'viem';
import { SupabaseService } from '../supabase/supabase.service';
import { Collection } from '../supabase/entities/collections';
import { WhaleDetection } from './entities/discovery.type';
import { AnalysisService } from '../analysis/analysis.service';
import { WebhookService } from '../webhook/webhook.service';

@Injectable()
export class DiscoveryService {
  constructor(
    private readonly graphService: GraphService,
    private readonly supabaseService: SupabaseService,
    private readonly analysisService: AnalysisService,
    private readonly webhookService: WebhookService,
  ) {}

  public async discoverWhales(): Promise<void> {
    const whales = await this.findWhales();

    for (const whale of whales) {
      await this.analysisService.analyseWallet(whale.address);
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

  public async saveWhales(detectedWhales: WhaleDetection[]): Promise<void> {
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
      const addresses = detectedWhales.map(whale => whale.address);
      await this.webhookService.addAddresses({
        addresses_to_add: addresses
      });
      console.log(`Successfully added ${addresses.length} whale addresses to webhook tracking`);
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
