# Myhrvoldgruppen-Service - Teknisk Spesifikasjon

> **For Claude Code**: Les dette dokumentet FØR du starter. Følg mønstrene eksakt.

---

## 🏢 Om Prosjektet

**Myhrvoldgruppen AS** - Norges ledende serviceleverandør for storhusholdningsutstyr siden 1909.

| Fakta | Verdi |
|-------|-------|
| Ansatte | 60+ (40+ teknikere) |
| Kunder | 4000+ |
| Leverandører | 100+ aktive |
| Regioner | Oslo, Bergen, Trondheim, Distrikt |

---

## 🛠️ OPPDATERT Tech Stack (Desember 2024)

```
┌─────────────────────────────────────────────────────────────────┐
│                    FRONTEND (Universal)                          │
├─────────────────────────────────────────────────────────────────┤
│  Framework: Expo SDK 54 med Expo Router v6                      │
│  Language: TypeScript 5.x (strict mode)                         │
│  Styling: NativeWind v4 (Tailwind for React Native)             │
│  State: Zustand (global) + TanStack Query v5 (server)           │
│  Forms: React Hook Form + Zod                                   │
│  Icons: Lucide React Native                                     │
│  Charts: Victory Native                                         │
│  Maps: react-native-maps                                        │
├─────────────────────────────────────────────────────────────────┤
│  BACKEND                                                        │
├─────────────────────────────────────────────────────────────────┤
│  Framework: Fastify 5.x                                         │
│  API Layer: tRPC v11 (end-to-end type safety)                   │
│  Validation: Zod (shared with frontend)                         │
│  Database: PostgreSQL 16                                        │
│  ORM: Drizzle ORM                                               │
│  Auth: Better-Auth v1                                           │
│  File Storage: S3-compatible (Cloudflare R2)                    │
│  Queue: BullMQ + Redis                                          │
│  WebSocket: Fastify WebSocket                                   │
├─────────────────────────────────────────────────────────────────┤
│  MOBILE-SPESIFIKT                                               │
├─────────────────────────────────────────────────────────────────┤
│  Offline DB: expo-sqlite + Drizzle                              │
│  Sync: Custom sync med conflict resolution                      │
│  Push: Expo Notifications                                       │
│  Camera: expo-camera + expo-image-picker                        │
│  Signature: react-native-signature-canvas                       │
│  Biometrics: expo-local-authentication                          │
├─────────────────────────────────────────────────────────────────┤
│  DEPLOYMENT                                                     │
├─────────────────────────────────────────────────────────────────┤
│  Web: Expo Web Export → Vercel/Railway                          │
│  iOS: EAS Build → App Store                                     │
│  Android: EAS Build → Google Play                               │
│  API: Railway / Fly.io                                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📁 Monorepo Struktur

```
myhrvoldgruppen-service/
├── apps/
│   ├── mobile/                  # Expo Router app (web + iOS + Android)
│   │   ├── app/                 # File-based routing (Expo Router v6)
│   │   │   ├── _layout.tsx      # Root layout
│   │   │   ├── index.tsx        # Redirect to auth or dashboard
│   │   │   ├── (auth)/          # Auth group
│   │   │   │   ├── _layout.tsx
│   │   │   │   └── login.tsx
│   │   │   ├── (dashboard)/     # Main app group
│   │   │   │   ├── _layout.tsx  # Tab navigation
│   │   │   │   ├── index.tsx    # Dashboard home
│   │   │   │   ├── claims/
│   │   │   │   │   ├── index.tsx
│   │   │   │   │   ├── new.tsx
│   │   │   │   │   └── [id].tsx
│   │   │   │   ├── agreements/
│   │   │   │   ├── visits/
│   │   │   │   └── settings/
│   │   │   └── (portal)/        # Supplier portal (no auth)
│   │   │       ├── _layout.tsx
│   │   │       └── [code].tsx
│   │   ├── features/            # Feature modules
│   │   │   ├── claims/
│   │   │   │   ├── components/
│   │   │   │   ├── hooks/
│   │   │   │   ├── screens/
│   │   │   │   └── types.ts
│   │   │   ├── agreements/
│   │   │   ├── visits/
│   │   │   └── auth/
│   │   ├── shared/
│   │   │   ├── components/      # UI components
│   │   │   │   ├── Button.tsx
│   │   │   │   ├── Card.tsx
│   │   │   │   ├── Input.tsx
│   │   │   │   └── ...
│   │   │   ├── hooks/
│   │   │   └── utils/
│   │   ├── stores/              # Zustand stores
│   │   ├── lib/
│   │   │   ├── api.ts           # tRPC client
│   │   │   ├── auth.ts
│   │   │   └── i18n.ts
│   │   ├── locales/
│   │   │   └── nb.json          # Norwegian translations
│   │   ├── app.json
│   │   ├── tailwind.config.js
│   │   └── package.json
│   │
│   └── api/                     # Fastify backend
│       ├── src/
│       │   ├── index.ts
│       │   ├── app.ts
│       │   ├── lib/
│       │   │   ├── db.ts
│       │   │   ├── logger.ts
│       │   │   └── env.ts
│       │   ├── trpc/
│       │   │   ├── trpc.ts
│       │   │   ├── context.ts
│       │   │   ├── index.ts
│       │   │   └── routers/
│       │   │       ├── health.ts
│       │   │       ├── auth.ts
│       │   │       ├── claims.ts
│       │   │       ├── suppliers.ts
│       │   │       └── ...
│       │   └── services/
│       │       ├── pdf/
│       │       └── email/
│       └── package.json
│
├── packages/
│   ├── db/                      # Drizzle schemas
│   │   ├── src/
│   │   │   ├── schema/
│   │   │   │   ├── index.ts
│   │   │   │   ├── common.ts    # timestamps, softDelete
│   │   │   │   ├── auth/
│   │   │   │   ├── crm/
│   │   │   │   ├── claims/
│   │   │   │   ├── service/
│   │   │   │   ├── installations/
│   │   │   │   └── communication/
│   │   │   └── index.ts
│   │   ├── drizzle.config.ts
│   │   └── package.json
│   │
│   └── shared/                  # Shared types & utils
│       ├── src/
│       │   ├── types/
│       │   ├── constants/
│       │   └── validation/
│       └── package.json
│
├── tooling/
│   └── typescript/
│       └── base.json
│
├── turbo.json
├── package.json
├── pnpm-workspace.yaml
└── CLAUDE.md                    # This file
```

---

## 📌 LÆRDOMMER FRA TIDLIGERE VERSJON

| Problem | Løsning |
|---------|---------|
| schema.ts var 3164 linjer | Splitt per domene, maks 200 linjer |
| ReclamationView.tsx var 2920 linjer | Feature-basert, maks 300 linjer |
| Ingen soft delete | `deletedAt` på ALLE tabeller |
| Blandet naming | snake_case DB, camelCase TS |
| Ingen i18n | react-i18next fra start |
| Dårlig feilhåndtering | Error boundary + retry + logging |

### Filstørrelse-regler

| Filtype | Maks linjer | Handling ved overskridelse |
|---------|-------------|---------------------------|
| Schema (.ts i db/) | 200 | Splitt i flere filer |
| Komponenter (.tsx) | 300 | Ekstraher subkomponenter |
| Hooks | 150 | Splitt i mindre hooks |
| Utils | 100 | Grupper relaterte funksjoner |

---

## 🎨 Design System

### Fargepalett

```typescript
// tailwind.config.js
colors: {
  primary: {
    50: '#e6f0ff',
    100: '#cce0ff',
    500: '#0055aa',
    600: '#004488',
    700: '#003366',  // Brand primary
    800: '#002244',  // Sidebar bg
    900: '#001a33',
  },
  accent: {
    50: '#f0fdfa',
    100: '#ccfbf1',
    400: '#2dd4bf',
    500: '#14b8a6',
    600: '#0d9488',  // Primary accent
    700: '#0f766e',
  },
}
```

### UI Komponenter (inspirert av moderne dashboards)

```typescript
// Kort med subtil skygge
<View className="bg-white rounded-xl p-5 shadow-card">

