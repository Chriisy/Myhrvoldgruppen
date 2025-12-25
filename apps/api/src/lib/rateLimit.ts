import { TRPCError } from '@trpc/server';
import { logger } from './logger';

interface RateLimitConfig {
  windowMs: number;  // Time window in milliseconds
  maxRequests: number;  // Max requests per window
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory store (use Redis in production for distributed systems)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Default rate limit configs
export const RATE_LIMITS = {
  // General API endpoints
  default: { windowMs: 60 * 1000, maxRequests: 100 },  // 100 req/min

  // Stricter limits for auth
  auth: { windowMs: 15 * 60 * 1000, maxRequests: 10 },  // 10 req/15min

  // Generous limits for read operations
  read: { windowMs: 60 * 1000, maxRequests: 200 },  // 200 req/min

  // Strict limits for write operations
  write: { windowMs: 60 * 1000, maxRequests: 30 },  // 30 req/min

  // Very strict for expensive operations
  expensive: { windowMs: 60 * 1000, maxRequests: 5 },  // 5 req/min
} as const;

/**
 * Check rate limit for a given key
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig = RATE_LIMITS.default
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  // Clean up expired entries periodically
  if (Math.random() < 0.01) {
    cleanupExpiredEntries();
  }

  // No entry or expired - create new
  if (!entry || now >= entry.resetAt) {
    const newEntry: RateLimitEntry = {
      count: 1,
      resetAt: now + config.windowMs,
    };
    rateLimitStore.set(key, newEntry);

    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetAt: newEntry.resetAt,
    };
  }

  // Check if over limit
  if (entry.count >= config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
    };
  }

  // Increment counter
  entry.count++;
  rateLimitStore.set(key, entry);

  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetAt: entry.resetAt,
  };
}

/**
 * Create rate limit key from user/IP
 */
export function createRateLimitKey(
  identifier: string,
  operation: string
): string {
  return `ratelimit:${identifier}:${operation}`;
}

/**
 * Rate limit middleware for tRPC
 */
export function rateLimitMiddleware(
  config: RateLimitConfig = RATE_LIMITS.default
) {
  return async (opts: {
    ctx: { user?: { id: string } | null };
    next: () => Promise<any>;
    path: string;
  }) => {
    const { ctx, next, path } = opts;

    // Use user ID or 'anonymous' for rate limiting
    const identifier = ctx.user?.id || 'anonymous';
    const key = createRateLimitKey(identifier, path);

    const result = checkRateLimit(key, config);

    if (!result.allowed) {
      const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);

      logger.warn({
        identifier,
        path,
        retryAfter,
      }, 'Rate limit exceeded');

      throw new TRPCError({
        code: 'TOO_MANY_REQUESTS',
        message: `For mange forsok. Prov igjen om ${retryAfter} sekunder.`,
      });
    }

    return next();
  };
}

/**
 * Clean up expired entries from the store
 */
function cleanupExpiredEntries() {
  const now = Date.now();
  let cleaned = 0;

  for (const [key, entry] of rateLimitStore.entries()) {
    if (now >= entry.resetAt) {
      rateLimitStore.delete(key);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    logger.debug({ cleaned }, 'Cleaned up expired rate limit entries');
  }
}

/**
 * Reset rate limit for a key (useful for testing)
 */
export function resetRateLimit(key: string): void {
  rateLimitStore.delete(key);
}

/**
 * Get current rate limit stats
 */
export function getRateLimitStats(): { totalKeys: number; oldestEntry: number | null } {
  let oldest: number | null = null;

  for (const entry of rateLimitStore.values()) {
    if (oldest === null || entry.resetAt < oldest) {
      oldest = entry.resetAt;
    }
  }

  return {
    totalKeys: rateLimitStore.size,
    oldestEntry: oldest,
  };
}
