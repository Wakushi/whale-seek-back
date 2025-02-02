import { Controller, Get, HttpCode } from '@nestjs/common';
import { DiscoveryService } from './discovery.service';

@Controller('discovery')
export class DiscoveryController {
  constructor(private readonly discoveryService: DiscoveryService) {}

  @Get()
  @HttpCode(200)
  async testEndpoint() {
    const whales = await this.discoveryService.findWhales();

    await this.discoveryService.saveWhales(whales);

    return whales;
  }
}
