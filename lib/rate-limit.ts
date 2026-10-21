import "server-only";
import { headers } from "next/headers";
import { Redis } from "@upstash/redis";

// Shared, distributed rate limiting across every serverless instance when
// UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN are configured -- this is
// the real guarantee the in-memory fallback below cannot provide on its
// own. Falls back to the in-memory limiter when unset, so this behaves
// identically to before with zero configuration required -- same
// graceful-degradation pattern already used for Resend/Google Maps/Firebase
// elsewhere in this app. See the README's "Rate limiting" section.
const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

// In-memory, per-instance only: resets on redeploy/cold start and isn't
// shared across concurrent serverless instances -- the fallback used when
// Redis isn't configured, or if a Redis call itself fails.
type Bucket = { count: number; resetAt: number };
const memoryBuckets = new Map<string, Bucket>();

// Bounds memory use: without this, an attacker cycling through source IPs
// could grow this map indefinitely between cold starts.
const MAX_TRACKED_KEYS = 5000;

export async function getClientIp(): Promise<string> {
  const headersList = await headers();
  const forwardedFor = headersList.get("x-forwarded-for");
  if (forwardedFor) {
    // Vercel appends proxy hops after the client's own IP; the first entry
    // is the one that matters here.
    return forwardedFor.split(",")[0].trim();
  }
  return headersList.get("x-real-ip") ?? "unknown";
}

function checkRateLimitInMemory(
  key: string,
  limit: number,
  windowMs: number
): boolean {
  const now = Date.now();
  const existing = memoryBuckets.get(key);

  if (!existing || existing.resetAt <= now) {
    if (memoryBuckets.size >= MAX_TRACKED_KEYS) {
      for (const [trackedKey, bucket] of memoryBuckets) {
        if (bucket.resetAt <= now) memoryBuckets.delete(trackedKey);
      }
    }
    memoryBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  existing.count += 1;
  return existing.count <= limit;
}

// Fixed-window counter in Redis. `SET key 1 NX PX windowMs` atomically
// creates the key with its expiry in one round-trip only when it doesn't
// already exist -- the first request in a window always wins this and the
// TTL is set exactly once, at creation, with no gap where the key could
// exist without one. Every subsequent request in the same window just
// INCRs the existing counter, which keeps the TTL it already has.
async function checkRateLimitDistributed(
  key: string,
  limit: number,
  windowMs: number
): Promise<boolean> {
  const created = await redis!.set(key, 1, { nx: true, px: windowMs });
  if (created) {
    return true;
  }

  const count = await redis!.incr(key);
  return count <= limit;
}

/**
 * Returns true if the action identified by `key` is allowed right now,
 * false if `key` has already been recorded `limit` or more times within
 * the current `windowMs` window. Every call is recorded regardless of the
 * return value, so a caller retrying immediately after being blocked stays
 * blocked instead of resetting the window.
 *
 * Distributed (shared across every serverless instance) when Upstash
 * Redis is configured; otherwise an in-memory, per-instance fallback. On a
 * Redis error (transient outage, misconfiguration), fails open to the
 * in-memory limiter rather than blocking every request platform-wide --
 * a rate limiter being briefly less strict during a Redis blip is a far
 * smaller risk than a Redis blip taking the whole app's public endpoints
 * down with it.
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<boolean> {
  if (!redis) {
    return checkRateLimitInMemory(key, limit, windowMs);
  }

  try {
    return await checkRateLimitDistributed(key, limit, windowMs);
  } catch (err) {
    console.error("[rate-limit] Redis error, falling back to in-memory:", err);
    return checkRateLimitInMemory(key, limit, windowMs);
  }
}
