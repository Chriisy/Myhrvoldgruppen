# FASE 10: Expo Setup (Universal App)

> Fase 1-9 må være fullført.
> Estimert tid: ~45 minutter.

## Mål

Sett opp Expo Router app med NativeWind for Web + iOS + Android.

---

## Mappestruktur

```
apps/mobile/
├── app/                      # Expo Router
│   ├── _layout.tsx          # Root layout
│   ├── index.tsx            # Redirect
│   ├── (auth)/
│   │   ├── _layout.tsx
│   │   └── login.tsx
│   └── (dashboard)/
│       ├── _layout.tsx
│       ├── index.tsx        # Dashboard
│       └── claims/
│           ├── index.tsx    # Liste
│           └── [id].tsx     # Detaljer
├── src/
│   ├── components/          # Shared components
│   ├── features/            # Feature modules
│   │   └── claims/
│   ├── lib/
│   │   ├── api.ts          # tRPC client
│   │   ├── i18n.ts         # Internasjonalisering
│   │   └── auth.ts         # Auth helpers
│   └── stores/
│       └── auth.store.ts
├── locales/
│   └── nb.json
├── tailwind.config.js
├── app.json
└── package.json
```

---

## Installer Expo

```bash
cd apps
npx create-expo-app@latest mobile --template blank-typescript
cd mobile

# Expo Router
npx expo install expo-router expo-linking expo-constants expo-status-bar

# NativeWind (Tailwind)
npx expo install nativewind tailwindcss

# State & Data
npx expo install @tanstack/react-query
pnpm add @trpc/client @trpc/react-query superjson zustand

# Forms
pnpm add react-hook-form zod @hookform/resolvers

# i18n
pnpm add i18next react-i18next

# Icons
npx expo install lucide-react-native react-native-svg

# Auth storage
npx expo install expo-secure-store

# Errors
pnpm add react-error-boundary
```

---

## apps/mobile/package.json

```json
{
  "name": "@myhrvold/mobile",
  "version": "0.0.1",
  "private": true,
  "main": "expo-router/entry",
  "scripts": {
    "dev": "expo start",
    "dev:web": "expo start --web",
    "dev:ios": "expo start --ios",
    "dev:android": "expo start --android",
    "build:web": "expo export -p web",
    "lint": "eslint . --ext .ts,.tsx",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "expo": "~52.0.0",
    "expo-router": "~4.0.0",
    "expo-linking": "~7.0.0",
    "expo-constants": "~17.0.0",
    "expo-status-bar": "~2.0.0",
    "expo-secure-store": "~14.0.0",
    "react": "18.3.1",
    "react-native": "0.76.0",
    "react-native-svg": "~15.8.0",
    "nativewind": "^4.0.0",
    "@tanstack/react-query": "^5.0.0",
    "@trpc/client": "^11.0.0",
    "@trpc/react-query": "^11.0.0",
    "superjson": "^2.2.0",
    "zustand": "^5.0.0",
    "react-hook-form": "^7.0.0",
    "@hookform/resolvers": "^3.0.0",
    "zod": "^3.23.0",
    "i18next": "^24.0.0",
    "react-i18next": "^15.0.0",
    "lucide-react-native": "^0.460.0",
    "react-error-boundary": "^4.0.0",
    "@myhrvold/shared": "workspace:*"
  },
  "devDependencies": {
    "@types/react": "~18.3.0",
    "tailwindcss": "^3.4.0",
    "typescript": "~5.6.0"
  }
}
```

---

## apps/mobile/tailwind.config.js

```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Myhrvold brand colors
        primary: {
          DEFAULT: '#003366',
          50: '#e6f0ff',
          100: '#cce0ff',
          500: '#003366',
          600: '#002d5c',
          700: '#002652',
        },
        accent: {
          DEFAULT: '#0d9488',
          50: '#f0fdfa',
          100: '#ccfbf1',
          500: '#0d9488',
          600: '#0f766e',
        },
      },
    },
  },
  plugins: [],
};
```

---

## apps/mobile/global.css

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

---

## apps/mobile/src/lib/api.ts

```typescript
import { createTRPCReact } from '@trpc/react-query';
import { httpBatchLink } from '@trpc/client';
import superjson from 'superjson';
import type { AppRouter } from '@myhrvold/api';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export const trpc = createTRPCReact<AppRouter>();

function getBaseUrl() {
  // Web
  if (Platform.OS === 'web') {
    return process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
  }
  // Android emulator
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3000';
  }
  // iOS simulator / device
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
```

---

## apps/mobile/src/lib/i18n.ts

```typescript
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import nb from '../../locales/nb.json';

i18n.use(initReactI18next).init({
  resources: {
    nb: { translation: nb },
  },
  lng: 'nb',
  fallbackLng: 'nb',
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
```

---

## apps/mobile/locales/nb.json

