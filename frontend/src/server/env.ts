import { z } from 'zod';

// Mirrors backend/src/app/core/config.py's Settings — same env vars, same defaults, so
// both backends can point at the same Postgres/Redis/JWT secret during the migration.
// Grows one field at a time as each phase needs it, rather than front-loading every
// FastAPI setting now.
const schema = z.object({
  APP_ENV: z.string().default('development'),
  // Applies pending migrations at startup (the job runner's job, not this Next.js
  // process) so a freshly pulled branch just runs. Set AUTO_MIGRATE=false if your
  // deployment applies migrations as its own step.
  AUTO_MIGRATE: z
    .string()
    .default('true')
    .transform((v) => v !== 'false'),
  // Dev-only convenience: runs the Python demo-seed scripts on job-runner startup so a
  // fresh clone has books and activity without anyone seeding by hand. Only takes effect
  // when APP_ENV=development. Set AUTO_SEED_DEMO=false to opt out.
  AUTO_SEED_DEMO: z
    .string()
    .default('true')
    .transform((v) => v !== 'false'),
  DATABASE_URL: z.string().default('postgresql://app:app@localhost:5432/app'),
  REDIS_URL: z.string().default('redis://localhost:6379/0'),
  CHAT_HISTORY_TTL_SECONDS: z.coerce.number().default(3600),
  CHAT_HISTORY_MAX_TURNS: z.coerce.number().default(5),

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

  // LLM backend: "openai" | "bedrock" | "ollama". Defaults to ollama to match the
  // Python side's own default — a missing LLM_MODE falls back to the free local model
  // rather than silently reaching for a paid API.
  LLM_MODE: z.string().default('ollama'),
  LLM_DEBUG: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
  OPENAI_API_KEY: z.string().default(''),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),
  OPENAI_EMBEDDING_MODEL: z.string().default('text-embedding-3-small'),
  AWS_REGION: z.string().default('us-east-1'),
  AWS_ACCESS_KEY_ID: z.string().default(''),
  AWS_SECRET_ACCESS_KEY: z.string().default(''),
  BEDROCK_MODEL_ID: z.string().default('amazon.nova-lite-v1:0'),
  BEDROCK_EMBEDDING_MODEL_ID: z.string().default('amazon.titan-embed-text-v2:0'),
  OLLAMA_BASE_URL: z.string().default('http://localhost:11434'),
  OLLAMA_MODEL: z.string().default('llama3.2:3b'),
  OLLAMA_EMBEDDING_MODEL: z.string().default('nomic-embed-text'),
});

export const env = schema.parse({
  APP_ENV: process.env.APP_ENV,
  AUTO_MIGRATE: process.env.AUTO_MIGRATE,
  AUTO_SEED_DEMO: process.env.AUTO_SEED_DEMO,
  DATABASE_URL: process.env.DATABASE_URL,
  REDIS_URL: process.env.REDIS_URL,
  CHAT_HISTORY_TTL_SECONDS: process.env.CHAT_HISTORY_TTL_SECONDS,
  CHAT_HISTORY_MAX_TURNS: process.env.CHAT_HISTORY_MAX_TURNS,
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
  LLM_MODE: process.env.LLM_MODE,
  LLM_DEBUG: process.env.LLM_DEBUG,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENAI_MODEL: process.env.OPENAI_MODEL,
  OPENAI_EMBEDDING_MODEL: process.env.OPENAI_EMBEDDING_MODEL,
  AWS_REGION: process.env.AWS_REGION,
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
  BEDROCK_MODEL_ID: process.env.BEDROCK_MODEL_ID,
  BEDROCK_EMBEDDING_MODEL_ID: process.env.BEDROCK_EMBEDDING_MODEL_ID,
  OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL,
  OLLAMA_MODEL: process.env.OLLAMA_MODEL,
  OLLAMA_EMBEDDING_MODEL: process.env.OLLAMA_EMBEDDING_MODEL,
});
