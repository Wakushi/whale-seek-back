import { DynamicModule, Module } from '@nestjs/common';
import { TokensService } from './tokens.services';

@Module({})
export class TokensModule {
  static forRoot(): DynamicModule {
    return {
      module: TokensModule,
      providers: [TokensService],
      exports: [TokensService],
      global: true,
    };
  }
}