```json
{
  "common": {
    "save": "Lagre",
    "cancel": "Avbryt",
    "delete": "Slett",
    "edit": "Rediger",
    "loading": "Laster...",
    "error": "Noe gikk galt",
    "retry": "Prøv igjen",
    "search": "Søk",
    "filter": "Filter",
    "noResults": "Ingen resultater",
    "back": "Tilbake"
  },
  "auth": {
    "login": "Logg inn",
    "logout": "Logg ut",
    "email": "E-post",
    "password": "Passord",
    "loginError": "Feil e-post eller passord"
  },
  "dashboard": {
    "title": "Dashboard",
    "welcome": "Velkommen, {{name}}",
    "quickActions": "Hurtighandlinger",
    "newClaim": "Ny reklamasjon",
    "recentClaims": "Siste reklamasjoner"
  },
  "claims": {
    "title": "Reklamasjoner",
    "new": "Ny reklamasjon",
    "details": "Reklamasjonsdetaljer",
    "status": {
      "new": "Ny",
      "in_progress": "Under behandling",
      "pending_supplier": "Venter leverandør",
      "resolved": "Løst",
      "closed": "Lukket"
    },
    "priority": {
      "low": "Lav",
      "medium": "Medium",
      "high": "Høy",
      "urgent": "Haster"
    },
    "fields": {
      "claimNumber": "Saksnummer",
      "supplier": "Leverandør",
      "customer": "Kunde",
      "product": "Produkt",
      "description": "Beskrivelse",
      "createdAt": "Opprettet"
    }
  }
}
```

---

## apps/mobile/src/stores/auth.store.ts

```typescript
import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

interface User {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  role: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  setAuth: (user: User, token: string) => Promise<void>;
  logout: () => Promise<void>;
  loadAuth: () => Promise<void>;
}

async function setItem(key: string, value: string) {
  if (Platform.OS === 'web') {
    localStorage.setItem(key, value);
  } else {
    await SecureStore.setItemAsync(key, value);
  }
}

async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return localStorage.getItem(key);
  }
  return SecureStore.getItemAsync(key);
}

async function removeItem(key: string) {
  if (Platform.OS === 'web') {
    localStorage.removeItem(key);
  } else {
    await SecureStore.deleteItemAsync(key);
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isLoading: true,
  isAuthenticated: false,

  setAuth: async (user, token) => {
    await setItem('auth_token', token);
    await setItem('user', JSON.stringify(user));
    set({ user, token, isLoading: false, isAuthenticated: true });
  },

  logout: async () => {
    await removeItem('auth_token');
    await removeItem('user');
    set({ user: null, token: null, isLoading: false, isAuthenticated: false });
  },

  loadAuth: async () => {
    try {
      const token = await getItem('auth_token');
      const userStr = await getItem('user');
      
      if (token && userStr) {
        const user = JSON.parse(userStr);
        set({ user, token, isLoading: false, isAuthenticated: true });
      } else {
        set({ isLoading: false, isAuthenticated: false });
      }
    } catch {
      set({ isLoading: false, isAuthenticated: false });
    }
  },
}));
```

---

## apps/mobile/src/components/LoadingScreen.tsx

```tsx
import { View, ActivityIndicator, Text } from 'react-native';
import { useTranslation } from 'react-i18next';

export function LoadingScreen() {
  const { t } = useTranslation();
  
  return (
    <View className="flex-1 items-center justify-center bg-white">
      <ActivityIndicator size="large" color="#003366" />
      <Text className="mt-4 text-gray-500">{t('common.loading')}</Text>
    </View>
  );
}
```

---

## apps/mobile/src/components/ErrorView.tsx

```tsx
import { View, Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AlertCircle, RefreshCw } from 'lucide-react-native';

interface ErrorViewProps {
  error: Error | null;
  onRetry?: () => void;
}

export function ErrorView({ error, onRetry }: ErrorViewProps) {
  const { t } = useTranslation();
  
  return (
    <View className="flex-1 items-center justify-center bg-white p-6">
      <AlertCircle size={48} color="#ef4444" />
      <Text className="mt-4 text-lg font-semibold text-gray-900">
        {t('common.error')}
      </Text>
      <Text className="mt-2 text-center text-gray-500">
        {error?.message || 'En ukjent feil oppstod'}
      </Text>
      {onRetry && (
        <Pressable
          onPress={onRetry}
          className="mt-6 flex-row items-center rounded-lg bg-primary px-6 py-3"
        >
          <RefreshCw size={20} color="white" />
          <Text className="ml-2 font-medium text-white">
            {t('common.retry')}
          </Text>
        </Pressable>
      )}
    </View>
  );
}
```

---

## apps/mobile/app/_layout.tsx

```tsx
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
        staleTime: 1000 * 60, // 1 min
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
```

---

## apps/mobile/app/index.tsx

```tsx
import { Redirect } from 'expo-router';
import { useAuthStore } from '../src/stores/auth.store';

export default function Index() {
  const { isAuthenticated } = useAuthStore();
  
  if (isAuthenticated) {
    return <Redirect href="/(dashboard)" />;
  }
  
  return <Redirect href="/(auth)/login" />;
}
```

---

## Test

```bash
cd apps/mobile

# Web
pnpm dev:web

# iOS (krever Mac)
pnpm dev:ios

# Android
pnpm dev:android
```

---

## Sjekkliste

- [ ] Expo Router installert
- [ ] NativeWind/Tailwind fungerer
- [ ] tRPC client konfigurert
- [ ] i18n med norsk
- [ ] Auth store med SecureStore
- [ ] Loading og Error komponenter
- [ ] Root layout med providers
- [ ] Index redirect basert på auth

---

## Neste fase

Gå til **FASE 11: Auth Flow** for login/logout.
