import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Upstash REST credentials. Set both in your environment:
//   UPSTASH_REDIS_REST_URL=https://<region>-<id>.upstash.io
//   UPSTASH_REDIS_REST_TOKEN=<long token from the Upstash console>
// If either is missing we skip rate limiting at runtime (the function is a
// no-op that always allows). That keeps `npm run dev` working without
// requiring every engineer to provision a Redis instance, but production
// deploys MUST set these — startup env validation (see instrumentation.ts)
// will warn loudly when they're missing in NODE_ENV=production.

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

const redis =
  url && token
    ? new Redis({ url, token })
    : null;

function makeLimiter(prefix: string, requests: number, window: `${number} s` | `${number} m` | `${number} h`) {
  if (!redis) return null;
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(requests, window),
    analytics: true,
    prefix: `ratelimit:${prefix}`,
  });
}

// One limiter per public-facing endpoint. Tighter limits on auth-ish flows
// (subscribe = email harvest target); looser on media upload (legit authors
// will fire several uploads back-to-back when assembling a post).
const subscribeLimiter = makeLimiter("subscribe", 5, "60 s");
const mediaUploadLimiter = makeLimiter("media-upload", 30, "60 s");

export type LimiterKey = "subscribe" | "media-upload";

const limiters: Record<LimiterKey, ReturnType<typeof makeLimiter>> = {
  subscribe: subscribeLimiter,
  "media-upload": mediaUploadLimiter,
};

export interface LimitResult {
  ok: boolean;
  /** Remaining requests in the current window (undefined when limiter is disabled). */
  remaining?: number;
  /** Unix ms when the window resets (undefined when limiter is disabled). */
  reset?: number;
  /** Limit per window (undefined when limiter is disabled). */
  limit?: number;
}

/**
 * Check the rate limit for `key`, keyed on `identifier` (typically the caller's
 * IP). When Upstash credentials aren't configured, returns `{ ok: true }` so
 * the request is allowed — paired with a startup warning so prod deploys
 * never miss the misconfiguration.
 */
export async function checkRateLimit(
  key: LimiterKey,
  identifier: string,
): Promise<LimitResult> {
  const limiter = limiters[key];
  if (!limiter) return { ok: true };
  const { success, remaining, reset, limit } = await limiter.limit(identifier);
  return { ok: success, remaining, reset, limit };
}

/**
 * Pull a stable client identifier out of a `Request`. Prefers the leftmost
 * value of `x-forwarded-for` (Vercel + most CDNs) and falls back to
 * `x-real-ip` then `cf-connecting-ip`. Returns `"unknown"` if every header is
 * missing — better to share a limiter bucket than to bypass entirely.
 */
export function clientIdFromRequest(req: Request): string {
  const h = req.headers;
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return h.get("x-real-ip") ?? h.get("cf-connecting-ip") ?? "unknown";
}

/**
 * Build the standard rate-limit response headers so clients (and CLI tools)
 * can self-throttle. RFC 9239-style header names.
 */
export function rateLimitHeaders(result: LimitResult): Record<string, string> {
  const headers: Record<string, string> = {};
  if (result.limit !== undefined) headers["X-RateLimit-Limit"] = String(result.limit);
  if (result.remaining !== undefined) headers["X-RateLimit-Remaining"] = String(result.remaining);
  if (result.reset !== undefined) headers["X-RateLimit-Reset"] = String(Math.ceil(result.reset / 1000));
  return headers;
}
