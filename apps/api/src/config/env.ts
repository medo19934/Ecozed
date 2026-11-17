import { z } from 'zod';

export const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  JWT_ACCESS_SECRET: z.string().min(8),
  JWT_REFRESH_SECRET: z.string().min(8),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(30),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  /** File storage: "local" (dev, STORAGE_LOCAL_DIR) or "s3" (MinIO / AWS S3). */
  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  STORAGE_LOCAL_DIR: z.string().default('./storage'),
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default('us-east-1'),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  S3_BUCKET: z.string().default('latif-kids'),
  /** Comma-separated Google OAuth client IDs accepted as ID-token audience (web, iOS, Android). */
  GOOGLE_CLIENT_IDS: z.string().default(''),
  /** Comma-separated emails that become super admins on Google sign-in. */
  SUPER_ADMIN_EMAILS: z.string().default(''),
  /**
   * Public demo: sign in with just an email or phone (no password, no code), demo role
   * cards on the login page, and demo data in every branch. Anyone can enter any account —
   * never enable with real families' data.
   */
  PUBLIC_DEMO: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  /** Local dev only: enables POST /auth/dev-login (email, no Google). Never in production. */
  AUTH_DEV_LOGIN: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
});

export const csv = (v: string): string[] =>
  v
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
export type Env = z.infer<typeof EnvSchema>;

export const validateEnv = (raw: Record<string, unknown>): Env => {
  const parsed = EnvSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`Invalid environment: ${parsed.error.message}`);
  }
  if (parsed.data.NODE_ENV === 'production' && parsed.data.AUTH_DEV_LOGIN) {
    throw new Error('AUTH_DEV_LOGIN must be false in production');
  }
  return parsed.data;
};
