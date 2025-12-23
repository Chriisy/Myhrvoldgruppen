# FASE 12: Claims UI (Liste & Detaljer)

> Fase 1-11 må være fullført.
> Estimert tid: ~60 minutter.

## Mål

Bygg reklamasjons-UI med liste, detaljer og opprettelse.

---

## Mappestruktur

```
apps/mobile/
├── app/(dashboard)/
│   ├── _layout.tsx
│   ├── index.tsx              # Dashboard
│   └── claims/
│       ├── index.tsx          # Liste
│       ├── [id].tsx           # Detaljer
│       └── new.tsx            # Ny reklamasjon
└── src/features/claims/
    ├── components/
    │   ├── ClaimCard.tsx
    │   ├── ClaimStatusBadge.tsx
    │   └── ClaimStats.tsx
    └── screens/
        ├── ClaimsListScreen.tsx
        └── ClaimDetailScreen.tsx
```

---

## Dashboard Layout

### apps/mobile/app/(dashboard)/_layout.tsx

```tsx
import { Tabs } from 'expo-router';
import { Home, FileText, Settings, User } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

export default function DashboardLayout() {
  const { t } = useTranslation();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#003366',
        tabBarInactiveTintColor: '#9ca3af',
        tabBarStyle: {
          borderTopWidth: 1,
          borderTopColor: '#e5e7eb',
          paddingTop: 8,
          paddingBottom: 8,
          height: 60,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('dashboard.title'),
          tabBarIcon: ({ color, size }) => <Home size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="claims"
        options={{
          title: t('claims.title'),
          tabBarIcon: ({ color, size }) => <FileText size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color, size }) => <User size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
```

---

## Claims Components

### src/features/claims/components/ClaimStatusBadge.tsx

```tsx
import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';

const STATUS_COLORS = {
  new: { bg: 'bg-blue-100', text: 'text-blue-700' },
  in_progress: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  pending_supplier: { bg: 'bg-orange-100', text: 'text-orange-700' },
  resolved: { bg: 'bg-green-100', text: 'text-green-700' },
  closed: { bg: 'bg-gray-100', text: 'text-gray-700' },
} as const;

interface ClaimStatusBadgeProps {
  status: keyof typeof STATUS_COLORS;
}

export function ClaimStatusBadge({ status }: ClaimStatusBadgeProps) {
  const { t } = useTranslation();
  const colors = STATUS_COLORS[status] || STATUS_COLORS.new;

  return (
    <View className={`px-2 py-1 rounded-full ${colors.bg}`}>
      <Text className={`text-xs font-medium ${colors.text}`}>
        {t(`claims.status.${status}`)}
      </Text>
    </View>
  );
}
```

---

### src/features/claims/components/ClaimStats.tsx

```tsx
import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { FileText, Clock, CheckCircle, AlertTriangle } from 'lucide-react-native';

interface ClaimStatsProps {
  stats: {
    new: number;
    inProgress: number;
    pendingSupplier: number;
    resolved: number;
  };
}

export function ClaimStats({ stats }: ClaimStatsProps) {
  const { t } = useTranslation();

  const items = [
    { 
      label: t('claims.status.new'), 
      value: stats.new, 
      icon: FileText, 
      color: '#3b82f6',
      bg: 'bg-blue-50',
    },
    { 
      label: t('claims.status.in_progress'), 
      value: stats.inProgress, 
      icon: Clock, 
      color: '#eab308',
      bg: 'bg-yellow-50',
    },
    { 
      label: t('claims.status.pending_supplier'), 
      value: stats.pendingSupplier, 
      icon: AlertTriangle, 
      color: '#f97316',
      bg: 'bg-orange-50',
    },
    { 
      label: t('claims.status.resolved'), 
      value: stats.resolved, 
      icon: CheckCircle, 
      color: '#22c55e',
      bg: 'bg-green-50',
    },
  ];

  return (
    <View className="flex-row flex-wrap gap-2 mb-4">
      {items.map((item) => (
        <View 
          key={item.label} 
          className={`flex-1 min-w-[45%] p-3 rounded-lg ${item.bg}`}
        >
          <View className="flex-row items-center">
            <item.icon size={16} color={item.color} />
            <Text className="ml-2 text-2xl font-bold" style={{ color: item.color }}>
              {item.value}
            </Text>
          </View>
          <Text className="text-xs text-gray-600 mt-1">{item.label}</Text>
        </View>
      ))}
    </View>
  );
}
```

---

### src/features/claims/components/ClaimCard.tsx

