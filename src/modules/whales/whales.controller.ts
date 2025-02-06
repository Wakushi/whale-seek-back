import { Controller, Get } from '@nestjs/common';
import { WhalesService } from './whales.service';
import { Whale } from './entities/whale.entity';

@Controller('whales')
export class WhalesController {
  constructor(private readonly whalesService: WhalesService) {}

  @Get()
  async findAll(): Promise<Whale[]> {
    return this.whalesService.findAll();
  }
}