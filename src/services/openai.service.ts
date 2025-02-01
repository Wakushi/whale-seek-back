import { Inject, Injectable } from '@nestjs/common';
import OpenAI from 'openai';

@Injectable()
export class OpenAIService {
  private openai: OpenAI;

  constructor(
    @Inject('OPENAI_CONFIG') private readonly config: { openai: string },
  ) {
    this.openai = new OpenAI({
      apiKey: config.openai
    });
  }

  async queryWeather(userQuery: string): Promise<string> {
    const runner = await this.openai.beta.chat.completions.runTools({
      model: 'gpt-4',
      messages: [{ role: 'user', content: userQuery }],
      tools: [
      ],
    });

    const finalContent = await runner.finalContent();
    return finalContent;
  }
}
