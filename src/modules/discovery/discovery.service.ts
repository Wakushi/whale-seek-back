import { Injectable } from '@nestjs/common';
import { GraphService } from '../graph/graph.service';
import { WethTransferQuery } from '../graph/entities/graph.types';
import { Address } from 'viem';

@Injectable()
export class DiscoveryService {
  constructor(private readonly graphService: GraphService) {}

  async findWhales(): Promise<any> {
    const recentTransfers = await this.queryLargeTransfers();

    const whales: Set<Address> = new Set();
  }

  async queryLargeTransfers(): Promise<WethTransferQuery[]> {
    const today = Math.floor(Date.now() / 1000);
    const ONE_MONTH = 30 * 24 * 60 * 60;
    const oneMonthAgo = today - ONE_MONTH;

    try {
      const transfers = await this.graphService.queryLargeWethTransfers({
        fromTimestamp: oneMonthAgo,
        minWethTransfered: 100,
      });

      return transfers;
    } catch (error) {
      console.error(error);
    }
  }
}
