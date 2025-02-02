import { Injectable } from '@nestjs/common';
import { GraphService } from '../graph/graph.service';
import { WethTransferQuery } from '../graph/entities/graph.types';
import { Address } from 'viem';
import { SupabaseService } from '../supabase/supabase.service';
import { Collection } from '../supabase/entities/collections';

@Injectable()
export class DiscoveryService {
  constructor(
    private readonly graphService: GraphService,
    private readonly supabaseService: SupabaseService,
  ) {}

  public async findWhales(): Promise<Address[]> {
    const recentTransfers = await this.queryLargeTransfers();

    const whalesSet: Set<Address> = new Set();

    recentTransfers.forEach((transfer) => {
      whalesSet.add(transfer.initiator);
    });

    const whales = Array.from(whalesSet);

    return whales;
  }

  public async saveWhales(whaleAddresses: Address[]): Promise<void> {
    const now = new Date();

    const whalesInfo = whaleAddresses.map((address) => ({
      whale_address: address,
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
