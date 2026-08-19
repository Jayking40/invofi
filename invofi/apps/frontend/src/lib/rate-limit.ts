/**
 * Minimal in-memory, fixed-window rate limiter for API Route Handlers.
 *
 * Scoped to a single server process/instance — on a multi-instance deployment
 * each instance tracks its own counts, so the *effective* limit scales with
 * instance count. That's an accepted tradeoff for now (see PR #237 review):
 * it still stops a single client from hammering an endpoint, which is the
 * immediate risk on unthrottled auth routes.
 */
import type { NextRequest } from 'next/server';

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** Epoch ms when the current window resets. */
  resetAt: number;
}

export interface RateLimitOptions {
  /** Max requests allowed per window. Default: 10. */
  limit?: number;
  /** Window size in ms. Default: 60_000 (1 minute). */
  windowMs?: number;
}

const DEFAULT_LIMIT = 10;
const DEFAULT_WINDOW_MS = 60_000;

// Bound memory use: once the bucket map grows past this, sweep expired
// entries on the next check rather than letting it grow unbounded.
const MAX_TRACKED_KEYS = 5000;

const buckets = new Map<string, RateLimitBucket>();

/**
 * Records a hit for `key` and reports whether it's within the allowed rate.
 * `key` should already include a namespace prefix (e.g. `sep10-verify:1.2.3.4`)
 * so different endpoints don't share a counter for the same client.
 */
export function checkRateLimit(key: string, options: RateLimitOptions = {}): RateLimitResult {
  const limit = options.limit ?? DEFAULT_LIMIT;
  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
  const now = Date.now();

  if (buckets.size > MAX_TRACKED_KEYS) {
    for (const [trackedKey, bucket] of buckets) {
      if (bucket.resetAt <= now) {
        buckets.delete(trackedKey);
      }
    }
  }

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: limit - 1, resetAt };
  }

  if (existing.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: existing.resetAt };
  }

  existing.count += 1;
  return { allowed: true, remaining: limit - existing.count, resetAt: existing.resetAt };
}

/** Test-only: clears all tracked buckets so tests don't leak state between runs. */
export function __resetRateLimitsForTests(): void {
  buckets.clear();
}

/**
 * Best-effort client IP for rate-limit keying. Trusts `x-forwarded-for` /
 * `x-real-ip` (set by the reverse proxy in front of the app — Vercel or
 * otherwise); falls back to a constant so requests with no proxy headers
 * still share a single (conservative) bucket instead of bypassing the limit.
 */
export function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const [first] = forwardedFor.split(',');
    if (first?.trim()) {
      return first.trim();
    }
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp?.trim()) {
    return realIp.trim();
  }

  return 'unknown';
}
