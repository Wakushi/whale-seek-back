import { Module } from '@nestjs/common';
import { AnalysisService } from './analysis.service';

@Module({
  providers: [AnalysisService],
})
export class AnalysisModule {}
