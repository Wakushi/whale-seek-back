import { z } from 'zod';

export const envSchema = z.object({
  PORT: z.string().default('3001'),
  GRAPH_API_KEY: z.string(),
  OPENAI_API_KEY: z.string(),
  ALCHEMY_API_KEY: z.string(),
  SUPABASE_URL: z.string(),
  SUPABASE_API_KEY: z.string(),
  BASESCAN_API_KEY: z.string(),
  BRAVE_API_KEY: z.string(),
  WEBHOOK_ID: z.string(),
  ALCHEMY_AUTH_KEY: z.string(),
  CDP_API_KEY_NAME: z.string(),
  CDP_API_KEY_PRIVATE_KEY: z.string(),
  NETWORK_ID: z.string(),
  PRIVATE_KEY: z.string(),
});

export type EnvConfig = z.infer<typeof envSchema>;
