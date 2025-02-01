import { z } from 'zod';

export const envSchema = z.object({
	OPENAI_API_KEY: z.string(),
	ALCHEMY_API_KEY: z.string(),
});

export type EnvConfig = z.infer<typeof envSchema>;