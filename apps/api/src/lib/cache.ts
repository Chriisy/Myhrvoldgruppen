import { createClient, RedisClientType } from 'redis';
import { logger } from './logger';

let redisClient: RedisClientType | null = null;
let isConnected = false;

// Cache TTL presets (in seconds)
export const CACHE_TTL = {
  SHORT: 60,           // 1 minute
  MEDIUM: 300,         // 5 minutes
  LONG: 3600,          // 1 hour
  DAY: 86400,          // 24 hours
  WEEK: 604800,        // 7 days
} as const;

// Cache key prefixes
export const CACHE_KEYS = {
  USER: 'user:',
  SESSION: 'session:',
  CLAIMS: 'claims:',
  CUSTOMERS: 'customers:',
  SUPPLIERS: 'suppliers:',
  PRODUCTS: 'products:',
  STATS: 'stats:',
  SEARCH: 'search:',
} as const;

/**
 * Initialize Redis connection
 */
export async function initRedis(): Promise<void> {
  const url = process.env.REDIS_URL;

  if (!url) {
    logger.warn('Redis URL not configured, caching disabled');
    return;
  }

  try {
    redisClient = createClient({ url });

    redisClient.on('error', (err) => {
      logger.error({ err }, 'Redis client error');
      isConnected = false;
    });

    redisClient.on('connect', () => {
      logger.info('Redis connected');
      isConnected = true;
    });

    redisClient.on('disconnect', () => {
      logger.warn('Redis disconnected');
      isConnected = false;
    });

    await redisClient.connect();
  } catch (error) {
    logger.error({ error }, 'Failed to connect to Redis');
  }
}

/**
 * Close Redis connection
 */
export async function closeRedis(): Promise<void> {
  if (redisClient && isConnected) {
    await redisClient.quit();
    isConnected = false;
  }
}

/**
 * Get value from cache
 */
export async function getCache<T>(key: string): Promise<T | null> {
  if (!redisClient || !isConnected) return null;

  try {
    const value = await redisClient.get(key);
    if (!value) return null;
    return JSON.parse(value) as T;
  } catch (error) {
    logger.error({ error, key }, 'Failed to get from cache');
    return null;
  }
}

/**
 * Set value in cache
 */
export async function setCache<T>(
  key: string,
  value: T,
  ttlSeconds: number = CACHE_TTL.MEDIUM
): Promise<boolean> {
  if (!redisClient || !isConnected) return false;

  try {
    await redisClient.setEx(key, ttlSeconds, JSON.stringify(value));
    return true;
  } catch (error) {
    logger.error({ error, key }, 'Failed to set cache');
    return false;
  }
}

/**
 * Delete from cache
 */
export async function deleteCache(key: string): Promise<boolean> {
  if (!redisClient || !isConnected) return false;

  try {
    await redisClient.del(key);
    return true;
  } catch (error) {
    logger.error({ error, key }, 'Failed to delete from cache');
    return false;
  }
}

/**
 * Delete multiple keys by pattern
 */
export async function deleteCachePattern(pattern: string): Promise<number> {
  if (!redisClient || !isConnected) return 0;

  try {
    const keys = await redisClient.keys(pattern);
    if (keys.length === 0) return 0;

    await redisClient.del(keys);
    return keys.length;
  } catch (error) {
    logger.error({ error, pattern }, 'Failed to delete cache pattern');
    return 0;
  }
}

/**
 * Cache-aside pattern: get from cache or fetch and cache
 */
export async function cacheAside<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds: number = CACHE_TTL.MEDIUM
): Promise<T> {
  // Try to get from cache
  const cached = await getCache<T>(key);
  if (cached !== null) {
    return cached;
  }

  // Fetch fresh data
  const data = await fetcher();

  // Cache the result (don't await, fire and forget)
  setCache(key, data, ttlSeconds).catch(() => {});

  return data;
}

/**
 * Invalidate cache for an entity
 */
export async function invalidateEntity(
  prefix: keyof typeof CACHE_KEYS,
  id: string
): Promise<void> {
  const key = `${CACHE_KEYS[prefix]}${id}`;
  await deleteCache(key);

  // Also invalidate list caches
  await deleteCachePattern(`${CACHE_KEYS[prefix]}list:*`);
}

/**
 * Create cache key for list queries
 */
export function createListCacheKey(
  prefix: keyof typeof CACHE_KEYS,
  params: Record<string, any>
): string {
  const sortedParams = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');

  return `${CACHE_KEYS[prefix]}list:${sortedParams}`;
}

/**
 * Check if Redis is available
 */
export function isCacheAvailable(): boolean {
  return isConnected;
}

/**
 * Get cache stats
 */
export async function getCacheStats(): Promise<{
  connected: boolean;
  keyCount: number;
  memoryUsage: string;
} | null> {
  if (!redisClient || !isConnected) {
    return { connected: false, keyCount: 0, memoryUsage: '0' };
  }

  try {
    const info = await redisClient.info('memory');
    const keyCount = await redisClient.dbSize();

    const memoryMatch = info.match(/used_memory_human:(\S+)/);
    const memoryUsage = memoryMatch ? memoryMatch[1] : 'unknown';

    return {
      connected: true,
      keyCount,
      memoryUsage,
    };
  } catch (error) {
    logger.error({ error }, 'Failed to get cache stats');
    return null;
  }
}
