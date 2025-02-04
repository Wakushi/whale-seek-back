import { Controller, Headers, Patch, Body, Post, Req } from '@nestjs/common';
import { WebhookService } from './webhook.service';

@Controller('webhook')
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @Patch('add-addresses')
  async addAddresses(
    @Headers('X-Alchemy-Token')
    @Body() updateDto: { webhook_id: string; addresses_to_add: string[] }
  ) {
    return this.webhookService.addAddresses(updateDto);
  }

  @Patch('remove-addresses')
  async removeAddresses(
    @Headers('X-Alchemy-Token')
    @Body() updateDto: { webhook_id: string; addresses_to_remove: string[] }
  ) {
    return this.webhookService.removeAddresses(updateDto);
  }

  @Post('transaction')
  async handleTransaction(@Req() request, @Body() data: any) {
    return this.webhookService.processTransaction(data);
  }
}