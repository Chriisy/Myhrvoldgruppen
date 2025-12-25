import '../global.css';
import '../src/lib/i18n';
import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { trpc, trpcClient } from '../src/lib/api';
import { useAuthStore } from '../src/stores/auth.store';
import { LoadingScreen } from '../src/components/LoadingScreen';
import { ErrorBoundary } from 'react-error-boundary';
import { ErrorView } from '../src/components/ErrorView';

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        retry: 2,
        staleTime: 1000 * 60,
      },
    },
  }));

  const { loadAuth, isLoading } = useAuthStore();

  useEffect(() => {
    loadAuth();
  }, []);

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <ErrorBoundary FallbackComponent={({ error, resetErrorBoundary }) => (
      <ErrorView error={error} onRetry={resetErrorBoundary} />
    )}>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          <Stack screenOptions={{ headerShown: false }} />
        </QueryClientProvider>
      </trpc.Provider>
    </ErrorBoundary>
  );
}