```tsx
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronRight, Calendar } from 'lucide-react-native';
import { ClaimStatusBadge } from './ClaimStatusBadge';

interface Claim {
  id: string;
  claimNumber: string;
  status: string;
  productNameText?: string | null;
  customerCompanyName?: string | null;
  supplier?: { name: string } | null;
  createdAt: Date;
}

interface ClaimCardProps {
  claim: Claim;
}

export function ClaimCard({ claim }: ClaimCardProps) {
  const router = useRouter();

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('nb-NO', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <Pressable
      onPress={() => router.push(`/claims/${claim.id}`)}
      className="bg-white p-4 rounded-xl shadow-sm mb-3 border border-gray-100 active:bg-gray-50"
    >
      <View className="flex-row items-start justify-between">
        <View className="flex-1">
          {/* Claim Number & Status */}
          <View className="flex-row items-center gap-2 mb-2">
            <Text className="text-primary font-bold text-base">
              {claim.claimNumber}
            </Text>
            <ClaimStatusBadge status={claim.status as any} />
          </View>

          {/* Product */}
          <Text className="text-gray-900 font-medium" numberOfLines={1}>
            {claim.productNameText || 'Ukjent produkt'}
          </Text>

          {/* Customer */}
          <Text className="text-gray-500 text-sm" numberOfLines={1}>
            {claim.customerCompanyName || 'Ingen kunde'}
          </Text>

          {/* Supplier & Date */}
          <View className="flex-row items-center mt-2">
            <Text className="text-xs text-gray-400">
              {claim.supplier?.name}
            </Text>
            <View className="mx-2 w-1 h-1 rounded-full bg-gray-300" />
            <View className="flex-row items-center">
              <Calendar size={12} color="#9ca3af" />
              <Text className="text-xs text-gray-400 ml-1">
                {formatDate(claim.createdAt)}
              </Text>
            </View>
          </View>
        </View>

        <ChevronRight size={20} color="#9ca3af" className="ml-2" />
      </View>
    </Pressable>
  );
}
```

---

## Claims Screens

### src/features/claims/screens/ClaimsListScreen.tsx

```tsx
import { View, Text, FlatList, RefreshControl, TextInput, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { trpc } from '../../../lib/api';
import { ClaimCard } from '../components/ClaimCard';
import { ClaimStats } from '../components/ClaimStats';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { ErrorView } from '../../../components/ErrorView';
import { Search, Plus, Filter } from 'lucide-react-native';

export function ClaimsListScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string | undefined>();

  const { 
    data: claims, 
    isLoading, 
    error, 
    refetch,
    isRefetching,
  } = trpc.claims.list.useQuery({ 
    page: 1, 
    limit: 50,
    search: search || undefined,
    status,
  });

  const { data: stats } = trpc.claims.stats.useQuery();

  if (isLoading) return <LoadingScreen />;
  if (error) return <ErrorView error={error} onRetry={refetch} />;

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-primary pt-12 pb-6 px-4">
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-white text-2xl font-bold">
            {t('claims.title')}
          </Text>
          <Pressable
            onPress={() => router.push('/claims/new')}
            className="bg-accent px-4 py-2 rounded-lg flex-row items-center"
          >
            <Plus size={18} color="white" />
            <Text className="text-white font-medium ml-1">Ny</Text>
          </Pressable>
        </View>

        {/* Search */}
        <View className="flex-row items-center bg-white/10 rounded-lg px-3 py-2">
          <Search size={20} color="rgba(255,255,255,0.7)" />
          <TextInput
            className="flex-1 ml-2 text-white placeholder:text-white/50"
            placeholder={t('common.search')}
            placeholderTextColor="rgba(255,255,255,0.5)"
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </View>

      {/* Content */}
      <FlatList
        data={claims}
        renderItem={({ item }) => <ClaimCard claim={item} />}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16 }}
        ListHeaderComponent={
          stats ? <ClaimStats stats={stats} /> : null
        }
        refreshControl={
          <RefreshControl 
            refreshing={isRefetching} 
            onRefresh={refetch}
            tintColor="#003366"
          />
        }
        ListEmptyComponent={
          <View className="items-center py-12">
            <Text className="text-gray-500">{t('common.noResults')}</Text>
          </View>
        }
      />
    </View>
  );
}
```

---

### src/features/claims/screens/ClaimDetailScreen.tsx

