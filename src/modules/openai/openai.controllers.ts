import { Controller, Post, Body } from '@nestjs/common';
import { OpenAIService } from './openai.service';

@Controller('openai')
export class OpenAIController {
  constructor(private readonly openaiService: OpenAIService) {}

  @Post('wallet')
  async getWeatherInfo(@Body() body: { query: string }) {
    return await this.openaiService.queryWallet(body.query);
  }
}
