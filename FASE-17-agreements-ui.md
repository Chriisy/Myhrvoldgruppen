# FASE 17: Vedlikeholdsavtaler UI

> Fase 1-16 må være fullført.
> Estimert tid: ~60 minutter.

## Mål

Bygg brukergrensesnitt for vedlikeholdsavtaler og storkjøkkenavtaler.

---

## Mappestruktur

```
apps/mobile/
├── app/(dashboard)/
│   └── agreements/
│       ├── index.tsx              # Liste
│       ├── [id].tsx               # Detaljer
│       └── new.tsx                # Ny avtale
└── src/features/agreements/
    ├── components/
    │   ├── AgreementCard.tsx
    │   ├── AgreementStatusBadge.tsx
    │   ├── AgreementStats.tsx
    │   └── VisitSchedule.tsx
    └── screens/
        ├── AgreementsListScreen.tsx
        └── AgreementDetailScreen.tsx
```

---

## Backend: Agreements Router

### apps/api/src/modules/agreements/agreements.router.ts

```typescript
import { z } from 'zod';
import { router, protectedProcedure } from '../../trpc/trpc';
import { AgreementsService } from './agreements.service';

export const agreementsRouter = router({
  // Liste alle avtaler
  list: protectedProcedure
    .input(z.object({
      type: z.enum(['maintenance', 'storkjokken']).optional(),
      status: z.string().optional(),
      customerId: z.string().uuid().optional(),
      search: z.string().optional(),
      page: z.number().default(1),
      limit: z.number().default(20),
    }))
    .query(async ({ ctx, input }) => {
      const service = new AgreementsService(ctx.db, ctx.log);
      return service.list(input);
    }),

  // Hent én avtale
  byId: protectedProcedure
    .input(z.object({ 
      id: z.string().uuid(),
      type: z.enum(['maintenance', 'storkjokken']),
    }))
    .query(async ({ ctx, input }) => {
      const service = new AgreementsService(ctx.db, ctx.log);
      return service.getById(input.id, input.type);
    }),

  // Kommende besøk
  upcomingVisits: protectedProcedure
    .input(z.object({
      days: z.number().default(30),
      technicianId: z.string().uuid().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const service = new AgreementsService(ctx.db, ctx.log);
      return service.getUpcomingVisits(input.days, input.technicianId);
    }),

  // Statistikk
  stats: protectedProcedure
    .query(async ({ ctx }) => {
      const service = new AgreementsService(ctx.db, ctx.log);
      return service.getStats();
    }),

  // Utløpende avtaler
  expiring: protectedProcedure
    .input(z.object({ days: z.number().default(60) }))
    .query(async ({ ctx, input }) => {
      const service = new AgreementsService(ctx.db, ctx.log);
      return service.getExpiringAgreements(input.days);
    }),
});

export type AgreementsRouter = typeof agreementsRouter;
```

---

## Components

### src/features/agreements/components/AgreementStatusBadge.tsx

```tsx
import { View, Text } from 'react-native';

const STATUS_CONFIG = {
  active: { bg: 'bg-green-100', text: 'text-green-700', label: 'Aktiv' },
  pending: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Venter' },
  expired: { bg: 'bg-red-100', text: 'text-red-700', label: 'Utløpt' },
  cancelled: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Kansellert' },
  renewal_pending: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Fornyes' },
} as const;

interface AgreementStatusBadgeProps {
  status: keyof typeof STATUS_CONFIG;
}

export function AgreementStatusBadge({ status }: AgreementStatusBadgeProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;

  return (
    <View className={`px-2 py-1 rounded-full ${config.bg}`}>
      <Text className={`text-xs font-medium ${config.text}`}>
        {config.label}
      </Text>
    </View>
  );
}
```

---

### src/features/agreements/components/AgreementCard.tsx

