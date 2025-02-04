import { DynamicModule, Module } from '@nestjs/common';
import { WebhookService } from './webhook.service';
import { WebhookController } from './webhook.controller';

@Module({})
export class WebhookModule {
  static forRoot(config: { alchemyAuthKey: string, webhookId: string }): DynamicModule {
    return {
      module: WebhookModule,
      providers: [
        WebhookService,
        {
          provide: 'WEBHOOK_CONFIG',
          useValue: config,
        }
      ],
      controllers: [WebhookController],
      exports: [WebhookService],
      global: true,
    };
  }
}