// Stats card
<View className="bg-white rounded-xl p-5 shadow-card">
  <View className="flex-row items-center gap-3">
    <View className="w-11 h-11 rounded-xl bg-accent-100 items-center justify-center">
      <FileText size={20} color="#0d9488" />
    </View>
    <View>
      <Text className="text-2xl font-bold text-gray-900">24</Text>
      <Text className="text-sm text-gray-500">Reklamasjoner</Text>
    </View>
  </View>
</View>

// Primary button
<Pressable className="h-11 px-6 bg-accent-600 rounded-lg items-center justify-center">
  <Text className="text-base font-semibold text-white">Opprett sak</Text>
</Pressable>

// Status badge
<View className="px-2.5 py-1 rounded-full bg-amber-100">
  <Text className="text-xs font-medium text-amber-700">Venter</Text>
</View>
```

### Shadows

```css
--shadow-card: 0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.04);
--shadow-card-hover: 0 4px 12px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.04);
```

---

## 🗄️ Database Schema (common.ts)

```typescript
// packages/db/src/schema/common.ts
import { timestamp, uuid } from 'drizzle-orm/pg-core';

export const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
};

export const softDelete = {
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  deletedBy: uuid('deleted_by'),
};

export const baseFields = {
  ...timestamps,
  ...softDelete,
};
```

---

## 🌐 Expo Router v6 Patterns

### Root Layout

```typescript
// app/_layout.tsx
import '../global.css';
import '../lib/i18n';
import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { trpc, trpcClient } from '../lib/api';

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient());
  
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <Stack screenOptions={{ headerShown: false }} />
      </QueryClientProvider>
    </trpc.Provider>
  );
}
```

### Group Layout (Tabs)

```typescript
// app/(dashboard)/_layout.tsx
import { Tabs } from 'expo-router';
import { Home, FileText, Calendar, Settings } from 'lucide-react-native';

