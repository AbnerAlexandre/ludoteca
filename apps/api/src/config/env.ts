import { z } from 'zod';

/**
 * Startup gate. Every configuration value the app reads is declared here and
 * nowhere else — `process.env` is not touched past this module. A missing or
 * malformed value crashes the process at boot rather than surfacing as a
 * confusing 500 under load.
 */
const booleanish = z
  .enum(['true', 'false', '1', '0'])
  .default('false')
  .transform((v) => v === 'true' || v === '1');

const secret = (name: string) =>
  z
    .string()
    .min(32, `${name} must be at least 32 characters`)
    .refine((v) => !/^change-me/i.test(v), `${name} still holds the placeholder value`);

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
    HOST: z.string().default('0.0.0.0'),

    DATABASE_URL: z.string().startsWith('postgres'),
    WEB_ORIGIN: z.url(),

    JWT_ACCESS_SECRET: secret('JWT_ACCESS_SECRET'),
    JWT_REFRESH_SECRET: secret('JWT_REFRESH_SECRET'),
    COOKIE_SECRET: secret('COOKIE_SECRET'),
    ACCESS_TOKEN_TTL: z.string().regex(/^\d+[smhd]$/).default('15m'),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),

    LUDOPEDIA_APP_ID: z.string().min(1),
    LUDOPEDIA_APP_KEY: z.string().min(1),
    LUDOPEDIA_ACCESS_TOKEN: z.string().min(1),
    LUDOPEDIA_BASE_URL: z.url().default('https://ludopedia.com.br/api/v1'),
    LUDOPEDIA_TIMEOUT_MS: z.coerce.number().int().min(500).max(30_000).default(8000),
    LUDOPEDIA_CACHE_TTL_HOURS: z.coerce.number().int().min(1).max(24 * 365).default(168),

    FEATURE_GOOGLE_OAUTH: booleanish,
    GOOGLE_CLIENT_ID: z.string().default(''),
    GOOGLE_CLIENT_SECRET: z.string().default(''),
    GOOGLE_CALLBACK_URL: z.string().default(''),
  })
  .superRefine((env, ctx) => {
    // The flag is the switch, but flipping it without keys would fail at the
    // first redirect instead of at boot. Tie them together here.
    if (env.FEATURE_GOOGLE_OAUTH && (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET)) {
      ctx.addIssue({
        code: 'custom',
        path: ['FEATURE_GOOGLE_OAUTH'],
        message: 'FEATURE_GOOGLE_OAUTH=true requires GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET',
      });
    }
    if (env.NODE_ENV === 'production' && env.WEB_ORIGIN.startsWith('http://')) {
      ctx.addIssue({
        code: 'custom',
        path: ['WEB_ORIGIN'],
        message: 'WEB_ORIGIN must be https in production — cookies are set Secure',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    // Values are never echoed back: an env dump in a crash log is a leak.
    throw new Error(`Invalid environment configuration:\n${details}`);
  }
  cached = parsed.data;
  return cached;
}

export const env: Env = loadEnv();

export const isProd = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';

/** Env keys whose values must never appear in a log line. */
export const SECRET_ENV_KEYS = [
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'COOKIE_SECRET',
  'LUDOPEDIA_APP_KEY',
  'LUDOPEDIA_ACCESS_TOKEN',
  'GOOGLE_CLIENT_SECRET',
  'DATABASE_URL',
] as const satisfies readonly (keyof Env)[];
