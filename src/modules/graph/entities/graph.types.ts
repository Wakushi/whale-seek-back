import { Address } from 'viem';

export interface WethTransferQuery {
  id: string;
  initiator: Address;
  wad: string;
  src: Address;
  dst: Address;
  blockTimestamp: string;
}
