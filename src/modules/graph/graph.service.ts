import { Inject, Injectable, Logger } from '@nestjs/common';
import { GraphQLClient, gql } from 'graphql-request';
import { WethTransferQuery } from './entities/graph.types';

@Injectable()
export class GraphService {
  private readonly logger = new Logger(GraphService.name);
  private readonly client: GraphQLClient;

  constructor(
    @Inject('GRAPH_CONFIG')
    private readonly config: { graphApiKey: string },
  ) {
    const url =
      'https://api.studio.thegraph.com/query/103040/base-whales/version/latest';
    this.client = new GraphQLClient(url);
  }

  async queryLargeWethTransfers({
    fromTimestamp,
    minWethTransfered = 100,
    maxResults = 200,
  }: {
    fromTimestamp: number;
    minWethTransfered?: number;
    maxResults?: number;
  }): Promise<WethTransferQuery[]> {
    const query = gql`
      {
        transfers(
          first: ${maxResults}
          where: {
            wad_gt: "${(minWethTransfered * 10 ** 18).toString()}"
            blockTimestamp_gt: "${fromTimestamp.toString()}"
          }
          orderBy: wad
          orderDirection: desc
        ) {
          transactionHash
          initiator
          src
          dst
          wad
          blockTimestamp
        }
      }
    `;

    try {
      const { transfers } = await this.client.request<any>(query);
      return transfers as WethTransferQuery[];
    } catch (error) {
      this.logger.error('Failed to fetch data from TheGraph:', error);
      throw error;
    }
  }
}
