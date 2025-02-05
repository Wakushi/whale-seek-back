import { z } from 'zod';

export enum Agent {
  GENERAL = 'GENERAL',
  TOKEN_ANALYST = 'TOKEN_ANALYST',
  ROUTER = 'ROUTER',
}

export const RouterResponseFormat = z.object({
  type: z.literal(Agent.ROUTER),
  agent: z.enum([Agent.TOKEN_ANALYST, Agent.GENERAL]),
  query: z.string(),
});

export const AnalystResponseFormat = z.object({
  type: z.literal(Agent.TOKEN_ANALYST),
  answer: z.string(),
  confidence: z.number(),
  metrics: z.array(
    z.object({
      name: z.string(),
      value: z.number(),
    }),
  ),
});

export const GeneralResponseFormat = z.object({
  type: z.literal(Agent.GENERAL),
  answer: z.string(),
  suggestions: z.array(z.string()),
});

export const AgentResponseRegistry = {
  [Agent.ROUTER]: RouterResponseFormat,
  [Agent.TOKEN_ANALYST]: AnalystResponseFormat,
  [Agent.GENERAL]: GeneralResponseFormat,
} as const;

export type AgentResponse = z.infer<
  (typeof AgentResponseRegistry)[keyof typeof AgentResponseRegistry]
>;
