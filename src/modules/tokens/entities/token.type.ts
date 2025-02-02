import { Address } from 'viem';

export type WalletToken = {
  name: string;
  contractAddress: string;
  symbol: string;
};

export type WalletTokenBalance = WalletToken & {
  balance: string;
  valueInUSD: string;
};

export type Wallet = {
  address: Address;
  tokens: WalletTokenBalance[];
};

export const NULL_BALANCE =
  '0x0000000000000000000000000000000000000000000000000000000000000000';
