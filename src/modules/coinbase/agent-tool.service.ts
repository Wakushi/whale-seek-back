import { Injectable, Logger } from '@nestjs/common';
import { ViemWalletProvider, customActionProvider } from '@coinbase/agentkit';
import {
  Address,
  decodeFunctionResult,
  encodeFunctionData,
  encodePacked,
  getAddress,
  parseEther,
  parseUnits,
  TransactionRequest,
} from 'viem';
import {
  FACTORY_ABI,
  BASE_MAINNET_FACTORY_ADDRESS,
  WALLET_ABI,
} from 'src/utils/constants/contract';
import { z } from 'zod';
import { TokensService } from '../tokens/tokens.services';
import { BraveService } from '../brave/brave.service';
import { AlchemyService } from '../alchemy/alchemy.service';
import { Network } from 'alchemy-sdk';
import { Agent } from './entities/agent.type';
import { QUOTER_V2_ABI, QUOTER_V2_ADDRESS } from 'src/utils/constants/uniswap';

const TransactionAnalystResponseFormatter = z.object({
  analysis: z.string(),
  score: z.number(),
});

const GeneralResponseFormatter = z.object({
  answer: z.string(),
  suggestions: z.number(),
});

@Injectable()
export class AgentToolService {
  private readonly logger = new Logger(AgentToolService.name);

  constructor(
    private readonly tokensService: TokensService,
    private readonly braveService: BraveService,
    private readonly alchemyService: AlchemyService,
  ) {}

  public getAgentTools(agent: Agent = Agent.GENERAL): any[] {
    switch (agent) {
      case Agent.GENERAL:
        return [
          this.deployTradingWallet,
          this.convertEthToWei,
          this.getTokenMarketDataById,
          this.getTokenBalances,
          this.searchWeb,
          this.getOwnerTradingWallet,
        ];
      case Agent.TRANSACTION_ANALYST:
        return [
          this.getTokenMarketDataByContract,
          this.convertEthToWei,
          this.getTokenBalances,
          this.searchWeb,
        ];
      case Agent.TRADING:
        return [
          this.swapTokens,
          this.getTokenBalances,
          this.getTokenMarketDataById,
        ];
      default:
        return [
          this.deployTradingWallet,
          this.convertEthToWei,
          this.getTokenMarketDataById,
          this.getTokenBalances,
          this.searchWeb,
          this.getOwnerTradingWallet,
        ];
    }
  }

  public getAgentFormatting(agent: Agent = Agent.GENERAL): any {
    switch (agent) {
      case Agent.GENERAL:
        return GeneralResponseFormatter;
      case Agent.TRANSACTION_ANALYST:
        return TransactionAnalystResponseFormatter;
      default:
        return GeneralResponseFormatter;
    }
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
        to: BASE_MAINNET_FACTORY_ADDRESS,
        data: encodeFunctionData({
          abi: FACTORY_ABI,
          functionName: 'deployWallet',
          args: [account, agentAddress],
        }),
      };

      const hash = await walletProvider.sendTransaction(transaction);

