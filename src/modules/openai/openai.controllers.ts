import { Controller, Post, Body, HttpCode } from '@nestjs/common';
import { OpenAIService } from './openai.service';

@Controller('agent')
export class OpenAIController {
  constructor(private readonly openaiService: OpenAIService) {}

  @Post()
  @HttpCode(200)
  async askAgent(@Body() body: { query: string }) {
    return await this.openaiService.askAgent(body.query);
  }
}
