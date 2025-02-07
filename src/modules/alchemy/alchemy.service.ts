import { Inject, Injectable } from '@nestjs/common';
import {
  Alchemy,
  AssetTransfersCategory,
  AssetTransfersResult,
  AssetTransfersWithMetadataParams,
  AssetTransfersWithMetadataResponse,
  Network,
} from 'alchemy-sdk';
import { hexToDecimal } from 'src/utils/math.helper';
import { Address } from 'viem';
import {
  NULL_BALANCE,
  Wallet,
  WalletTokenBalance,
} from '../tokens/entities/token.type';
import { TokensService } from '../tokens/tokens.services';

@Injectable()
export class AlchemyService {
  constructor(
    @Inject('ALCHEMY_CONFIG')
    private readonly config: { apiKey: string; network: Network },
    private readonly tokenService: TokensService,
  ) {}

  public async getTokenBalances(
    walletAddress: Address,
    chain: Network = Network.BASE_MAINNET,
  ): Promise<Wallet> {
    const client = new Alchemy({
      apiKey: this.config.apiKey,
      network: chain,
    });

    try {
      const ethBalanceHex = await client.core.getBalance(walletAddress);
      const ethBalanceHexString = ethBalanceHex.toHexString();
      const ethBalance = hexToDecimal(ethBalanceHexString, 18);

      const ethPrice = await this.getTokenPriceInUSD('ETHEREUM');
      const ethValueInUSD = ethBalance * ethPrice;

      const balances = await client.core.getTokenBalances(walletAddress);

      const nonZeroBalances = balances.tokenBalances.filter((token) => {
        return token.tokenBalance !== NULL_BALANCE;
      });

      const formattedBalances: WalletTokenBalance[] = await Promise.all(
        nonZeroBalances.map(async (balance) => {
          const metadata = await this.getTokenMetadata(
            balance.contractAddress as Address,
            chain,
          );

          const tokenAmount = hexToDecimal(
            balance.tokenBalance,
            metadata.decimals,
          );

          const tokenPrice = await this.getTokenPriceInUSD(metadata.name);

          const valueInUSD = tokenAmount * tokenPrice;

          return {
            contractAddress: balance.contractAddress,
            name: metadata.name,
            symbol: metadata.symbol,
            balance: tokenAmount.toFixed(4),
            valueInUSD: valueInUSD.toFixed(2),
          };
        }),
      );

      const allBalances = [
        {
          contractAddress: null,
          name: 'Ethereum',
          symbol: 'ETH',
          balance: ethBalance.toFixed(4),
          valueInUSD: ethValueInUSD.toFixed(2),
        },
        ...formattedBalances,
      ];

      return {
        address: walletAddress,
        tokens: allBalances,
      };
    } catch (error) {
      console.error('Error fetching token balances:', error);
      throw new Error('Failed to fetch token balances');
    }
  }

  public async getTokenMetadata(
    contractAddress: Address,
    chain: Network = Network.BASE_MAINNET,
  ): Promise<{
    name: string;
    symbol: string;
    decimals: number;
  }> {
    try {
      const client = new Alchemy({
        apiKey: this.config.apiKey,
        network: chain,
      });

      const metadata = await client.core.getTokenMetadata(contractAddress);
      return {
        name: metadata.name || 'Unknown Token',
        symbol: metadata.symbol || 'UNKNOWN',
        decimals: metadata.decimals || 18,
      };
    } catch (error) {
      console.error('Error fetching token metadata:', error);
      return {
        name: 'Unknown Token',
        symbol: 'UNKNOWN',
        decimals: 18,
      };
    }
  }

  private async getTokenPriceInUSD(tokenName: string): Promise<number> {
    return this.tokenService.getTokenPrice(tokenName);
  }

  public async getWalletTokenTransfers(
    walletAddress: Address,
    chain: Network = Network.BASE_MAINNET,
  ): Promise<AssetTransfersResult[]> {
    try {
      const client = new Alchemy({
        apiKey: this.config.apiKey,
        network: chain,
      });

      const allTransfers: AssetTransfersResult[] = [];

      const getTransfers = async (
        type: 'from' | 'to',
        pageKey?: string,
      ): Promise<AssetTransfersWithMetadataResponse> => {
        const payload: AssetTransfersWithMetadataParams = {
          category: [
            AssetTransfersCategory.EXTERNAL,
            AssetTransfersCategory.ERC20,
          ],
          withMetadata: true,
        };

        if (type === 'from') {
          payload.fromAddress = walletAddress;
        } else {
          payload.toAddress = walletAddress;
        }

        if (pageKey) {
          payload.pageKey = pageKey;
        }

        const data = await client.core.getAssetTransfers(payload);

        return data;
      };

      const getAllPageTransfers = async (
        type: 'from' | 'to',
      ): Promise<AssetTransfersResult[]> => {
        const transfers: AssetTransfersResult[] = [];

        let lastPageKey = '';

        const firstTransfer = await getTransfers(type);
        transfers.push(...firstTransfer.transfers);

        lastPageKey = firstTransfer.pageKey;

        while (lastPageKey) {
          const transfer = await getTransfers(type, lastPageKey);
          transfers.push(...transfer.transfers);
          lastPageKey = transfer?.pageKey || '';
        }

        return transfers;
      };

      const allFromTransfers = await getAllPageTransfers('from');
      const allToTransfers = await getAllPageTransfers('to');

      allTransfers.push(...allFromTransfers, ...allToTransfers);

      return allTransfers;
    } catch (error: any) {
      console.log(
        `Error fetching token transfers for wallet ${walletAddress}`,
        error.body,
      );
      return [];
    }
  }
}
