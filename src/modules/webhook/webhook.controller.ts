import { Controller, Headers, Patch, Body, Post, Req } from '@nestjs/common';
import { WebhookService } from './webhook.service';

@Controller('webhook')
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @Patch('update-addresses')
  async updateAddresses(
    @Headers('X-Alchemy-Token') token: string,
    @Body() updateDto
  ) {
    return this.webhookService.updateAddresses(token, updateDto);
  }

  @Post('transaction')  
  async handleTransaction(@Req() request, @Body() data: any) { 
    return this.webhookService.processTransaction(data);
  }
}