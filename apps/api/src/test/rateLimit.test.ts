import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  checkRateLimit,
  createRateLimitKey,
  resetRateLimit,
  RATE_LIMITS
} from '../lib/rateLimit';

describe('Rate Limiting', () => {
  beforeEach(() => {
    // Reset rate limits before each test
    resetRateLimit('test-key');
  });

  describe('checkRateLimit', () => {
    it('should allow first request', () => {
      const result = checkRateLimit('test-key', { windowMs: 60000, maxRequests: 10 });

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9);
    });

    it('should decrement remaining on each request', () => {
      const config = { windowMs: 60000, maxRequests: 5 };

      checkRateLimit('test-key', config);
      checkRateLimit('test-key', config);
      const result = checkRateLimit('test-key', config);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(2);
    });

    it('should block when limit exceeded', () => {
      const config = { windowMs: 60000, maxRequests: 2 };

      checkRateLimit('test-key', config);
      checkRateLimit('test-key', config);
      const result = checkRateLimit('test-key', config);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should use separate limits for different keys', () => {
      const config = { windowMs: 60000, maxRequests: 1 };

      const result1 = checkRateLimit('key1', config);
      const result2 = checkRateLimit('key2', config);

      expect(result1.allowed).toBe(true);
      expect(result2.allowed).toBe(true);
    });
  });

  describe('createRateLimitKey', () => {
    it('should create correct key format', () => {
      const key = createRateLimitKey('user-123', 'claims.list');
      expect(key).toBe('ratelimit:user-123:claims.list');
    });
  });

  describe('RATE_LIMITS', () => {
    it('should have correct default config', () => {
      expect(RATE_LIMITS.default.windowMs).toBe(60000);
      expect(RATE_LIMITS.default.maxRequests).toBe(100);
    });

    it('should have stricter auth limits', () => {
      expect(RATE_LIMITS.auth.maxRequests).toBeLessThan(RATE_LIMITS.default.maxRequests);
    });
  });
});
