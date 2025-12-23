import { createTRPCReact } from '@trpc/react-query';
import { httpBatchLink } from '@trpc/client';
import superjson from 'superjson';
import type { AppRouter } from '@myhrvold/api/src/trpc/router';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export const trpc = createTRPCReact<AppRouter>();

function getBaseUrl() {
  if (Platform.OS === 'web') {
    return process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
  }
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3000';
  }
  return 'http://localhost:3000';
}

async function getAuthToken(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return localStorage.getItem('auth_token');
  }
  return SecureStore.getItemAsync('auth_token');
}

export const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: `${getBaseUrl()}/trpc`,
      transformer: superjson,
      async headers() {
        const token = await getAuthToken();
        return token ? { Authorization: `Bearer ${token}` } : {};
      },
    }),
  ],
});
