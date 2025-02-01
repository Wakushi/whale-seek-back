import { DynamicModule, Module } from '@nestjs/common';
import { GraphService } from './graph.service';

@Module({})
export class GraphModule {
  static forRoot(config: { graphApiKey: string }): DynamicModule {
    return {
      module: GraphModule,
      providers: [
        {
          provide: 'GRAPH_CONFIG',
          useValue: config,
        },
        GraphService,
      ],
      exports: [GraphService],
      global: true,
    };
  }
}
