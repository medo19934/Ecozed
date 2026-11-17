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
  OTP_SECRET: z.string().min(8).default('dev-otp-secret'),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  /** When true, OTP codes are echoed in API responses (dev/test only, never prod). */
  OTP_DEV_ECHO: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
});
export type Env = z.infer<typeof EnvSchema>;

export const validateEnv = (raw: Record<string, unknown>): Env => {
  const parsed = EnvSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`Invalid environment: ${parsed.error.message}`);
  }
  if (parsed.data.NODE_ENV === 'production' && parsed.data.OTP_DEV_ECHO) {
    throw new Error('OTP_DEV_ECHO must be false in production');
  }
  return parsed.data;
};
