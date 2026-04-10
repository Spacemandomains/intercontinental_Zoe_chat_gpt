import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const configSchema = z.object({
  YOUTUBE_API_KEY: z.string().min(1, 'YOUTUBE_API_KEY is required'),
  RESEND_API_KEY: z.string().optional(),
  LEAD_EMAIL_TO: z.string().email().optional(),
  LEAD_EMAIL_FROM: z.string().email().optional(),

  MCP_TRANSPORT: z.enum(['stdio', 'http']).default('stdio'),
  PORT: z.coerce.number().int().positive().default(3000),
  HTTP_AUTH_TOKEN: z.string().optional(),

  DATA_DIR: z.string().default('./data'),

  CACHE_TTL_PLAYLIST_MS: z.coerce.number().int().positive().default(60 * 60 * 1000),
  CACHE_TTL_VIDEO_MS: z.coerce.number().int().positive().default(24 * 60 * 60 * 1000),
  CACHE_TTL_TRANSCRIPT_MS: z.coerce.number().int().positive().default(24 * 60 * 60 * 1000),

  DEFAULT_TRANSCRIPT_LANG: z.string().default('en'),

  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('production'),
});

export type Config = z.infer<typeof configSchema>;

let cached: Config | undefined;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const result = configSchema.safeParse(env);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  cached = result.data;
  return cached;
}

export function getConfig(): Config {
  if (!cached) {
    cached = loadConfig();
  }
  return cached;
}

export function resetConfigForTests(): void {
  cached = undefined;
}
