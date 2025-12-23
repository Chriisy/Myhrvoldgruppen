# FASE 11: Expo Setup + packages/ui Integration

> Fase 8-10 (API) må være fullført.
> Estimert tid: ~45 minutter.

## Mål

Sett opp Expo Router app med packages/ui og tRPC-integrasjon.

---

## Mappestruktur

```
apps/mobile/
├── package.json
├── app.json
├── tsconfig.json
├── tailwind.config.js
├── global.css
├── app/
│   ├── _layout.tsx           # Root layout
│   ├── index.tsx             # Redirect
│   ├── (auth)/
│   │   ├── _layout.tsx
│   │   └── login.tsx
│   └── (dashboard)/
│       ├── _layout.tsx
│       └── index.tsx
├── lib/
│   ├── api.ts                # tRPC client
│   ├── i18n.ts               # Internationalization
│   └── auth.ts               # Auth helpers
├── stores/
│   └── auth.store.ts         # Zustand store
└── locales/
    └── nb.json               # Norwegian translations
```

---

## package.json

```json
{
  "name": "@myhrvold/mobile",
  "version": "0.0.1",
  "private": true,
  "main": "expo-router/entry",
  "scripts": {
    "dev": "expo start",
    "android": "expo start --android",
    "ios": "expo start --ios",
    "web": "expo start --web",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "expo": "~54.0.0",
    "expo-router": "~4.0.0",
    "expo-linking": "~7.0.0",
    "expo-status-bar": "~2.0.0",
    "expo-secure-store": "~14.0.0",
    "expo-image-picker": "~16.0.0",
    "react": "18.3.1",
    "react-native": "0.76.0",
    "react-native-safe-area-context": "~5.0.0",
    "react-native-screens": "~4.0.0",
    "react-native-svg": "~15.8.0",
    "@tanstack/react-query": "^5.0.0",
    "@trpc/client": "^11.0.0",
    "@trpc/react-query": "^11.0.0",
    "superjson": "^2.2.0",
    "zustand": "^5.0.0",
    "nativewind": "^4.0.0",
    "tailwindcss": "^3.4.0",
    "lucide-react-native": "^0.400.0",
    "i18next": "^23.0.0",
    "react-i18next": "^14.0.0",
    "react-hook-form": "^7.50.0",
    "@hookform/resolvers": "^3.3.0",
    "zod": "^3.23.0",
    "clsx": "^2.1.0",
    "@myhrvold/ui": "workspace:*",
    "@myhrvold/shared": "workspace:*"
  },
  "devDependencies": {
    "@types/react": "~18.3.0",
    "typescript": "^5.6.0"
  }
}
```

---

## tailwind.config.js

```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './features/**/*.{js,jsx,ts,tsx}',
    '../../packages/ui/src/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: '#003366',
        accent: '#0d9488',
        success: '#22c55e',
        warning: '#f59e0b',
        danger: '#ef4444',
      },
    },
  },
  plugins: [],
};
```

---

## global.css

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

---

## lib/api.ts

```typescript
import { createTRPCReact } from '@trpc/react-query';
import { httpBatchLink } from '@trpc/client';
import superjson from 'superjson';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type { AppRouter } from '@myhrvold/api';

export const trpc = createTRPCReact<AppRouter>();

function getBaseUrl() {
  if (Platform.OS === 'web') return 'http://localhost:3000';
  if (Platform.OS === 'android') return 'http://10.0.2.2:3000';
  return 'http://localhost:3000';
}

async function getToken(): Promise<string | null> {
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
        const token = await getToken();
        return token ? { Authorization: `Bearer ${token}` } : {};
      },
    }),
  ],
});
```

---

## lib/i18n.ts

```typescript
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import nb from '../locales/nb.json';

i18n.use(initReactI18next).init({
  resources: { nb: { translation: nb } },
  lng: 'nb',
  fallbackLng: 'nb',
  interpolation: { escapeValue: false },
});

export default i18n;
```

---

## locales/nb.json

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
    "noResults": "Ingen resultater"
  },
  "auth": {
    "login": "Logg inn",
    "logout": "Logg ut",
    "email": "E-post",
    "password": "Passord",
    "welcomeBack": "Velkommen tilbake",
    "loginError": "Feil e-post eller passord"
  },
  "claims": {
    "title": "Reklamasjoner",
    "new": "Ny reklamasjon",
    "status": {
      "draft": "Utkast",
      "new": "Ny",
      "in_progress": "Under behandling",
      "pending_supplier": "Venter leverandør",
      "resolved": "Løst",
      "closed": "Lukket"
    }
  },
  "dashboard": {
    "title": "Dashboard",
    "welcome": "Velkommen, {{name}}"
  }
}
```

---

## stores/auth.store.ts

```typescript
import { create } from 'zustand';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

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
    const token = await getItem('auth_token');
    const userStr = await getItem('user');
    
    if (token && userStr) {
      const user = JSON.parse(userStr);
      set({ user, token, isLoading: false, isAuthenticated: true });
    } else {
      set({ isLoading: false, isAuthenticated: false });
    }
  },
}));
```

---

## app/_layout.tsx

```tsx
import '../global.css';
import '../lib/i18n';
import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { trpc, trpcClient } from '../lib/api';
import { useAuthStore } from '../stores/auth.store';
import { Loading } from '@myhrvold/ui';

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: { retry: 2, staleTime: 1000 * 60 },
    },
  }));
  
  const { isLoading, loadAuth } = useAuthStore();

  useEffect(() => {
    loadAuth();
  }, []);

  if (isLoading) {
    return <Loading message="Laster..." />;
  }

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <Stack screenOptions={{ headerShown: false }} />
      </QueryClientProvider>
    </trpc.Provider>
  );
}
```

---

## app/index.tsx

```tsx
import { Redirect } from 'expo-router';
import { useAuthStore } from '../stores/auth.store';

