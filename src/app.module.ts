import { Module } from '@nestjs/common';
import { DiscoveryModule } from './modules/discovery/discovery.module';
import { GraphModule } from './modules/graph/graph.module';
import { ConfigModule } from '@nestjs/config';
import { envSchema } from 'config/env.validation';

@Module({
  imports: [
    DiscoveryModule,
    ConfigModule.forRoot({
      validate: (config) => envSchema.parse(config),
      isGlobal: true,
    }),
    GraphModule.forRoot({ graphApiKey: process.env.GRAPH_API_KEY }),
  ],
})
export class AppModule {}
