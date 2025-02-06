import { Inject, Injectable, Logger } from '@nestjs/common';
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
import { Agent, TransactionAnalystResult } from './entities/agent.type';
import {
  GENERAL_AGENT_PROMPT,
  TRADING_AGENT_PROMPT,
  TRANSACTION_ANALYST_PROMPT,
} from './entities/prompt';
import { TransactionRecord } from '../transactions/entities/transaction.entity';

@Injectable()
export class CoinbaseService {
  private generalAgent: any;
  private generalAgentConfig: any;

  private transactionAnalystAgent: any;
  private transactionAnalystAgentConfig: any;

  private tradingAgent: any;
  private tradingAgentConfig: any;

  private readonly logger = new Logger(CoinbaseService.name);

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
    this.initializeAgent(Agent.GENERAL);
    this.initializeAgent(Agent.TRANSACTION_ANALYST);
    this.initializeAgent(Agent.TRADING);
  }

  public async askAgent(query: string, user: Address): Promise<string> {
    try {
      if (!this.generalAgent || !this.generalAgentConfig) {
        throw new Error('Agent not initialized');
      }

      const stream = await this.generalAgent.stream(
        { messages: [new HumanMessage(`[USER ADDRESS: ${user}] ${query}`)] },
        this.generalAgentConfig,
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

      this.logger.log('General Agent completed task !');

      return messages.join(' ');
    } catch (error) {
      console.error('Error while querying Agent. ', error);
      return 'An error occured, please try again later.';
    }
  }

  public async askTransactionAnalysisAgent(
    transactionRecord: Omit<TransactionRecord, 'id'>,
  ): Promise<TransactionAnalystResult | null> {
    try {
      if (
        !this.transactionAnalystAgent ||
        !this.transactionAnalystAgentConfig
      ) {
        throw new Error('Agent not initialized');
      }

      const stream = await this.transactionAnalystAgent.stream(
        {
          messages: [
            new HumanMessage(
              `Transaction to analyse: ${JSON.stringify(transactionRecord)}. This trade represents ${transactionRecord.trade_wallet_percentage} of the trader wallet.`,
            ),
          ],
        },
        this.transactionAnalystAgentConfig,
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

      this.logger.log('Transaction Analyst Agent completed task !');

      return JSON.parse(messages[0]);
    } catch (error) {
      console.error('Error while querying Agent. ', error);
      return null;
    }
  }

  public async askTradingAgent(
    wallet: Address,
    transactionRecord: Omit<TransactionRecord, 'id'>,
  ): Promise<string> {
    try {
      if (!this.tradingAgent || !this.tradingAgentConfig) {
        throw new Error('Agent not initialized');
      }

      const stream = await this.tradingAgent.stream(
        {
          messages: [
            new HumanMessage(
              `Trading wallet is ${wallet}, the whale transaction is ${JSON.stringify(transactionRecord)}`,
            ),
          ],
        },
        this.tradingAgentConfig,
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

      this.logger.log('Trading Agent completed task !');

      return messages.join(' ');
    } catch (error) {
      console.error('Error while querying Agent. ', error);
      return null;
    }
  }

  private async initializeAgent(agentType: Agent): Promise<void> {
    try {
      let model = new ChatOpenAI({
        model: 'gpt-4o',
      });

      const account = privateKeyToAccount(this.config.privateKey as Address);

      const client = createWalletClient({
        account,
        chain: baseSepolia,
        transport: http(),
      });

      const walletProvider = new ViemWalletProvider(client);

      const agentTools = this.agentToolService.getAgentTools(agentType);

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
          ...agentTools,
        ],
      });

      const tools = await getLangChainTools(agentkit);

      const memory = new MemorySaver();
      const agentConfig = {
        configurable: { thread_id: agentType },
      };

      const agent = createReactAgent({
        llm: model,
        tools,
        checkpointSaver: memory,
        messageModifier: this.getPrompt(agentType),
        responseFormat: this.agentToolService.getAgentFormatting(agentType),
      });

      switch (agentType) {
        case Agent.GENERAL:
          this.generalAgent = agent;
          this.generalAgentConfig = agentConfig;
          break;
        case Agent.TRANSACTION_ANALYST:
          this.transactionAnalystAgent = agent;
          this.transactionAnalystAgentConfig = agentConfig;
          break;
        case Agent.TRADING:
          this.tradingAgent = agent;
          this.tradingAgentConfig = agentConfig;
          break;
        default:
          this.generalAgent = agent;
          this.generalAgentConfig = agentConfig;
          break;
      }
    } catch (error) {
      console.error('Failed to initialize agent:', error);
      throw error;
    }
  }

  private getPrompt(agentType: Agent): string {
    switch (agentType) {
      case Agent.GENERAL:
        return GENERAL_AGENT_PROMPT;
      case Agent.TRANSACTION_ANALYST:
        return TRANSACTION_ANALYST_PROMPT;
      case Agent.TRADING:
        return TRADING_AGENT_PROMPT;
      default:
        return GENERAL_AGENT_PROMPT;
    }
  }
}
