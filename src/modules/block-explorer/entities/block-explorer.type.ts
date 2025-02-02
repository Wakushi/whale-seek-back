export interface BlockExplorerConfig {
  name: string;
  apiUrl: string;
  chainId: number;
}

export interface FetchTransactionsParams {
  address: string;
  startBlock?: number;
  endBlock?: number;
  startDate?: Date;
  endDate?: Date;
  sort?: 'asc' | 'desc';
  config: BlockExplorerConfig;
  includeERC20?: boolean;
  includeNormalTxs?: boolean;
}

export interface BlockExplorerTransaction {
  blockNumber: string;
  timeStamp: string;
  hash: string;
  from: string;
  to: string;
  value: string;
  gasPrice: string;
  gasUsed: string;
  input: string;
  methodId: string;
  functionName: string;
  contractAddress?: string;
  tokenName?: string;
  tokenSymbol?: string;
  tokenDecimal?: string;
}

export interface BlockExplorerResponse {
  status: string;
  message: string;
  result: BlockExplorerTransaction[];
}

export const CHAIN_CONFIGS: { [key: number]: BlockExplorerConfig } = {
  1: {
    name: 'Ethereum',
    apiUrl: 'https://api.etherscan.io/api',
    chainId: 1,
  },
  137: {
    name: 'Polygon',
    apiUrl: 'https://api.polygonscan.com/api',
    chainId: 137,
  },
  8453: {
    name: 'Base',
    apiUrl: 'https://api.basescan.org/api',
    chainId: 8453,
  },
};
