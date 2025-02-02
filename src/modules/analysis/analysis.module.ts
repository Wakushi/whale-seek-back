import { DynamicModule, Module } from '@nestjs/common';
import { AnalysisService } from './analysis.service';

@Module({
  providers: [AnalysisService],
})
export class AnalysisModule {
  static forRoot(): DynamicModule {
    return {
      module: AnalysisModule,
      providers: [AnalysisService],
      exports: [AnalysisService],
      global: true,
    };
  }
}