      return `Transaction hash: ${hash}`;
    },
  });

  private swapTokens = customActionProvider<ViemWalletProvider>({
    name: 'swap_tokens',
    description: `Executes a token swap using Uniswap V3 through a trading wallet. 
      Automatically calculates the minimum output amount with a 0.5% slippage tolerance.
      The swap is executed using a single-hop path with a 0.3% fee tier.
      
      Required parameters:
      - wallet: The trading wallet address that will execute the swap
      - tokenIn: The address of the token to swap from
      - tokenOut: The address of the token to swap to
      - amountIn: The amount of input tokens to swap (in wei)
      
      Returns the transaction hash of the executed swap.
      
      Note: Ensures price protection by fetching real-time quotes from Uniswap's on-chain Quoter V2 contract.`,
    schema: z.object({
      wallet: z
        .string()
        .describe('Trading wallet address that will execute the swap'),
      tokenIn: z.string().describe('Address of the token to swap from'),
      tokenOut: z.string().describe('Address of the token to swap to'),
      amountIn: z.string().describe('Amount of input tokens to swap (in wei)'),
    }),
    invoke: async (walletProvider, args: any) => {
      const { wallet, tokenIn, tokenOut, amountIn } = args;

      const formattedTokenIn = getAddress(tokenIn);
      const formattedTokenOut = getAddress(tokenOut);

      const getQuote = async () => {
        try {
          const params = {
            poolKey: {
              currency0: formattedTokenIn,
              currency1: formattedTokenOut,
              fee: 3000,
              tickSpacing: 60,
              hooks: '0x0000000000000000000000000000000000000000',
            },
            zeroForOne: true,
            exactAmount: amountIn,
            hookData: '0x',
          };

          const result: any = await walletProvider.readContract({
            address: QUOTER_V2_ADDRESS,
            abi: QUOTER_V2_ABI,
            functionName: 'quoteExactInputSingle',
            args: [params],
          });

          const [amountOut] = result;

          return (BigInt(amountOut) * 995n) / 1000n;
        } catch (error) {
          return 0;
        }
      };

      try {
        const amountOutMin = await getQuote();

        this.logger.log(
          `Preparing swap tokens for wallet ${wallet}:
        Token In: ${tokenIn} 
        Token Out: ${tokenOut} 
        Amount In: ${amountIn}
        Min Amount Out: ${amountOutMin}`,
        );

        const transaction: TransactionRequest = {
          to: wallet,
          data: encodeFunctionData({
            abi: WALLET_ABI,
            functionName: 'swapExactInputSingleHop',
            args: [formattedTokenIn, formattedTokenOut, amountIn, amountOutMin],
          }),
        };

        const hash = await walletProvider.sendTransaction(transaction);

        this.logger.log(`Swap executed -> ${hash}`);

        return `Swap executed ! Transaction hash: ${hash}`;
      } catch (error) {
        this.logger.error('Swap failed !');
        return 'Swap failed !'
      }
    },
  });

  private getTokenBalances = customActionProvider<ViemWalletProvider>({
    name: 'get_token_balances',
    description:
      'Retrieves the ERC-20 token balances for a given wallet address.',
    schema: z.object({
      walletAddress: z.string(),
    }),
    invoke: async (walletProvider, args: any) => {
      const { walletAddress } = args;

      const chain = Network.BASE_MAINNET;

      this.logger.log(
        `Fetching token balances for ${walletAddress} wallet on ${chain}...`,
      );

      const wallet = await this.alchemyService.getTokenBalances(
        walletAddress,
        chain,
      );

      wallet.tokens.forEach((t, i) => {
        console.log(`${i + 1}. ${t.name} (${t.symbol}) - ${t.balance}`);
      });

      return wallet;
    },
  });

  private getTokenMarketDataByContract =
    customActionProvider<ViemWalletProvider>({
      name: 'get_token_market_data_by_contract_address',
      description:
        'Retrieves the market data of a token based on its address and the desired chain.',
      schema: z.object({
        contractAddress: z.string(),
      }),
      invoke: async (walletProvider, args: any) => {
        const { contractAddress } = args;

        const chain = Network.BASE_MAINNET;

        this.logger.log(
          `Fetching metadata for ${contractAddress} on ${chain}...`,
        );

        try {
          const tokenMetadata = await this.alchemyService.getTokenMetadata(
            contractAddress,
            chain,
          );

          if (tokenMetadata.symbol === 'UNKNOWN') return 'Token not found';

          this.logger.log(
            `Fetching market data for ${tokenMetadata.name} (${tokenMetadata.symbol})...`,
          );

          const tokenMarketData =
            await this.tokensService.getTokenMarketDataById(tokenMetadata.name);

          return tokenMarketData;
        } catch (error) {
          console.error('Error in tool getTokenMarketDataByContract :', error);
          return 'Something wrong happened while retrieving market data by contract address.';
        }
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

  private getOwnerTradingWallet = customActionProvider<ViemWalletProvider>({
    name: 'get_owner_trading_wallet',
    description:
      'Retrieves all trading wallet addresses owned by a specific address from the factory contract.',
    schema: z.object({
      owner: z.string().describe('Address to get owned wallets for'),
    }),
    invoke: async (walletProvider, args: any) => {
      const { owner } = args;

      this.logger.log(`Fetching ${owner} trading wallets...`);

      const wallet = (await walletProvider.readContract({
        address: BASE_MAINNET_FACTORY_ADDRESS,
        abi: [
          {
            type: 'function',
            name: 'getOwnerWallet',
            inputs: [
              {
                internalType: 'address',
                name: 'owner',
                type: 'address',
              },
            ],
            outputs: [
              {
                internalType: 'address',
                name: '',
                type: 'address',
              },
            ],
            stateMutability: 'view',
          },
        ],
        functionName: 'getOwnerWallet',
        args: [owner],
      })) as Address;

      if (!wallet) {
        return `No wallet found for address ${owner}`;
      }

      return `Trading Wallet owned by ${owner}:\n${wallet}`;
    },
  });
}
