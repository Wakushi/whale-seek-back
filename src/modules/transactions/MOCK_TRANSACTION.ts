import { TransactionRecord } from './entities/transaction.entity';

export const MOCK_TRANSACTION: Omit<TransactionRecord, 'id'> = {
  transaction_hash:
    '0x19d90c2ba73f1e1965a740b1c8437d3f08fc076fa551938f1ff2ffe62fff8571',
  block_number: '0x148b002',
  from_address: '0x35e34708c7361f99041a9b046c72ea3fcb29134c',
  to_address: '0xbeeb994964666ebf00a118a4669b7c1b36c851a2',
  contract_address: '0xe4ab69c077896252fafbd49efd26b5d171a32410',
  value: 20000,
  asset: 'LINK',
  category: 'token',
  decimals: 18,
  raw_value:
    '0x0000000000000000000000000000000000000000000000001bc16d674ec80000',
  timestamp: '2025-02-06T13:53:41.753459+00:00',
  network: 'BASE_SEPOLIA',
};
