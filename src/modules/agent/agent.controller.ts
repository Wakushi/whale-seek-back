import {
  Body,
  Controller,
  HttpCode,
  Post,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { AgentService } from './agent.service';
import { AskAgentDto } from './entities/ask-agent.dto';

@Controller('agent')
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  @Post()
  @HttpCode(200)
  async askAgent(@Body() body: AskAgentDto) {
    const { query, account } = body;

    if (!account) {
      throw new BadRequestException('Missing user account');
    }

    if (!query) {
      throw new BadRequestException('Missing query');
    }

    try {
      return await this.agentService.askAgent(query, account);
    } catch (error) {
      console.error('Error in askAgent:', error);

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new InternalServerErrorException(
        'An unexpected error occurred while processing your request',
      );
    }
  }
}
