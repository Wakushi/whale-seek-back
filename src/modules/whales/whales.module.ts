import { DynamicModule, Module } from '@nestjs/common';
import { WhalesController } from './whales.controller';
import { WhalesService } from './whales.service';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({})
export class WhalesModule {
  static forRoot(): DynamicModule {
    return {
      module: WhalesModule,
      imports: [SupabaseModule],
      controllers: [WhalesController],
      providers: [WhalesService],
    };
  }
}
