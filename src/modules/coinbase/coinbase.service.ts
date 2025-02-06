import { Inject, Injectable } from '@nestjs/common';
import {
  AgentKit,
  wethActionProvider,
  ViemWalletProvider,
  erc20ActionProvider,
  cdpApiActionProvider,
  cdpWalletActionProvider,
  walletActionProvider,
  pythActionProvider,
} from '@coinbase/agentkit';
import { getLangChainTools } from '@coinbase/agentkit-langchain';
import { HumanMessage } from '@langchain/core/messages';
import { MemorySaver } from '@langchain/langgraph';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { ChatOpenAI } from '@langchain/openai';
import { Address, createWalletClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { AgentToolService } from './agent-tool.service';

@Injectable()
export class CoinbaseService {
  private agent: any;
  private agentConfig: any;

  constructor(
    @Inject('COINBASE_CONFIG')
    private readonly config: {
      cdpKeyName: string;
      cdpPrivateKey: string;
      networkId: string;
      privateKey: string;
    },
    private readonly agentToolService: AgentToolService,
  ) {
    this.initializeAgent();
  }

  public async askAgent(query: string, user: Address): Promise<string> {
    try {
      if (!this.agent || !this.agentConfig) {
        throw new Error('Agent not initialized');
      }

      const stream = await this.agent.stream(
        { messages: [new HumanMessage(`[USER ADDRESS: ${user}] ${query}`)] },
        this.agentConfig,
      );

      const messages: string[] = [];

      for await (const chunk of stream) {
        if ('agent' in chunk) {
          const message = chunk.agent.messages[0].content;

          if (message) {
            messages.push(message);
          }
        }
      }

      return messages.join(' ');
    } catch (error) {
      console.error('Error while querying Agent. ', error);
      return 'An error occured, please try again later.';
    }
  }

  private async initializeAgent(): Promise<void> {
    try {
      const llm = new ChatOpenAI({
        model: 'gpt-4o',
      });

      const account = privateKeyToAccount(this.config.privateKey as Address);

      const client = createWalletClient({
        account,
        chain: baseSepolia,
        transport: http(),
      });

      const walletProvider = new ViemWalletProvider(client);

      const agentkit = await AgentKit.from({
        walletProvider,
        actionProviders: [
          wethActionProvider(),
          pythActionProvider(),
          walletActionProvider(),
          erc20ActionProvider(),
          cdpApiActionProvider({
            apiKeyName: this.config.cdpKeyName,
            apiKeyPrivateKey: this.config.cdpPrivateKey?.replace(/\\n/g, '\n'),
          }),
          cdpWalletActionProvider({
            apiKeyName: this.config.cdpKeyName,
            apiKeyPrivateKey: this.config.cdpPrivateKey?.replace(/\\n/g, '\n'),
          }),
          ...this.agentToolService.tools,
        ],
      });

      const tools = await getLangChainTools(agentkit);

      const memory = new MemorySaver();
      const agentConfig = {
        configurable: { thread_id: 'trading_agent' },
      };

      const agent = createReactAgent({
        llm,
        tools,
        checkpointSaver: memory,
        messageModifier: `
        You are a highly reliable AI agent designed to assist users with on-chain interactions and trading decisions using the Coinbase Developer Platform AgentKit. Your primary goal is to facilitate seamless and secure transactions, provide accurate market data, and assist with wallet management.

        Key Responsibilities:
        Wallet Management: Deploy and manage trading wallets for users.
        Transaction Assistance: Convert amounts to their ERC-20 decimals and assist with transactions.
        Market Data: Retrieve and provide token balances and market data.
        Web Search: Perform internet searches to gather relevant information.

        User Context:
        User Address: The address provided as [USER ADDRESS: <user_address>] at the start of each user message is their primary address. Use this address for wallet-related actions unless otherwise specified.
        Trading Wallets: Smart contracts wallets deployed that you control that are dedicated trading wallets for executing swaps and trades. When the user requests wallet-related information, prioritize fetching data from their trading wallets first, unless explicitly asked for their primary address.

        Operational Guidelines:
        Network Awareness: Before executing any action, check the network ID. If on 'base-sepolia', request funds from the faucet. Otherwise, request funds from the user.
        Error Handling: If you encounter a 5XX HTTP error, ask the user to try again later.
        Tool Limitations: If a user requests an action beyond your current capabilities, apologize and inform them that the task cannot be performed.
        Conciseness: Be concise and helpful in responses. Avoid restating tool descriptions unless explicitly requested.
        AI Wallet: Your wallet address (0x35E34708C7361F99041a9b046C72Ea3Fcb29134c) is strictly for internal use. Never use it for user-related transactions or tool calls.
        `,
      });

      this.agent = agent;
      this.agentConfig = agentConfig;
    } catch (error) {
      console.error('Failed to initialize agent:', error);
      throw error;
    }
  }
}
