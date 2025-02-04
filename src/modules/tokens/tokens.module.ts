import { DynamicModule, Module } from '@nestjs/common';
import { TokensService } from './tokens.services';
import { SharedModule } from 'src/shared/shared.module';

@Module({})
export class TokensModule {
  static forRoot(): DynamicModule {
    return {
      module: TokensModule,
      imports: [SharedModule],
      providers: [TokensService],
      exports: [TokensService],
      global: true,
    };
  }
}