export default function DashboardLayout() {
  return (
    <Tabs screenOptions={{
      tabBarActiveTintColor: '#0d9488',
      tabBarInactiveTintColor: '#6b7280',
      headerShown: false,
    }}>
      <Tabs.Screen name="index" options={{
        title: 'Hjem',
        tabBarIcon: ({ color, size }) => <Home size={size} color={color} />,
      }} />
      <Tabs.Screen name="claims" options={{
        title: 'Saker',
        tabBarIcon: ({ color, size }) => <FileText size={size} color={color} />,
      }} />
      <Tabs.Screen name="visits" options={{
        title: 'Besøk',
        tabBarIcon: ({ color, size }) => <Calendar size={size} color={color} />,
      }} />
      <Tabs.Screen name="settings" options={{
        title: 'Innstillinger',
        tabBarIcon: ({ color, size }) => <Settings size={size} color={color} />,
      }} />
    </Tabs>
  );
}
```

### Dynamic Route

```typescript
// app/(dashboard)/claims/[id].tsx
import { useLocalSearchParams } from 'expo-router';
import { ClaimDetailScreen } from '../../../features/claims/screens/ClaimDetailScreen';

export default function ClaimDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ClaimDetailScreen claimId={id} />;
}
```

---

## 🔐 Auth Pattern

```typescript
// lib/auth.ts
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export const storage = {
  async getToken() {
    if (Platform.OS === 'web') {
      return localStorage.getItem('auth_token');
    }
    return SecureStore.getItemAsync('auth_token');
  },
  
  async setToken(token: string) {
    if (Platform.OS === 'web') {
      localStorage.setItem('auth_token', token);
    } else {
      await SecureStore.setItemAsync('auth_token', token);
    }
  },
  
  async removeToken() {
    if (Platform.OS === 'web') {
      localStorage.removeItem('auth_token');
    } else {
      await SecureStore.deleteItemAsync('auth_token');
    }
  },
};
```

---

## 🌍 i18n Setup

```typescript
// lib/i18n.ts
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

```json
// locales/nb.json
{
  "common": {
    "save": "Lagre",
    "cancel": "Avbryt",
    "delete": "Slett",
    "loading": "Laster...",
    "error": "Noe gikk galt"
  },
  "claims": {
    "title": "Reklamasjoner",
    "new": "Ny reklamasjon",
    "status": {
      "new": "Ny",
      "in_progress": "Under behandling",
      "pending_supplier": "Venter leverandør",
      "resolved": "Løst",
      "closed": "Lukket"
    }
  }
}
```

---

## 📊 tRPC Client Setup

```typescript
// lib/api.ts
import { createTRPCReact } from '@trpc/react-query';
import { httpBatchLink } from '@trpc/client';
import superjson from 'superjson';
import type { AppRouter } from '@myhrvold/api';
import { Platform } from 'react-native';
import { storage } from './auth';

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

export const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: `${getBaseUrl()}/trpc`,
      transformer: superjson,
      async headers() {
        const token = await storage.getToken();
        return token ? { Authorization: `Bearer ${token}` } : {};
      },
    }),
  ],
});
```

