import { Address } from 'viem';

export interface WethTransferQuery {
  initiator: Address;
  wad: string;
  src: Address;
  dst: Address;
  blockTimestamp: string;
  transactionHash: string;
}
