import { DynamicModule, Module } from '@nestjs/common';
import { SupabaseService } from './supabase.service';

@Module({})
export class SupabaseModule {
  static forRoot(config: { privateKey: string; url: string }): DynamicModule {
    return {
      module: SupabaseModule,
      providers: [
        {
          provide: 'SUPABASE_CONFIG',
          useValue: config,
        },
        SupabaseService,
      ],
      exports: [SupabaseService],
      global: true,
    };
  }
}
