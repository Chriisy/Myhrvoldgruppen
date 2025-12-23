import { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import {
  cacheData,
  getCachedData,
  isOnline,
  queueOfflineAction,
  getQueuedActions,
  removeQueuedAction,
  OFFLINE_ACTIONS,
} from '../lib/offline';

interface UseOfflineDataOptions<T> {
  queryKey: string;
  fetcher: () => Promise<T>;
  ttl?: number;
  enabled?: boolean;
}

interface UseOfflineDataResult<T> {
  data: T | null;
  isLoading: boolean;
  isOffline: boolean;
  isCached: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook for offline-first data fetching
 * Tries to fetch fresh data when online, falls back to cache when offline
 */
export function useOfflineData<T>({
  queryKey,
  fetcher,
  ttl = 5 * 60 * 1000,
  enabled = true,
}: UseOfflineDataOptions<T>): UseOfflineDataResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [isCached, setIsCached] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const online = await isOnline();
      setIsOffline(!online);

      if (online) {
        // Try to fetch fresh data
        try {
          const freshData = await fetcher();
          setData(freshData);
          setIsCached(false);
          // Cache the fresh data
          await cacheData(queryKey, freshData, ttl);
        } catch (fetchError) {
          // Network error, try cache
          const cached = await getCachedData<T>(queryKey);
          if (cached) {
            setData(cached);
            setIsCached(true);
          } else {
            throw fetchError;
          }
        }
      } else {
        // Offline, use cache
        const cached = await getCachedData<T>(queryKey);
        if (cached) {
          setData(cached);
          setIsCached(true);
        } else {
          setError(new Error('No cached data available offline'));
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }, [queryKey, fetcher, ttl, enabled]);

  useEffect(() => {
    fetchData();

    // Listen for network changes
    const unsubscribe = NetInfo.addEventListener(state => {
      const nowOnline = state.isConnected === true;
      setIsOffline(!nowOnline);

      // Refetch when coming back online
      if (nowOnline && isCached) {
        fetchData();
      }
    });

    return () => unsubscribe();
  }, [fetchData, isCached]);

  return {
    data,
    isLoading,
    isOffline,
    isCached,
    error,
    refetch: fetchData,
  };
}

/**
 * Hook for offline-safe mutations
 * Queues mutations when offline and syncs when back online
 */
export function useOfflineMutation<TData, TVariables>(options: {
  mutationFn: (variables: TVariables) => Promise<TData>;
  actionType: keyof typeof OFFLINE_ACTIONS;
  onSuccess?: (data: TData) => void;
  onError?: (error: Error) => void;
  onOfflineQueued?: (actionId: string) => void;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(async (variables: TVariables) => {
    setIsLoading(true);
    setError(null);

    try {
      const online = await isOnline();

      if (online) {
        // Execute mutation directly
        const result = await options.mutationFn(variables);
        options.onSuccess?.(result);
        return result;
      } else {
        // Queue for later
        const actionId = await queueOfflineAction(options.actionType, variables);
        options.onOfflineQueued?.(actionId);
        return null;
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Mutation failed');
      setError(error);
      options.onError?.(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [options]);

  return {
    mutate,
    isLoading,
    error,
  };
}

/**
 * Hook to get offline sync status
 */
export function useOfflineSync() {
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const checkQueue = async () => {
      const actions = await getQueuedActions();
      setPendingCount(actions.length);
    };

    checkQueue();

    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOffline(state.isConnected !== true);
    });

    return () => unsubscribe();
  }, []);

  return {
    pendingCount,
    isSyncing,
    isOffline,
    hasPendingSync: pendingCount > 0,
  };
}