export default function Index() {
  const { isAuthenticated } = useAuthStore();
  
  if (isAuthenticated) {
    return <Redirect href="/(dashboard)" />;
  }
  
  return <Redirect href="/(auth)/login" />;
}
```

---

## app/(auth)/_layout.tsx

```tsx
import { Stack } from 'expo-router';
import { Redirect } from 'expo-router';
import { useAuthStore } from '../../stores/auth.store';

export default function AuthLayout() {
  const { isAuthenticated } = useAuthStore();

  if (isAuthenticated) {
    return <Redirect href="/(dashboard)" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
```

---

## app/(auth)/login.tsx

```tsx
import { View, Text, KeyboardAvoidingView, Platform } from 'react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { Button, Input, Card } from '@myhrvold/ui';
import { trpc } from '../../lib/api';
import { useAuthStore } from '../../stores/auth.store';

export default function LoginScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { setAuth } = useAuthStore();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: async (data) => {
      await setAuth(data.user, data.token);
      router.replace('/(dashboard)');
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const handleLogin = () => {
    setError('');
    loginMutation.mutate({ email, password });
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-gray-50"
    >
      <View className="flex-1 justify-center px-6">
        <View className="items-center mb-8">
          <Text className="text-3xl font-bold text-primary">Myhrvoldgruppen</Text>
          <Text className="text-gray-500 mt-2">{t('auth.welcomeBack')}</Text>
        </View>

        <Card padding="lg">
          <View className="gap-4">
            <Input
              label={t('auth.email')}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              placeholder="din@epost.no"
            />
            
            <Input
              label={t('auth.password')}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="••••••••"
            />

            {error && (
              <Text className="text-red-500 text-sm">{error}</Text>
            )}

            <Button
              onPress={handleLogin}
              loading={loginMutation.isPending}
              fullWidth
            >
              {t('auth.login')}
            </Button>
          </View>
        </Card>
      </View>
    </KeyboardAvoidingView>
  );
}
```

---

## app/(dashboard)/_layout.tsx

```tsx
import { Tabs } from 'expo-router';
import { Redirect } from 'expo-router';
import { Home, FileText, Settings } from 'lucide-react-native';
import { useAuthStore } from '../../stores/auth.store';

export default function DashboardLayout() {
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Tabs screenOptions={{
      tabBarActiveTintColor: '#003366',
      headerShown: false,
    }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Hjem',
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="claims"
        options={{
          title: 'Reklamasjoner',
          tabBarIcon: ({ color, size }) => <FileText color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Innstillinger',
          tabBarIcon: ({ color, size }) => <Settings color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
```

---

## app/(dashboard)/index.tsx

```tsx
import { View, Text, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatCard, Card } from '@myhrvold/ui';
import { FileText, CheckCircle, Clock, AlertTriangle } from 'lucide-react-native';
import { useAuthStore } from '../../stores/auth.store';

export default function DashboardScreen() {
  const { t } = useTranslation();
  const { user } = useAuthStore();

  const firstName = user?.firstName || 'bruker';

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView className="flex-1">
        {/* Header */}
        <View className="bg-primary p-6">
          <Text className="text-white text-2xl font-bold">
            {t('dashboard.welcome', { name: firstName })}
          </Text>
          <Text className="text-white/70 mt-1">
            {new Date().toLocaleDateString('nb-NO', { 
              weekday: 'long', 
              day: 'numeric', 
              month: 'long' 
            })}
          </Text>
        </View>

        {/* Stats */}
        <View className="flex-row flex-wrap gap-3 p-4">
          <StatCard
            label="Reklamasjoner"
            value={24}
            icon={<FileText size={20} color="#003366" />}
            color="info"
          />
          <StatCard
            label="Løst"
            value={18}
            icon={<CheckCircle size={20} color="#22c55e" />}
            color="success"
          />
          <StatCard
            label="Venter"
            value={4}
            icon={<Clock size={20} color="#f59e0b" />}
            color="warning"
          />
          <StatCard
            label="Haster"
            value={2}
            icon={<AlertTriangle size={20} color="#ef4444" />}
            color="danger"
          />
        </View>

        {/* Quick actions */}
        <View className="p-4">
          <Card>
            <Text className="text-lg font-semibold mb-4">Hurtighandlinger</Text>
            {/* Add quick action buttons */}
          </Card>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
```

---

## Test

```bash
# Start API først
pnpm --filter @myhrvold/api dev

# Start Expo
pnpm --filter @myhrvold/mobile dev

# Trykk 'w' for web, 'i' for iOS simulator, 'a' for Android
```

---

## Sjekkliste

- [ ] package.json med dependencies
- [ ] Tailwind + NativeWind konfigurert
- [ ] tRPC client satt opp
- [ ] i18n fungerer
- [ ] Auth store fungerer
- [ ] Login screen med @myhrvold/ui
- [ ] Dashboard vises
- [ ] Navigation fungerer
