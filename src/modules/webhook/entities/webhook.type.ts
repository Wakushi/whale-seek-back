export interface WebhookPayload {
  webhookId: string;
  id: string;
  createdAt: string;
  type: string;
  event: AddressActivityEvent;
}

interface AddressActivityEvent {
  network: string;
  activity: Activity[];
}

interface Activity {
  blockNum: string;
  hash: string;
  fromAddress: string;
  toAddress: string;
  value: number;
  erc721TokenId: null | string;
  erc1155Metadata: null | any;
  asset: string;
  category: 'external' | 'token';
  rawContract: RawContract;
  typeTraceAddress: null | string;
  log: LogEntry;
}

interface RawContract {
  rawValue: string;
  address: string;
  decimals: number;
}

interface LogEntry {
  address: string;
  topics: string[];
  data: string;
  blockNumber: string;
  transactionHash: string;
  transactionIndex: string;
  blockHash: string;
  logIndex: string;
  removed: boolean;
}
