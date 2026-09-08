import Redis from 'ioredis';
import { RateLimiterMemory, RateLimiterRedis } from 'rate-limiter-flexible';

import { env } from '@/server/env';
import { HttpError } from '@/server/http';

// Mirrors backend/src/app/core/rate_limit.py: Redis-backed counters (so the limit holds
// across replicas, not per-process), with an in-memory fallback if Redis is unreachable,
// keyed by client IP. Disabled in the same environments the Python limiter disables in —
// local dev/test/e2e would otherwise trip the same brute-force limit real users share.
const ENABLED = !['development', 'test', 'e2e'].includes(env.APP_ENV);

let redisClient: Redis | null = null;
function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis(env.REDIS_URL, { enableOfflineQueue: false, lazyConnect: true });
    redisClient.on('error', (err) => console.error('rate-limit Redis client error:', err));
  }
  return redisClient;
}

const limiters = new Map<string, RateLimiterRedis>();

function getLimiter(key: string, points: number, durationSeconds: number): RateLimiterRedis {
  let limiter = limiters.get(key);
  if (!limiter) {
    limiter = new RateLimiterRedis({
      storeClient: getRedisClient(),
      keyPrefix: `ratelimit:${key}`,
      points,
      duration: durationSeconds,
      insuranceLimiter: new RateLimiterMemory({ points, duration: durationSeconds }),
    });
    limiters.set(key, limiter);
  }
  return limiter;
}

function clientIp(request: Request): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) return forwardedFor.split(',')[0].trim();
  return request.headers.get('x-real-ip') ?? 'unknown';
}

// `key` scopes the counter per route (e.g. "auth:login"); `limit` is "N/minute"-style,
// matching the slowapi decorator strings this replaces.
export async function enforceRateLimit(
  request: Request,
  key: string,
  points: number,
  durationSeconds: number,
): Promise<void> {
  if (!ENABLED) return;
  try {
    await getLimiter(key, points, durationSeconds).consume(clientIp(request));
  } catch {
    throw new HttpError(429, 'Too many attempts. Please wait and try again.');
  }
}
