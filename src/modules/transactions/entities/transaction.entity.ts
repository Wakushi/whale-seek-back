export interface TransactionRecord {
  id: string;
  transaction_hash: string;
  block_number: string;
  from_address: string;
  to_address: string;
  contract_address: string;
  value: number;
  asset: string;
  category: 'external' | 'token';
  decimals: number;
  raw_value: string;
  network: string;
  timestamp?: string;
}