```tsx
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronRight, Calendar, MapPin, Wrench } from 'lucide-react-native';
import { AgreementStatusBadge } from './AgreementStatusBadge';

interface Agreement {
  id: string;
  agreementNumber: string;
  type: 'maintenance' | 'storkjokken';
  status: string;
  customer: { name: string; city?: string };
  visitsPerYear: number;
  nextServiceDate?: Date;
  validTo?: Date;
}

interface AgreementCardProps {
  agreement: Agreement;
}

export function AgreementCard({ agreement }: AgreementCardProps) {
  const router = useRouter();

  const formatDate = (date: Date | undefined) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('nb-NO', {
      day: '2-digit',
      month: 'short',
    });
  };

  const getDaysUntil = (date: Date | undefined) => {
    if (!date) return null;
    const now = new Date();
    const diff = new Date(date).getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const nextVisitDays = getDaysUntil(agreement.nextServiceDate);

  return (
    <Pressable
      onPress={() => router.push(`/agreements/${agreement.id}?type=${agreement.type}`)}
      className="bg-white p-4 rounded-xl shadow-sm mb-3 border border-gray-100 active:bg-gray-50"
    >
      <View className="flex-row items-start justify-between">
        <View className="flex-1">
          {/* Agreement number & status */}
          <View className="flex-row items-center gap-2 mb-2">
            <Text className="text-primary font-bold">
              {agreement.agreementNumber}
            </Text>
            <AgreementStatusBadge status={agreement.status as any} />
            <View className={`px-2 py-0.5 rounded ${
              agreement.type === 'storkjokken' ? 'bg-purple-100' : 'bg-blue-100'
            }`}>
              <Text className={`text-xs ${
                agreement.type === 'storkjokken' ? 'text-purple-700' : 'text-blue-700'
              }`}>
                {agreement.type === 'storkjokken' ? 'Storkjøkken' : 'Dagligvare'}
              </Text>
            </View>
          </View>

          {/* Customer */}
          <Text className="text-gray-900 font-medium" numberOfLines={1}>
            {agreement.customer?.name}
          </Text>

          {/* Location */}
          {agreement.customer?.city && (
            <View className="flex-row items-center mt-1">
              <MapPin size={12} color="#6b7280" />
              <Text className="text-gray-500 text-sm ml-1">
                {agreement.customer.city}
              </Text>
            </View>
          )}

          {/* Info row */}
          <View className="flex-row items-center mt-3 gap-4">
            <View className="flex-row items-center">
              <Wrench size={12} color="#6b7280" />
              <Text className="text-xs text-gray-500 ml-1">
                {agreement.visitsPerYear} besøk/år
              </Text>
            </View>
            
            {agreement.nextServiceDate && (
              <View className="flex-row items-center">
                <Calendar size={12} color={nextVisitDays && nextVisitDays < 7 ? '#f59e0b' : '#6b7280'} />
                <Text className={`text-xs ml-1 ${
                  nextVisitDays && nextVisitDays < 7 ? 'text-yellow-600 font-medium' : 'text-gray-500'
                }`}>
                  {nextVisitDays !== null && nextVisitDays <= 0 
                    ? 'Forfalt' 
                    : `Om ${nextVisitDays} dager`
                  }
                </Text>
              </View>
            )}
          </View>
        </View>

        <ChevronRight size={20} color="#9ca3af" />
      </View>
    </Pressable>
  );
}
```

---

### src/features/agreements/components/AgreementStats.tsx

```tsx
import { View, Text } from 'react-native';
import { FileCheck, Clock, AlertTriangle, Calendar } from 'lucide-react-native';

interface AgreementStatsProps {
  stats: {
    active: number;
    expiringSoon: number;
    pendingVisits: number;
    totalValue: number;
  };
}

export function AgreementStats({ stats }: AgreementStatsProps) {
  const items = [
    {
      label: 'Aktive avtaler',
      value: stats.active,
      icon: FileCheck,
      color: '#22c55e',
      bg: 'bg-green-50',
    },
    {
      label: 'Utløper snart',
      value: stats.expiringSoon,
      icon: AlertTriangle,
      color: '#f59e0b',
      bg: 'bg-yellow-50',
    },
    {
      label: 'Ventende besøk',
      value: stats.pendingVisits,
      icon: Clock,
      color: '#3b82f6',
      bg: 'bg-blue-50',
    },
    {
      label: 'Årlig verdi',
      value: `${(stats.totalValue / 1000).toFixed(0)}k`,
      icon: Calendar,
      color: '#8b5cf6',
      bg: 'bg-purple-50',
    },
  ];

  return (
    <View className="flex-row flex-wrap gap-2 mb-4">
      {items.map((item) => (
        <View key={item.label} className={`flex-1 min-w-[45%] p-3 rounded-lg ${item.bg}`}>
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

### src/features/agreements/components/VisitSchedule.tsx

```tsx
import { View, Text, FlatList } from 'react-native';
import { Calendar, Clock, User } from 'lucide-react-native';

