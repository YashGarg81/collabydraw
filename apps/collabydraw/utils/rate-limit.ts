import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Graceful degradation if Redis is not configured in local dev
const isRedisConfigured = !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN;

const redis = isRedisConfigured 
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null;

// Reusable limiters for different tiers / use cases
export const rateLimiters = {
  // Global API limiter (e.g. 100 req per 10s)
  global: isRedisConfigured ? new Ratelimit({
    redis: redis!,
    limiter: Ratelimit.slidingWindow(100, "10 s"),
    analytics: true,
    prefix: "@upstash/ratelimit/global",
  }) : null,

  // Stricter limits for AI endpoints to prevent abuse (e.g. 10 req per minute)
  ai: isRedisConfigured ? new Ratelimit({
    redis: redis!,
    limiter: Ratelimit.slidingWindow(10, "1 m"),
    analytics: true,
    prefix: "@upstash/ratelimit/ai",
  }) : null,

  // Strict limits for Auth endpoints (e.g. login, signup)
  auth: isRedisConfigured ? new Ratelimit({
    redis: redis!,
    limiter: Ratelimit.slidingWindow(5, "1 m"),
    analytics: true,
    prefix: "@upstash/ratelimit/auth",
  }) : null,

  // Limits for websocket connection upgrades/tickets
  websocket: isRedisConfigured ? new Ratelimit({
    redis: redis!,
    limiter: Ratelimit.slidingWindow(30, "1 m"),
    analytics: true,
    prefix: "@upstash/ratelimit/ws",
  }) : null,
};

type RateLimitType = keyof typeof rateLimiters;

/**
 * Reusable function to check rate limits.
 * Falls back to allowing the request if Redis is not configured.
 */
export async function checkRateLimit(identifier: string, type: RateLimitType = "global") {
  if (!isRedisConfigured || !rateLimiters[type]) {
    return { success: true, limit: 999, remaining: 999, reset: 0 };
  }

  return await rateLimiters[type].limit(identifier);
}