```tsx
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { trpc } from '../../../lib/api';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { ErrorView } from '../../../components/ErrorView';
import { ClaimStatusBadge } from '../components/ClaimStatusBadge';
import { 
  ArrowLeft, 
  Building, 
  Package, 
  User, 
  Calendar,
  FileText,
  MessageSquare,
  Paperclip,
} from 'lucide-react-native';

export function ClaimDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const router = useRouter();

  const { data: claim, isLoading, error, refetch } = trpc.claims.byId.useQuery(
    { id: id! },
    { enabled: !!id }
  );

  if (isLoading) return <LoadingScreen />;
  if (error) return <ErrorView error={error} onRetry={refetch} />;
  if (!claim) return <ErrorView error={new Error('Ikke funnet')} />;

  const formatDate = (date: Date | null | undefined) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('nb-NO', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  };

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-primary pt-12 pb-6 px-4">
        <View className="flex-row items-center mb-4">
          <Pressable onPress={() => router.back()} className="mr-4">
            <ArrowLeft size={24} color="white" />
          </Pressable>
          <View className="flex-1">
            <Text className="text-white text-xl font-bold">
              {claim.claimNumber}
            </Text>
            <ClaimStatusBadge status={claim.status as any} />
          </View>
        </View>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }}>
        {/* Product Info */}
        <View className="bg-white rounded-xl p-4 mb-4">
          <View className="flex-row items-center mb-3">
            <Package size={20} color="#003366" />
            <Text className="ml-2 text-lg font-semibold text-gray-900">
              Produkt
            </Text>
          </View>
          <Text className="text-gray-900 font-medium">
            {claim.productNameText || 'Ikke angitt'}
          </Text>
          {claim.serialNumber && (
            <Text className="text-gray-500 text-sm mt-1">
              Serienr: {claim.serialNumber}
            </Text>
          )}
        </View>

        {/* Customer */}
        <View className="bg-white rounded-xl p-4 mb-4">
          <View className="flex-row items-center mb-3">
            <Building size={20} color="#003366" />
            <Text className="ml-2 text-lg font-semibold text-gray-900">
              Kunde
            </Text>
          </View>
          <Text className="text-gray-900 font-medium">
            {claim.customer?.name || claim.customerCompanyName || 'Ikke angitt'}
          </Text>
          {claim.customerContactName && (
            <Text className="text-gray-500 text-sm mt-1">
              Kontakt: {claim.customerContactName}
            </Text>
          )}
        </View>

        {/* Supplier */}
        <View className="bg-white rounded-xl p-4 mb-4">
          <View className="flex-row items-center mb-3">
            <User size={20} color="#003366" />
            <Text className="ml-2 text-lg font-semibold text-gray-900">
              Leverandør
            </Text>
          </View>
          <Text className="text-gray-900 font-medium">
            {claim.supplier?.name || 'Ikke angitt'}
          </Text>
        </View>

        {/* Description */}
        {claim.problemDescription && (
          <View className="bg-white rounded-xl p-4 mb-4">
            <View className="flex-row items-center mb-3">
              <FileText size={20} color="#003366" />
              <Text className="ml-2 text-lg font-semibold text-gray-900">
                Beskrivelse
              </Text>
            </View>
            <Text className="text-gray-700">
              {claim.problemDescription}
            </Text>
          </View>
        )}

        {/* Dates */}
        <View className="bg-white rounded-xl p-4 mb-4">
          <View className="flex-row items-center mb-3">
            <Calendar size={20} color="#003366" />
            <Text className="ml-2 text-lg font-semibold text-gray-900">
              Datoer
            </Text>
          </View>
          <View className="flex-row justify-between">
            <View>
              <Text className="text-gray-500 text-xs">Opprettet</Text>
              <Text className="text-gray-900">{formatDate(claim.createdAt)}</Text>
            </View>
            <View>
              <Text className="text-gray-500 text-xs">Kjøpsdato</Text>
              <Text className="text-gray-900">{formatDate(claim.purchaseDate)}</Text>
            </View>
          </View>
        </View>

        {/* Timeline */}
        {claim.timeline && claim.timeline.length > 0 && (
          <View className="bg-white rounded-xl p-4 mb-4">
            <View className="flex-row items-center mb-3">
              <MessageSquare size={20} color="#003366" />
              <Text className="ml-2 text-lg font-semibold text-gray-900">
                Historikk
              </Text>
            </View>
            {claim.timeline.map((entry, index) => (
              <View 
                key={entry.id} 
                className={`pl-4 border-l-2 border-gray-200 ${
                  index < claim.timeline.length - 1 ? 'pb-4' : ''
                }`}
              >
                <Text className="text-gray-900 font-medium">
                  {entry.description}
                </Text>
                <Text className="text-gray-500 text-xs mt-1">
                  {formatDate(entry.createdAt)}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Attachments */}
        {claim.attachments && claim.attachments.length > 0 && (
          <View className="bg-white rounded-xl p-4 mb-4">
            <View className="flex-row items-center mb-3">
              <Paperclip size={20} color="#003366" />
              <Text className="ml-2 text-lg font-semibold text-gray-900">
                Vedlegg ({claim.attachments.length})
              </Text>
            </View>
            {/* TODO: Attachment list */}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
```

---

## Route Files

### apps/mobile/app/(dashboard)/claims/index.tsx

```tsx
import { ClaimsListScreen } from '../../../src/features/claims/screens/ClaimsListScreen';

export default function ClaimsPage() {
  return <ClaimsListScreen />;
}
```

---

### apps/mobile/app/(dashboard)/claims/[id].tsx

```tsx
import { ClaimDetailScreen } from '../../../src/features/claims/screens/ClaimDetailScreen';

export default function ClaimDetailPage() {
  return <ClaimDetailScreen />;
}
```

---

## Test

```bash
# API
pnpm --filter @myhrvold/api dev

# Mobile (web)
pnpm --filter @myhrvold/mobile dev:web
```

---

## Sjekkliste

- [ ] Dashboard layout med tabs
- [ ] ClaimStatusBadge komponent
- [ ] ClaimStats komponent
- [ ] ClaimCard komponent
- [ ] ClaimsListScreen med search
- [ ] ClaimDetailScreen med all info
- [ ] Route files for claims
- [ ] Pull-to-refresh
- [ ] Error handling

---

## Neste faser

- **FASE 13**: Claims Wizard (5-trinns opprettelse)
- **FASE 14**: Leverandørportal
- **FASE 15**: PDF-generering
- **FASE 16**: Offline-støtte