interface Visit {
  id: string;
  scheduledDate: Date;
  estimatedDuration: number;
  technician?: { firstName: string; lastName: string };
  status: string;
}

interface VisitScheduleProps {
  visits: Visit[];
}

export function VisitSchedule({ visits }: VisitScheduleProps) {
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('nb-NO', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled':
        return 'bg-blue-100 text-blue-700';
      case 'completed':
        return 'bg-green-100 text-green-700';
      case 'cancelled':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  if (visits.length === 0) {
    return (
      <View className="bg-gray-50 rounded-lg p-6 items-center">
        <Calendar size={32} color="#9ca3af" />
        <Text className="text-gray-500 mt-2">Ingen planlagte besøk</Text>
      </View>
    );
  }

  return (
    <View className="gap-2">
      {visits.map((visit) => (
        <View 
          key={visit.id}
          className="bg-white border border-gray-100 rounded-lg p-3 flex-row items-center"
        >
          <View className="w-12 h-12 bg-primary/10 rounded-lg items-center justify-center">
            <Text className="text-primary font-bold text-lg">
              {new Date(visit.scheduledDate).getDate()}
            </Text>
            <Text className="text-primary text-xs">
              {new Date(visit.scheduledDate).toLocaleDateString('nb-NO', { month: 'short' })}
            </Text>
          </View>
          
          <View className="flex-1 ml-3">
            <View className="flex-row items-center gap-2">
              <Clock size={12} color="#6b7280" />
              <Text className="text-gray-600 text-sm">
                {visit.estimatedDuration} min
              </Text>
            </View>
            
            {visit.technician && (
              <View className="flex-row items-center gap-2 mt-1">
                <User size={12} color="#6b7280" />
                <Text className="text-gray-600 text-sm">
                  {visit.technician.firstName} {visit.technician.lastName}
                </Text>
              </View>
            )}
          </View>

          <View className={`px-2 py-1 rounded ${getStatusColor(visit.status)}`}>
            <Text className="text-xs font-medium">
              {visit.status === 'scheduled' ? 'Planlagt' : 
               visit.status === 'completed' ? 'Utført' : 'Kansellert'}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}
```

---

## Screens

### src/features/agreements/screens/AgreementsListScreen.tsx

```tsx
import { useState } from 'react';
import { View, Text, FlatList, RefreshControl, TextInput, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { trpc } from '../../../lib/api';
import { AgreementCard } from '../components/AgreementCard';
import { AgreementStats } from '../components/AgreementStats';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { ErrorView } from '../../../components/ErrorView';
import { Search, Plus, Filter, Calendar, AlertTriangle } from 'lucide-react-native';

type AgreementType = 'maintenance' | 'storkjokken' | undefined;

export function AgreementsListScreen() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<AgreementType>(undefined);
  const [showExpiring, setShowExpiring] = useState(false);

  const { data: agreements, isLoading, error, refetch, isRefetching } = 
    trpc.agreements.list.useQuery({
      type: typeFilter,
      search: search || undefined,
      page: 1,
      limit: 50,
    });

  const { data: stats } = trpc.agreements.stats.useQuery();
  
  const { data: expiringAgreements } = trpc.agreements.expiring.useQuery(
    { days: 60 },
    { enabled: showExpiring }
  );

  if (isLoading) return <LoadingScreen />;
  if (error) return <ErrorView error={error} onRetry={refetch} />;

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-primary pt-12 pb-6 px-4">
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-white text-2xl font-bold">Avtaler</Text>
          <Pressable
            onPress={() => router.push('/agreements/new')}
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
            className="flex-1 ml-2 text-white"
            placeholder="Søk etter kunde eller avtalenr..."
            placeholderTextColor="rgba(255,255,255,0.5)"
            value={search}
            onChangeText={setSearch}
          />
        </View>

        {/* Type filter */}
        <View className="flex-row gap-2 mt-3">
          <Pressable
            onPress={() => setTypeFilter(undefined)}
            className={`px-3 py-1.5 rounded-lg ${
              !typeFilter ? 'bg-white' : 'bg-white/20'
            }`}
          >
            <Text className={!typeFilter ? 'text-primary font-medium' : 'text-white'}>
              Alle
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setTypeFilter('maintenance')}
            className={`px-3 py-1.5 rounded-lg ${
              typeFilter === 'maintenance' ? 'bg-white' : 'bg-white/20'
            }`}
          >
            <Text className={typeFilter === 'maintenance' ? 'text-primary font-medium' : 'text-white'}>
              Dagligvare
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setTypeFilter('storkjokken')}
            className={`px-3 py-1.5 rounded-lg ${
              typeFilter === 'storkjokken' ? 'bg-white' : 'bg-white/20'
            }`}
          >
            <Text className={typeFilter === 'storkjokken' ? 'text-primary font-medium' : 'text-white'}>
              Storkjøkken
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Expiring warning */}
      {stats && stats.expiringSoon > 0 && (
        <Pressable 
          onPress={() => setShowExpiring(!showExpiring)}
          className="mx-4 mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex-row items-center"
        >
          <AlertTriangle size={20} color="#f59e0b" />
          <Text className="ml-2 text-yellow-700 flex-1">
            {stats.expiringSoon} avtale{stats.expiringSoon > 1 ? 'r' : ''} utløper snart
          </Text>
          <Text className="text-yellow-600 text-sm">
            {showExpiring ? 'Skjul' : 'Vis'}
          </Text>
        </Pressable>
      )}

      {/* Content */}
      <FlatList
        data={showExpiring ? expiringAgreements : agreements}
        renderItem={({ item }) => <AgreementCard agreement={item} />}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16 }}
        ListHeaderComponent={
          !showExpiring && stats ? <AgreementStats stats={stats} /> : null
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
            <Calendar size={48} color="#9ca3af" />
            <Text className="text-gray-500 mt-4">Ingen avtaler funnet</Text>
          </View>
        }
      />
    </View>
  );
}
```

---

## Route Files

### apps/mobile/app/(dashboard)/agreements/index.tsx

```tsx
import { AgreementsListScreen } from '../../../src/features/agreements/screens/AgreementsListScreen';

