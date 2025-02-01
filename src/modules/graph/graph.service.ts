import { Inject, Injectable, Logger } from '@nestjs/common';
import { GraphQLClient, gql } from 'graphql-request';

export interface Factory {
  id: string;
  poolCount: string;
  txCount: string;
  totalVolumeUSD: string;
}

export interface Bundle {
  id: string;
  ethPriceUSD: string;
}

export interface UniswapQueryResult {
  factories: Factory[];
  bundles: Bundle[];
}

@Injectable()
export class GraphService {
  private readonly logger = new Logger(GraphService.name);
  private readonly endpoint: string;
  private readonly client: GraphQLClient;

  private readonly UNISWAP_V3_BASE_GRAPH_ID =
    'GqzP4Xaehti8KSfQmv3ZctFSjnSUYZ4En5NRsiTbvZpz';

  constructor(
    @Inject('GRAPH_CONFIG')
    private readonly config: { graphApiKey: string },
  ) {
    const url = `https://gateway.thegraph.com/api/${config.graphApiKey}/subgraphs/id/${this.UNISWAP_V3_BASE_GRAPH_ID}`;
    this.client = new GraphQLClient(url);
  }

  async queryUniswapData(): Promise<UniswapQueryResult> {
    const query = gql`
      {
        factories(first: 5) {
          id
          poolCount
          txCount
          totalVolumeUSD
        }
        bundles(first: 5) {
          id
          ethPriceUSD
        }
      }
    `;

    try {
      const data = await this.client.request<UniswapQueryResult>(query);
      return data;
    } catch (error) {
      this.logger.error('Failed to fetch data from TheGraph:', error);
      throw error;
    }
  }
}
