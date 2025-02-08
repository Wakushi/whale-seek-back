import { Address } from 'viem';

export type WhaleDetection = {
  address: Address;
  transactionHash: string;
};

export type Whale = {
  whale_address: Address;
  detected_transaction_id: string;
  first_seen: string;
  last_seen: string;
  created_at: string;
  updated_at: string;
  score: number;
};