export default function AgreementsPage() {
  return <AgreementsListScreen />;
}
```

---

### apps/mobile/app/(dashboard)/agreements/[id].tsx

```tsx
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { trpc } from '../../../src/lib/api';
import { LoadingScreen } from '../../../src/components/LoadingScreen';
import { ErrorView } from '../../../src/components/ErrorView';
import { AgreementStatusBadge } from '../../../src/features/agreements/components/AgreementStatusBadge';
import { VisitSchedule } from '../../../src/features/agreements/components/VisitSchedule';
import { 
  ArrowLeft, Building, Calendar, CreditCard, Phone, Mail, MapPin, Wrench 
} from 'lucide-react-native';

export default function AgreementDetailPage() {
  const { id, type } = useLocalSearchParams<{ id: string; type: string }>();
  const router = useRouter();

  const { data: agreement, isLoading, error, refetch } = trpc.agreements.byId.useQuery(
    { id: id!, type: type as 'maintenance' | 'storkjokken' },
    { enabled: !!id && !!type }
  );

  if (isLoading) return <LoadingScreen />;
  if (error) return <ErrorView error={error} onRetry={refetch} />;
  if (!agreement) return <ErrorView error={new Error('Ikke funnet')} />;

  const formatDate = (date: Date | null | undefined) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('nb-NO', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  };

  const formatCurrency = (amount: number | null | undefined) => {
    if (!amount) return '-';
    return new Intl.NumberFormat('nb-NO', {
      style: 'currency',
      currency: 'NOK',
    }).format(amount);
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
              {agreement.agreementNumber}
            </Text>
            <View className="flex-row items-center gap-2 mt-1">
              <AgreementStatusBadge status={agreement.status as any} />
            </View>
          </View>
        </View>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }}>
        {/* Customer */}
        <View className="bg-white rounded-xl p-4 mb-4">
          <View className="flex-row items-center mb-3">
            <Building size={20} color="#003366" />
            <Text className="ml-2 text-lg font-semibold text-gray-900">Kunde</Text>
          </View>
          <Text className="text-gray-900 font-medium text-lg">
            {agreement.customer?.name}
          </Text>
          {agreement.customer?.address && (
            <View className="flex-row items-center mt-2">
              <MapPin size={14} color="#6b7280" />
              <Text className="text-gray-600 ml-1">
                {agreement.customer.address}, {agreement.customer.city}
              </Text>
            </View>
          )}
        </View>

        {/* Service info */}
        <View className="bg-white rounded-xl p-4 mb-4">
          <View className="flex-row items-center mb-3">
            <Wrench size={20} color="#003366" />
            <Text className="ml-2 text-lg font-semibold text-gray-900">Service</Text>
          </View>
          
          <View className="flex-row justify-between mb-2">
            <Text className="text-gray-500">Besøk per år</Text>
            <Text className="text-gray-900 font-medium">{agreement.visitsPerYear}</Text>
          </View>
          <View className="flex-row justify-between mb-2">
            <Text className="text-gray-500">Serviceintervall</Text>
            <Text className="text-gray-900 font-medium">
              {agreement.serviceIntervalMonths} måneder
            </Text>
          </View>
          <View className="flex-row justify-between mb-2">
            <Text className="text-gray-500">Neste service</Text>
            <Text className="text-gray-900 font-medium">
              {formatDate(agreement.nextServiceDate)}
            </Text>
          </View>
        </View>

        {/* Contract dates */}
        <View className="bg-white rounded-xl p-4 mb-4">
          <View className="flex-row items-center mb-3">
            <Calendar size={20} color="#003366" />
            <Text className="ml-2 text-lg font-semibold text-gray-900">Periode</Text>
          </View>
          
          <View className="flex-row justify-between mb-2">
            <Text className="text-gray-500">Gyldig fra</Text>
            <Text className="text-gray-900">{formatDate(agreement.validFrom)}</Text>
          </View>
          <View className="flex-row justify-between mb-2">
            <Text className="text-gray-500">Gyldig til</Text>
            <Text className="text-gray-900">{formatDate(agreement.validTo)}</Text>
          </View>
          <View className="flex-row justify-between">
            <Text className="text-gray-500">Fornyes automatisk</Text>
            <Text className="text-gray-900">
              {agreement.autoRenewal ? 'Ja' : 'Nei'}
            </Text>
          </View>
        </View>

        {/* Pricing */}
        <View className="bg-white rounded-xl p-4 mb-4">
          <View className="flex-row items-center mb-3">
            <CreditCard size={20} color="#003366" />
            <Text className="ml-2 text-lg font-semibold text-gray-900">Priser</Text>
          </View>
          
          <View className="flex-row justify-between mb-2">
            <Text className="text-gray-500">Årspris</Text>
            <Text className="text-gray-900 font-medium">
              {formatCurrency(agreement.pricePerYear)}
            </Text>
          </View>
          {type === 'storkjokken' && agreement.hourlyRate && (
            <>
              <View className="flex-row justify-between mb-2">
                <Text className="text-gray-500">Timepris</Text>
                <Text className="text-gray-900">{formatCurrency(agreement.hourlyRate)}</Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-gray-500">Timepris kjøl</Text>
                <Text className="text-gray-900">{formatCurrency(agreement.hourlyRateCooling)}</Text>
              </View>
            </>
          )}
        </View>

        {/* Upcoming visits */}
        <View className="bg-white rounded-xl p-4 mb-4">
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-row items-center">
              <Calendar size={20} color="#003366" />
              <Text className="ml-2 text-lg font-semibold text-gray-900">
                Planlagte besøk
              </Text>
            </View>
            <Pressable className="bg-primary/10 px-3 py-1 rounded-lg">
              <Text className="text-primary text-sm font-medium">+ Planlegg</Text>
            </Pressable>
          </View>
          
          <VisitSchedule visits={agreement.plannedVisits || []} />
        </View>
      </ScrollView>
    </View>
  );
}
```

---

## Update Tab Layout

### apps/mobile/app/(dashboard)/_layout.tsx

```tsx
import { Tabs } from 'expo-router';
import { Home, FileText, Calendar, User } from 'lucide-react-native';

export default function DashboardLayout() {
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
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Hjem',
          tabBarIcon: ({ color, size }) => <Home size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="claims"
        options={{
          title: 'Reklamasjoner',
          tabBarIcon: ({ color, size }) => <FileText size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="agreements"
        options={{
          title: 'Avtaler',
          tabBarIcon: ({ color, size }) => <Calendar size={size} color={color} />,
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

## Sjekkliste

- [ ] agreements.router.ts med CRUD
- [ ] AgreementStatusBadge komponent
- [ ] AgreementCard komponent
- [ ] AgreementStats komponent
- [ ] VisitSchedule komponent
- [ ] AgreementsListScreen med filter
- [ ] AgreementDetailScreen
- [ ] Tab-navigasjon oppdatert
- [ ] Utløpende avtaler-varsling

---

## Neste fase

Gå til **FASE 18: Servicebesøk UI** for tekniker-app.