---

## ✅ Implementert (Fase 1-12)

| Fase | Status | Beskrivelse |
|------|--------|-------------|
| 1 | ✅ | Database foundation (common.ts, auth/) |
| 2 | ✅ | CRM (suppliers, products, customers) |
| 3 | ✅ | Claims (56 felt + parts, attachments, timeline) |
| 4 | ✅ | Service core (avtaler, partnere) |
| 5 | ✅ | Service visits (planlagte + utførte) |
| 6 | ✅ | Installations + transport damages |
| 7 | ✅ | Communication (discussion issues) |
| 8 | ✅ | API setup (Fastify + tRPC) |
| 9 | ✅ | API routers (claims, suppliers, customers) |
| 10 | ✅ | Expo setup med i18n |
| 11 | ✅ | Auth flow |
| 12 | ✅ | Claims liste UI |

---

## 🚀 Neste faser (Del 2)

| Fase | Prioritet | Beskrivelse | Est. tid |
|------|-----------|-------------|----------|
| 13 | 🔴 | Claims wizard (5-trinns skjema) | 60-90 min |
| 14 | 🔴 | Supplier portal (QR-kode) | 45-60 min |
| 15 | 🔴 | PDF generering | 45-60 min |
| 16 | 🟡 | Maintenance agreements UI | 60-90 min |
| 17 | 🟡 | Planned visits UI | 45-60 min |
| 18 | 🟢 | Service reports | 45-60 min |
| 19 | 🟢 | Service partners (map) | 60 min |
| 20 | 🟢 | Rental machines | 45 min |

---

## 📋 Kodestil

### Naming Conventions

```typescript
// Filer
claims.ts              // Schema
ClaimCard.tsx          // Component
useClaimForm.ts        // Hook
claim.service.ts       // Service

// Database
claim_number           // snake_case
created_at

// TypeScript
claimNumber            // camelCase
createdAt

// Konstanter
CLAIM_STATUS           // UPPER_SNAKE_CASE
```

### Component Template

```typescript
// features/claims/components/ClaimCard.tsx
import { View, Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';

interface ClaimCardProps {
  claim: {
    id: string;
    claimNumber: string;
    status: string;
    productNameText?: string;
    supplier?: { name: string };
  };
}

export function ClaimCard({ claim }: ClaimCardProps) {
  const { t } = useTranslation();
  const router = useRouter();
  
  return (
    <Pressable 
      onPress={() => router.push(`/claims/${claim.id}`)}
      className="bg-white rounded-xl p-4 shadow-card"
    >
      <View className="flex-row items-center gap-4">
        <View className="w-10 h-10 bg-primary-100 rounded-lg items-center justify-center">
          <Text className="text-primary-700 font-semibold text-sm">
            {claim.supplier?.name?.slice(0, 2).toUpperCase()}
          </Text>
        </View>
        <View className="flex-1">
          <Text className="font-medium text-gray-900">{claim.claimNumber}</Text>
          <Text className="text-sm text-gray-500">{claim.productNameText}</Text>
        </View>
        <ChevronRight size={20} color="#9ca3af" />
      </View>
    </Pressable>
  );
}
```

---

## 🧪 Test Kommandoer

```bash
# Database
cd packages/db
pnpm db:generate    # Generate migrations
pnpm db:push        # Push to database

# API
cd apps/api
pnpm dev            # Start dev server

# Mobile
cd apps/mobile
pnpm dev            # Start Expo
pnpm dev --web      # Web only
pnpm dev --ios      # iOS simulator
pnpm dev --android  # Android emulator

# Monorepo
pnpm install        # Install all deps
pnpm build          # Build all packages
pnpm lint           # Lint all packages
```

---

## ⚠️ Viktige regler

1. **ALLTID** bruk `baseFields` på alle tabeller
2. **ALDRI** overskrid filstørrelse-grensene
3. **ALLTID** bruk norsk i UI-tekst
4. **ALLTID** håndter loading og error states
5. **ALDRI** hardkod strenger - bruk i18n
6. **ALLTID** test med `pnpm db:generate` etter schema-endringer
