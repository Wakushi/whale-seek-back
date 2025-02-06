import { Injectable, Logger } from '@nestjs/common';
import { ViemWalletProvider, customActionProvider } from '@coinbase/agentkit';
import {
  Address,
  encodeFunctionData,
  parseEther,
  TransactionRequest,
} from 'viem';
import {
  BASE_SEPOLIA_FACTORY_ABI,
  BASE_SEPOLIA_FACTORY_ADDRESS,
} from 'src/utils/constants/contract';
import { z } from 'zod';
import { TokensService } from '../tokens/tokens.services';
import { BraveService } from '../brave/brave.service';
import { AlchemyService } from '../alchemy/alchemy.service';
import { Network } from 'alchemy-sdk';

@Injectable()
export class AgentToolService {
  private readonly logger = new Logger(AgentToolService.name);

  constructor(
    private readonly tokensService: TokensService,
    private readonly braveService: BraveService,
    private readonly alchemyService: AlchemyService,
  ) {}

  public get tools(): any[] {
    return [
      this.deployTradingWallet,
      this.convertEthToWei,
      this.getTokenMarketDataById,
      this.getTokenBalances,
      this.searchWeb,
      this.getOwnerTradingWallets,
    ];
  }

  private deployTradingWallet = customActionProvider<ViemWalletProvider>({
    name: 'deploy_wallet',
    description:
      'Calls a smart contract factory method to deploy a trading wallet for a user.',
    schema: z.object({
      account: z.string().describe('User address to deploy the wallet for'),
    }),
    invoke: async (walletProvider, args: any) => {
      const { account } = args;

      this.logger.log(`Deploying trading wallet for account ${account}...`);

      const agentAddress = walletProvider.getAddress();

      const transaction: TransactionRequest = {
        to: BASE_SEPOLIA_FACTORY_ADDRESS,
        data: encodeFunctionData({
          abi: BASE_SEPOLIA_FACTORY_ABI,
          functionName: 'deployWallet',
          args: [account, agentAddress],
        }),
      };

      const hash = await walletProvider.sendTransaction(transaction);

      return `Transaction hash: ${hash}`;
    },
  });

  private getTokenBalances = customActionProvider<ViemWalletProvider>({
    name: 'get_token_balances',
    description:
      'Retrieves the ERC-20 token balances for a given wallet address.',
    schema: z.object({
      walletAddress: z.string(),
      chain: z.enum([Network.BASE_MAINNET, Network.BASE_SEPOLIA]),
    }),
    invoke: async (walletProvider, args: any) => {
      const { walletAddress, chain } = args;

      this.logger.log(
        `Fetching token balances for ${walletAddress} wallet on ${chain}...`,
      );

      const wallet = await this.alchemyService.getTokenBalances(
        walletAddress,
        chain,
      );

      return wallet;
    },
  });

  private convertEthToWei = customActionProvider<ViemWalletProvider>({
    name: 'convert_eth_to_wei',
    description:
      'Converts a human readable ETH amount to its WEI equivalent if needed before doing a transaction. Can be used for all 18 decimals ERC-20 tokens',
    schema: z.object({
      amount: z.string().describe('Amount in ETH to convert to WEI'),
    }),
    invoke: async (walletProvider, args: any) => {
      const { amount } = args;

      this.logger.log(`Converting ${amount} to WEI amount...`);

      const weiAmount = parseEther(amount);

      return `${amount} ETH = ${weiAmount} WEI`;
    },
  });

  private getTokenMarketDataById = customActionProvider<ViemWalletProvider>({
    name: 'get_token_market_data_by_id',
    description:
      'Retrieves the market data of a token based on its token name or token ID.',
    schema: z.object({
      tokenName: z.string(),
    }),
    invoke: async (walletProvider, args: any) => {
      const { tokenName } = args;

      this.logger.log(`Fetching ${tokenName} market data...`);

      const tokenData =
        await this.tokensService.getTokenMarketDataById(tokenName);

      return tokenData;
    },
  });

  private searchWeb = customActionProvider<ViemWalletProvider>({
    name: 'search_web',
    description: 'Perform an internet search',
    schema: z.object({
      query: z.string(),
    }),
    invoke: async (walletProvider, args: any) => {
      const { query } = args;

      this.logger.log(`Search web with query '${query}'...`);

      const result = await this.braveService.search(query);

      return result;
    },
  });

  private getOwnerTradingWallets = customActionProvider<ViemWalletProvider>({
    name: 'get_owner_trading_wallets',
    description:
      'Retrieves all trading wallet addresses owned by a specific address from the factory contract.',
    schema: z.object({
      owner: z.string().describe('Address to get owned wallets for'),
    }),
    invoke: async (walletProvider, args: any) => {
      const { owner } = args;

      this.logger.log(`Fetching ${owner} trading wallets...`);

      const wallets = (await walletProvider.readContract({
        address: BASE_SEPOLIA_FACTORY_ADDRESS,
        abi: [
          {
            type: 'function',
            name: 'getOwnerWallets',
            inputs: [
              {
                internalType: 'address',
                name: 'owner',
                type: 'address',
              },
            ],
            outputs: [
              {
                internalType: 'address[]',
                name: '',
                type: 'address[]',
              },
            ],
            stateMutability: 'view',
          },
        ],
        functionName: 'getOwnerWallets',
        args: [owner],
      })) as Address[];

      if (wallets.length === 0) {
        return `No wallets found for address ${owner}`;
      }

      return `Trading Wallet owned by ${owner}:\n${wallets.join(', ')}`;
    },
  });
}
