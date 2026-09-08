import { z } from 'zod';

// Mirrors backend/src/app/core/config.py's Settings — same env vars, same defaults, so
// both backends can point at the same Postgres/Redis/JWT secret during the migration.
// Grows one field at a time as each phase needs it, rather than front-loading every
// FastAPI setting now.
const schema = z.object({
  APP_ENV: z.string().default('development'),
  DATABASE_URL: z.string().default('postgresql://app:app@localhost:5432/app'),
  REDIS_URL: z.string().default('redis://localhost:6379/0'),

  // Auth — must match the FastAPI backend's JWT_SECRET so tokens/cookies are valid
  // against either backend during the module-by-module cutover.
  JWT_SECRET: z.string().default('dev-secret-change-me-32-bytes-minimum'),
  GOOGLE_CLIENT_ID: z.string().default(''),
  // Correct current default (the Python backend's own default is stale — see
  // config.py's frontend_url comment about the retired Vite port).
  FRONTEND_URL: z.string().default('http://localhost:3000'),

  // Left blank in dev — mail.ts logs to console instead of sending when unset.
  SMTP_HOST: z.string().default(''),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().default(''),
  SMTP_PASSWORD: z.string().default(''),
  SMTP_FROM: z.string().default(''),
  SMTP_USE_TLS: z
    .string()
    .default('true')
    .transform((v) => v !== 'false'),

  // Left blank in dev — Razorpay order creation 503s until test-mode keys are set.
  RAZORPAY_KEY_ID: z.string().default(''),
  RAZORPAY_KEY_SECRET: z.string().default(''),
});

export const env = schema.parse({
  APP_ENV: process.env.APP_ENV,
  DATABASE_URL: process.env.DATABASE_URL,
  REDIS_URL: process.env.REDIS_URL,
  JWT_SECRET: process.env.JWT_SECRET,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  FRONTEND_URL: process.env.FRONTEND_URL,
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: process.env.SMTP_PORT,
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASSWORD: process.env.SMTP_PASSWORD,
  SMTP_FROM: process.env.SMTP_FROM,
  SMTP_USE_TLS: process.env.SMTP_USE_TLS,
  RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID,
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET,
});
