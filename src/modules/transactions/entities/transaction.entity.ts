import { BigNumber } from 'alchemy-sdk';
import { Address } from 'viem';

export interface TransactionRecord {
  id: string;
  transaction_hash: string;
  block_number: string;
  whale_address: string;
  input_token: string;
  output_token: string;
  value: number;
  asset: string;
  decimals: number;
  raw_value: string;
  network: string;
  timestamp?: string;
  trade_wallet_percentage?: number;
  protocol: string;
}

export interface DEXProtocol {
  name: string;
  routers: string[];
  factory?: string;
}

export interface Transfer {
  token: string;
  from: string;
  to: string;
  value: BigNumber;
}

export interface SwapAnalysis {
  protocol: string;
  inputToken: string | undefined;
  outputToken: string | undefined;
  initiator: Address;
}
