export type TokenTransfer = {
  contract: string;
  token: string;
  decimals: number;
};

export type Transaction = {
  hash: string;
  timestamp: Date;
  from: string;
  to: string;
  value: string;
  gasUsed: string;
  gasPrice: string;
  tokenTransfer: TokenTransfer | null;
};
