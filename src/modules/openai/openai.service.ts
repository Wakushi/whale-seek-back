import { Inject, Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { AlchemyService } from '../alchemy/alchemy.service';

@Injectable()
export class OpenAIService {
  private openai: OpenAI;

  constructor(
    @Inject('OPENAI_CONFIG') private readonly config: { openai: string },
    private alchemyService: AlchemyService,
  ) {
    this.openai = new OpenAI({
      apiKey: config.openai,
    });
  }


  tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
    {
      type: 'function',
      function: {
        name: 'get_token_balances', 
        description: 'Récupère les balances des tokens ERC-20 pour une adresse de wallet donnée.', 
        parameters: {
          type: 'object',
          properties: {
            walletAddress: {
              type: 'string',
              description: 'L\'adresse du wallet pour laquelle récupérer les balances des tokens.',
            },
          },
          required: ['walletAddress'], 
        },
      },
    },
  ];

  async queryWallet(userQuery: string): Promise<string> {
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: userQuery }],
      tools: this.tools,
      tool_choice: 'auto', 
    });

    const toolCalls = response.choices[0].message.tool_calls;
    if (toolCalls && toolCalls.length > 0) {
      for (const toolCall of toolCalls) {
        if (toolCall.function.name === 'get_token_balances') {
          const args = JSON.parse(toolCall.function.arguments);
          const walletAddress = args.walletAddress;

          const balances = await this.alchemyService.getTokenBalances(walletAddress);

          return JSON.stringify(balances);
        }
      }
    }

    return response.choices[0].message.content || 'Aucune réponse trouvée.';
  }
}