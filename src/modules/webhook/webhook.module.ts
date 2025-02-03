import { DynamicModule, Module } from '@nestjs/common';
import { WebhookService } from './webhook.service';
import { WebhookController } from './webhook.controller';

@Module({})
export class WebhookModule {
  static forRoot(): DynamicModule {
    return {
      module: WebhookModule,
      providers: [WebhookService],
      controllers: [WebhookController],
      exports: [WebhookService],
      global: true,
    };
  }
}