import OpenAI from 'openai';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { AgentToolService } from './agent-tools.service';
import { zodResponseFormat } from 'openai/helpers/zod';
import { z } from 'zod';

enum Agent {
  GENERAL = 'GENERAL',
  TOKEN_ANALYST = 'TOKEN_ANALYST',
  ROUTER = 'ROUTER',
}

const routerResponseFormat = z.object({
  agent: z.enum([Agent.TOKEN_ANALYST, Agent.GENERAL]),
  query: z.string(),
});

const analystResponseFormat = z.object({
  analysis: z.string(),
  confidence: z.number(),
  metrics: z.array(
    z.object({
      name: z.string(),
      value: z.number(),
    }),
  ),
});

const generalResponseFormat = z.object({
  answer: z.string(),
  suggestions: z.array(z.string()),
});

@Injectable()
export class OpenAIService {
  private openai: OpenAI;

  private readonly logger = new Logger(OpenAIService.name);

  constructor(
    @Inject('OPENAI_CONFIG') private readonly config: { openAiApiKey: string },
    private readonly toolService: AgentToolService,
  ) {
    this.openai = new OpenAI({
      apiKey: config.openAiApiKey,
    });
  }

  public async askAgent(userQuery: string): Promise<string> {
    const start = Date.now();
    this.logger.log('Agent starting task..');

    try {
      const routerAgent = this.buildGeneralAgent(userQuery, Agent.ROUTER);
      this.logger.debug('Router agent config:', routerAgent);

      const routerAgentRunner =
        await this.openai.beta.chat.completions.parse(routerAgent);
      this.logger.debug('Router response:', routerAgentRunner);

      const assignment = routerAgentRunner.choices[0].message.parsed as z.infer<
        typeof routerResponseFormat
      >;
      this.logger.debug('Assigned agent:', assignment);

      const agent = this.buildGeneralAgent(userQuery, assignment.agent);
      this.logger.debug('Final agent config:', agent);

      const runner = await this.openai.beta.chat.completions.parse(agent);
      this.logger.debug('Final agent response:', runner);

      if (runner.choices[0].message.tool_calls?.length > 0) {
        this.logger.debug('Processing tool calls...');

        const toolResults = await Promise.all(
          runner.choices[0].message.tool_calls.map(async (toolCall) => {
            const { name, parsed_arguments } = toolCall.function;

            this.logger.debug(
              `Executing tool ${name} with args:`,
              parsed_arguments,
            );

            const tool = this.toolService.tools.find(
              (t) => t.function.name === name,
            );
            if (!tool) {
              throw new Error(`Tool ${name} not found`);
            }

            const result = await tool.function.function(parsed_arguments);

            return {
              tool_call_id: toolCall.id,
              role: 'tool',
              name: name,
              content: JSON.stringify(result),
            };
          }),
        );

        this.logger.debug('Calling agent with tool results');
        const messages = [
          ...agent.messages,
          runner.choices[0].message,
          ...toolResults,
        ];

        const finalResponse = await this.openai.beta.chat.completions.parse({
          model: 'gpt-4o-2024-08-06',
          messages,
          response_format: { type: 'json_object' },
          ...(assignment.agent === Agent.TOKEN_ANALYST
            ? {
                response_format: zodResponseFormat(
                  analystResponseFormat,
                  'event',
                ),
              }
            : {
                response_format: zodResponseFormat(
                  generalResponseFormat,
                  'event',
                ),
              }),
        });

        const finalContent = finalResponse.choices[0].message.parsed;
        this.logger.debug('Final content after tool calls:', finalContent);

        if (!finalContent) {
          throw new Error('No content received from OpenAI after tool calls');
        }

        if (assignment.agent === Agent.TOKEN_ANALYST) {
          const content = finalContent as z.infer<typeof analystResponseFormat>;
          if (!content.analysis) {
            throw new Error('No analysis received from token analyst');
          }
          return content.analysis;
        } else {
          const content = finalContent as z.infer<typeof generalResponseFormat>;
          if (!content.answer) {
            throw new Error('No answer received from general agent');
          }
          return content.answer;
        }
      }

      const finalContent = runner.choices[0].message.parsed;
      this.logger.debug('Final content:', finalContent);

      if (!finalContent) {
        throw new Error('No content received from OpenAI');
      }

      const duration = Date.now() - start;
      this.logger.log(`Agent completed task! (${duration}ms)`);

      if (assignment.agent === Agent.TOKEN_ANALYST) {
        const content = finalContent as z.infer<typeof analystResponseFormat>;
        if (!content.analysis) {
          throw new Error('No analysis received from token analyst');
        }
        return content.analysis;
      } else {
        const content = finalContent as z.infer<typeof generalResponseFormat>;
        if (!content.answer) {
          throw new Error('No answer received from general agent');
        }
        return content.answer;
      }
    } catch (error) {
      this.logger.error('Error in askAgent:', error);
      throw error;
    }
  }

  private buildGeneralAgent(query: string, agentType: Agent): any {
    switch (agentType) {
      case Agent.ROUTER:
        return {
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: `You are a router agent. Your task is to analyze the user query and decide which agent should handle it:
            - Use ANALYST for queries about token analyse with getTokenMarketDataById
            - Use GENERAL for general questions and tasks, 
            Return your choice in JSON format with "agent" and "query" fields.`,
            },
            { role: 'user', content: query },
          ],
          response_format: zodResponseFormat(routerResponseFormat, 'event'),
        };
      case Agent.GENERAL:
        return {
          model: 'gpt-4o',
          messages: [
            { role: 'system', content:`You are a general purpose agent with web search capabilities.
            Use the search function to find relevant information when needed.
            Provide clear answers and relevant suggestions.` },
            { role: 'user', content: query },
          ],
          tools: [
            this.toolService.tools.find(
              (t) => t.function.name === 'getTokenBalances',
            ),
            this.toolService.tools.find((t) => t.function.name === 'search'),
          ],
        };
      case Agent.TOKEN_ANALYST:
        return {
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: `You are an analyst agent specialized in token analysis. 
            Provide detailed analysis with confidence scores and relevant metrics.`,
            },
            { role: 'user', content: query },
          ],
          tools: [
            this.toolService.tools.find(
              (t) => t.function.name === 'getTokenMarketDataById',
            ),
          ],
          response_format: zodResponseFormat(analystResponseFormat, 'event'),
        };
      default:
        return {
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: '' },
            { role: 'user', content: query },
          ],
          tools: this.toolService.tools,
          response_format: zodResponseFormat(generalResponseFormat, 'event'),
        };
    }
  }
  private logAgentProcess(message: any): void {
    const isUsingTool = !!message.tool_calls?.length;

    if (!isUsingTool) return;

    message.tool_calls.forEach((tool: any) => {
      let info = '';

      switch (tool.function.name) {
        case 'getTokenBalances':
          info = 'Retrieving wallet token balance';
          break;

        case 'getTokenMarketDataById':
          info = 'Searching for token market data';
          break;

        default:
          info = 'Computing...';
      }

      this.logger.log(info);
    });
  }
}
