import { Controller, Post, Body } from '@nestjs/common';
import { OpenAIService } from '../services/openai.service';

@Controller('openai')
export class OpenAIController {
  constructor(private readonly openaiService: OpenAIService) {}

  @Post('weather')
  async getWeatherInfo(@Body() body: { query: string }) {
    return await this.openaiService.queryWeather(body.query);
  }
}