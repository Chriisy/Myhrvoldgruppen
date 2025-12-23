import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

const CACHE_PREFIX = '@myhrvold_cache:';
const QUEUE_KEY = '@myhrvold_offline_queue';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

interface QueuedAction {
  id: string;
  type: string;
  payload: any;
  createdAt: number;
  retryCount: number;
}

// Cache TTL in milliseconds
const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes
const LONG_TTL = 60 * 60 * 1000; // 1 hour

/**
 * Save data to offline cache
 */
export async function cacheData<T>(
  key: string,
  data: T,
  ttl: number = DEFAULT_TTL
): Promise<void> {
  const entry: CacheEntry<T> = {
    data,
    timestamp: Date.now(),
    expiresAt: Date.now() + ttl,
  };

  try {
    await AsyncStorage.setItem(
      CACHE_PREFIX + key,
      JSON.stringify(entry)
    );
  } catch (error) {
    console.error('Failed to cache data:', error);
  }
}

/**
 * Get data from offline cache
 */
export async function getCachedData<T>(key: string): Promise<T | null> {
  try {
    const stored = await AsyncStorage.getItem(CACHE_PREFIX + key);
    if (!stored) return null;

    const entry: CacheEntry<T> = JSON.parse(stored);

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      await AsyncStorage.removeItem(CACHE_PREFIX + key);
      return null;
    }

    return entry.data;
  } catch (error) {
    console.error('Failed to get cached data:', error);
    return null;
  }
}

/**
 * Remove cached data
 */
export async function removeCachedData(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(CACHE_PREFIX + key);
  } catch (error) {
    console.error('Failed to remove cached data:', error);
  }
}

/**
 * Clear all cached data
 */
export async function clearCache(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter(k => k.startsWith(CACHE_PREFIX));
    await AsyncStorage.multiRemove(cacheKeys);
  } catch (error) {
    console.error('Failed to clear cache:', error);
  }
}

/**
 * Check if device is online
 */
export async function isOnline(): Promise<boolean> {
  const state = await NetInfo.fetch();
  return state.isConnected === true && state.isInternetReachable !== false;
}

/**
 * Queue an action for later sync when offline
 */
export async function queueOfflineAction(
  type: string,
  payload: any
): Promise<string> {
  const action: QueuedAction = {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type,
    payload,
    createdAt: Date.now(),
    retryCount: 0,
  };

  try {
    const stored = await AsyncStorage.getItem(QUEUE_KEY);
    const queue: QueuedAction[] = stored ? JSON.parse(stored) : [];
    queue.push(action);
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    return action.id;
  } catch (error) {
    console.error('Failed to queue offline action:', error);
    throw error;
  }
}

/**
 * Get all queued actions
 */
export async function getQueuedActions(): Promise<QueuedAction[]> {
  try {
    const stored = await AsyncStorage.getItem(QUEUE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Failed to get queued actions:', error);
    return [];
  }
}

/**
 * Remove a queued action
 */
export async function removeQueuedAction(actionId: string): Promise<void> {
  try {
    const stored = await AsyncStorage.getItem(QUEUE_KEY);
    const queue: QueuedAction[] = stored ? JSON.parse(stored) : [];
    const updated = queue.filter(a => a.id !== actionId);
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('Failed to remove queued action:', error);
  }
}

/**
 * Update retry count for a queued action
 */
export async function incrementRetryCount(actionId: string): Promise<void> {
  try {
    const stored = await AsyncStorage.getItem(QUEUE_KEY);
    const queue: QueuedAction[] = stored ? JSON.parse(stored) : [];
    const updated = queue.map(a =>
      a.id === actionId ? { ...a, retryCount: a.retryCount + 1 } : a
    );
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('Failed to increment retry count:', error);
  }
}

/**
 * Get pending sync count
 */
export async function getPendingSyncCount(): Promise<number> {
  const queue = await getQueuedActions();
  return queue.length;
}

// Offline action types
export const OFFLINE_ACTIONS = {
  CREATE_CLAIM: 'CREATE_CLAIM',
  UPDATE_CLAIM: 'UPDATE_CLAIM',
  COMPLETE_VISIT: 'COMPLETE_VISIT',
  SAVE_SIGNATURE: 'SAVE_SIGNATURE',
  SEND_MESSAGE: 'SEND_MESSAGE',
} as const;

export type OfflineActionType = typeof OFFLINE_ACTIONS[keyof typeof OFFLINE_ACTIONS];
