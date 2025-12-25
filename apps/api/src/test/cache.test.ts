import { describe, it, expect, vi } from 'vitest';
import {
  cacheData,
  getCachedData,
  removeCachedData,
  CACHE_TTL,
  createListCacheKey,
  CACHE_KEYS
} from '../lib/cache';

// Mock Redis client
vi.mock('redis', () => ({
  createClient: vi.fn(() => ({
    connect: vi.fn(),
    on: vi.fn(),
    get: vi.fn(),
    setEx: vi.fn(),
    del: vi.fn(),
    keys: vi.fn(),
    quit: vi.fn(),
  })),
}));

describe('Cache Utilities', () => {
  describe('createListCacheKey', () => {
    it('should create a sorted key from params', () => {
      const key = createListCacheKey('CLAIMS', { status: 'open', page: 1 });
      expect(key).toBe('claims:list:page=1&status=open');
    });

    it('should handle empty params', () => {
      const key = createListCacheKey('CUSTOMERS', {});
      expect(key).toBe('customers:list:');
    });
  });

  describe('CACHE_TTL', () => {
    it('should have correct TTL values', () => {
      expect(CACHE_TTL.SHORT).toBe(60);
      expect(CACHE_TTL.MEDIUM).toBe(300);
      expect(CACHE_TTL.LONG).toBe(3600);
      expect(CACHE_TTL.DAY).toBe(86400);
    });
  });

  describe('CACHE_KEYS', () => {
    it('should have all required prefixes', () => {
      expect(CACHE_KEYS.USER).toBe('user:');
      expect(CACHE_KEYS.CLAIMS).toBe('claims:');
      expect(CACHE_KEYS.CUSTOMERS).toBe('customers:');
    });
  });
});
