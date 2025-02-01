import { Controller, Get, HttpCode } from '@nestjs/common';
import { GraphService } from '../graph/graph.service';

@Controller('discovery')
export class DiscoveryController {
  constructor(private readonly graphService: GraphService) {}

  @Get()
  @HttpCode(200)
  async queryGraph() {
    try {
      const result = await this.graphService.queryUniswapData();
      return result;
    } catch (error) {
      console.error(error);
    }
  }
}
