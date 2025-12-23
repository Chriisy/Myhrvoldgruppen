# FASE 16: Vedlikeholdsavtaler UI

> Les CLAUDE.md først. Fase 13-15 må være fullført.
> Denne fasen tar ~60-90 minutter.

## Mål

Bygg UI for vedlikeholdsavtaler - både dagligvare (enkel) og storkjøkken (komplett).

---

## Oversikt fra screenshots

Basert på bildene (screenshot 4 og 13) skal vi bygge:

```
┌─────────────────────────────────────────────────────────────────┐
│  VEDLIKEHOLDSAVTALER - Dagligvare                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐               │
│  │  117    │ │   35    │ │   15    │ │   55    │               │
│  │ Totalt  │ │ Aktive  │ │ Service │ │ Forfalt │               │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘               │
│                                                                  │
│  [Kalender med service-oversikt per måned]                      │
│                                                                  │
│  Filter: [Alle] [Aktive] [Service snart] [Forfalt] [Utløpt]    │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Meny Stavern                              Forfalt       │   │
│  │  Neste service: 11.11.2021  (rød: over 6 mnd)           │   │
│  │  Avtaleperiode: 11.12.2025 - 11.12.2026                  │   │
│  │  [Rediger avtale]                                        │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Del 1: Backend - API Routers

### Maintenance Agreements Router

Fil: `apps/api/src/trpc/routers/agreements.ts`

```typescript
import { router, protectedProcedure } from '../trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { eq, and, isNull, desc, gte, lte, or, like, sql } from 'drizzle-orm';
import { 
  maintenanceAgreements, 
  storkjokkenAgreements,
  customers,
  departments 
} from '@myhrvold/db/schema';

// Input schemas
const agreementFiltersSchema = z.object({
  status: z.enum(['all', 'active', 'service_soon', 'overdue', 'expired']).default('all'),
  departmentId: z.string().uuid().optional(),
  search: z.string().optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
});

const createAgreementSchema = z.object({
  customerId: z.string().uuid().optional(),
  customerName: z.string().min(1),
  customerNumber: z.string().optional(),
  departmentId: z.string().uuid().optional(),
  
  deliveryAddress: z.string().optional(),
  deliveryPostcode: z.string().optional(),
  deliveryCity: z.string().optional(),
  
  contactPerson: z.string().optional(),
  contactPhone: z.string().optional(),
  contactEmail: z.string().email().optional(),
  
  visitsPerYear: z.number().min(1).max(12).default(1),
  pricePerYear: z.number().optional(),
  hourlyRate: z.number().optional(),
  
  validFrom: z.string().datetime(),
  validTo: z.string().datetime(),
  
  // Service typer (checkboxes)
  serviceTypes: z.object({
    storgekjole: z.boolean().default(false),
    vedlikeholdsavtale: z.boolean().default(false),
    slitevedlikehold: z.boolean().default(false),
  }).optional(),
  
  notes: z.string().optional(),
});

export const agreementsRouter = router({
  // ============ DAGLIGVARE AVTALER ============
  
  // Liste med statistikk
  listMaintenance: protectedProcedure
    .input(agreementFiltersSchema)
    .query(async ({ ctx, input }) => {
      const { status, departmentId, search, page, limit } = input;
      const now = new Date();
      
      let conditions = [isNull(maintenanceAgreements.deletedAt)];
      
      if (departmentId) {
        conditions.push(eq(maintenanceAgreements.departmentId, departmentId));
      }
      
      if (search) {
        conditions.push(
          or(
            like(maintenanceAgreements.customerName, `%${search}%`),
            like(maintenanceAgreements.agreementNumber, `%${search}%`)
          )
        );
      }
      
      // Status filter
      const sixMonthsAgo = new Date(now);
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      
      const threeMonthsFromNow = new Date(now);
      threeMonthsFromNow.setMonth(threeMonthsFromNow.getMonth() + 3);
      
      // Hent avtaler
      const agreements = await ctx.db.query.maintenanceAgreements.findMany({
        where: and(...conditions),
        orderBy: desc(maintenanceAgreements.createdAt),
        limit,
        offset: (page - 1) * limit,
        with: {
          customer: true,
          department: true,
        },
      });
      
      // Beregn statistikk
      const stats = await ctx.db
        .select({
          total: sql<number>`count(*)`,
          active: sql<number>`count(*) filter (where ${maintenanceAgreements.status} = 'active')`,
          expired: sql<number>`count(*) filter (where ${maintenanceAgreements.validTo} < ${now})`,
        })
        .from(maintenanceAgreements)
        .where(isNull(maintenanceAgreements.deletedAt));
      
      return {
        agreements,
        stats: stats[0] || { total: 0, active: 0, expired: 0 },
        page,
        limit,
      };
    }),

  // Hent én avtale
  getMaintenanceById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const agreement = await ctx.db.query.maintenanceAgreements.findFirst({
        where: and(
          eq(maintenanceAgreements.id, input.id),
          isNull(maintenanceAgreements.deletedAt)
        ),
        with: {
          customer: true,
          department: true,
          createdBy: true,
        },
      });
      
      if (!agreement) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }
      
      return agreement;
    }),

  // Opprett avtale
  createMaintenance: protectedProcedure
    .input(createAgreementSchema)
    .mutation(async ({ ctx, input }) => {
      // Generer avtalenummer
      const agreementNumber = await generateAgreementNumber(ctx.db, 'DA');
      
      const [agreement] = await ctx.db.insert(maintenanceAgreements).values({
        agreementNumber,
        ...input,
        validFrom: new Date(input.validFrom),
        validTo: new Date(input.validTo),
        status: 'active',
        createdById: ctx.user.id,
      }).returning();
      
      ctx.log.info({ agreementId: agreement.id }, 'Maintenance agreement created');
      
      return agreement;
    }),

  // Oppdater avtale
  updateMaintenance: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      data: createAgreementSchema.partial(),
    }))
    .mutation(async ({ ctx, input }) => {
      const updateData = { ...input.data };
      
      if (updateData.validFrom) {
        updateData.validFrom = new Date(updateData.validFrom) as any;
      }
      if (updateData.validTo) {
        updateData.validTo = new Date(updateData.validTo) as any;
      }
      
      const [updated] = await ctx.db
        .update(maintenanceAgreements)
        .set({ ...updateData, updatedAt: new Date() })
        .where(eq(maintenanceAgreements.id, input.id))
        .returning();
      
      return updated;
    }),

  // Kalender-data: Service per måned
  getServiceCalendar: protectedProcedure
    .input(z.object({
      year: z.number(),
      departmentId: z.string().uuid().optional(),
    }))
    .query(async ({ ctx, input }) => {
      // Hent alle aktive avtaler
      const conditions = [
        isNull(maintenanceAgreements.deletedAt),
        eq(maintenanceAgreements.status, 'active'),
      ];
      
      if (input.departmentId) {
        conditions.push(eq(maintenanceAgreements.departmentId, input.departmentId));
      }
      
      const agreements = await ctx.db.query.maintenanceAgreements.findMany({
        where: and(...conditions),
      });
      
      // Grupper per måned basert på visitsPerYear
      const calendar: Record<number, number> = {};
      for (let month = 1; month <= 12; month++) {
        calendar[month] = 0;
      }
      
      // Enkel fordeling: Spre besøk jevnt utover året
      agreements.forEach(a => {
        const visits = a.visitsPerYear || 1;
        const interval = Math.floor(12 / visits);
        for (let i = 0; i < visits; i++) {
          const month = ((i * interval) % 12) + 1;
          calendar[month]++;
        }
      });
      
      return calendar;
    }),

  // ============ STORKJØKKEN AVTALER ============
  
  listStorkjokken: protectedProcedure
    .input(agreementFiltersSchema)
    .query(async ({ ctx, input }) => {
      const { search, page, limit } = input;
      
      let conditions = [isNull(storkjokkenAgreements.deletedAt)];
      
      if (search) {
        conditions.push(
          or(
            like(storkjokkenAgreements.customerName, `%${search}%`),
            like(storkjokkenAgreements.agreementNumber, `%${search}%`)
          )
        );
      }
      
      const agreements = await ctx.db.query.storkjokkenAgreements.findMany({
        where: and(...conditions),
        orderBy: desc(storkjokkenAgreements.createdAt),
        limit,
        offset: (page - 1) * limit,
        with: {
          customer: true,
          department: true,
        },
      });
      
      const total = await ctx.db
        .select({ count: sql<number>`count(*)` })
        .from(storkjokkenAgreements)
        .where(isNull(storkjokkenAgreements.deletedAt));
      
      return {
        agreements,
        total: total[0]?.count || 0,
        page,
        limit,
      };
    }),
});

// Hjelpefunksjon
async function generateAgreementNumber(db: any, prefix: string): Promise<string> {
  const year = new Date().getFullYear().toString().slice(-2);
  
  // Finn neste løpenummer
  const last = await db.query.maintenanceAgreements.findFirst({
    where: like(maintenanceAgreements.agreementNumber, `${prefix}-${year}%`),
    orderBy: desc(maintenanceAgreements.agreementNumber),
  });
  
  let seq = 1;
  if (last) {
    const lastSeq = parseInt(last.agreementNumber.split('-')[2], 10);
    seq = lastSeq + 1;
  }
  
  return `${prefix}-${year}-${seq.toString().padStart(4, '0')}`;
}
```

---

## Del 2: Frontend - Liste og Kort

### Agreements List Screen

Fil: `apps/mobile/features/agreements/screens/AgreementsListScreen.tsx`

```tsx
import { View, Text, FlatList, Pressable, RefreshControl } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { trpc } from '../../../lib/api';
import { AgreementCard } from '../components/AgreementCard';
import { StatsCards } from '../components/StatsCards';
import { ServiceCalendar } from '../components/ServiceCalendar';
import { Plus, Filter } from 'lucide-react-native';

type StatusFilter = 'all' | 'active' | 'service_soon' | 'overdue' | 'expired';

export function AgreementsListScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  
  const { 
    data, 
    isLoading, 
    refetch 
  } = trpc.agreements.listMaintenance.useQuery({
    status: statusFilter,
    page: 1,
    limit: 50,
  });
  
  const { data: calendar } = trpc.agreements.getServiceCalendar.useQuery({
    year: new Date().getFullYear(),
  });
  
  const filters: { key: StatusFilter; label: string; color: string }[] = [
    { key: 'all', label: 'Alle', color: 'bg-gray-100' },
    { key: 'active', label: 'Aktive', color: 'bg-green-100' },
    { key: 'service_soon', label: 'Service snart', color: 'bg-yellow-100' },
    { key: 'overdue', label: 'Forfalt', color: 'bg-red-100' },
    { key: 'expired', label: 'Utløpt', color: 'bg-gray-100' },
  ];
  
  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-gradient-to-r from-primary to-primary/90 p-4 pb-6">
        <View className="flex-row items-center justify-between mb-4">
          <View>
            <Text className="text-white/80 text-sm">Vedlikeholdsavtaler</Text>
            <Text className="text-white text-2xl font-bold">Dagligvare</Text>
          </View>
          <Pressable
            onPress={() => router.push('/agreements/new')}
            className="bg-accent px-4 py-2 rounded-lg flex-row items-center"
          >
            <Plus size={20} color="white" />
            <Text className="text-white ml-1 font-medium">Ny Avtale</Text>
          </Pressable>
        </View>
        
        {/* Stats */}
        {data?.stats && (
          <StatsCards stats={data.stats} />
        )}
      </View>
      
      {/* Kalender */}
      {calendar && (
        <ServiceCalendar data={calendar} />
      )}
      
      {/* Filter chips */}
      <View className="px-4 py-3">
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={filters}
          keyExtractor={(item) => item.key}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => setStatusFilter(item.key)}
              className={`px-4 py-2 rounded-full mr-2 ${
                statusFilter === item.key 
                  ? 'bg-accent' 
                  : item.color
              }`}
            >
              <Text className={
                statusFilter === item.key 
                  ? 'text-white font-medium' 
                  : 'text-gray-700'
              }>
                {item.label}
              </Text>
            </Pressable>
          )}
        />
      </View>
      
      {/* Liste */}
      <FlatList
        data={data?.agreements}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <AgreementCard 
            agreement={item}
            onPress={() => router.push(`/agreements/${item.id}`)}
          />
        )}
        contentContainerClassName="p-4"
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refetch} />
        }
        ListEmptyComponent={
          <View className="py-12 items-center">
            <Text className="text-gray-500">Ingen avtaler funnet</Text>
          </View>
        }
      />
    </View>
  );
}
```

### Agreement Card Component

Fil: `apps/mobile/features/agreements/components/AgreementCard.tsx`

```tsx
import { View, Text, Pressable } from 'react-native';
import { Building2, Calendar, AlertCircle, Check } from 'lucide-react-native';

interface Props {
  agreement: {
    id: string;
    agreementNumber: string;
    customerName: string | null;
    status: string;
    validFrom: Date | null;
    validTo: Date | null;
    visitsPerYear: number | null;
    // Computed
    nextServiceDate?: Date | null;
  };
  onPress: () => void;
}

export function AgreementCard({ agreement, onPress }: Props) {
  const isOverdue = agreement.nextServiceDate && 
    new Date(agreement.nextServiceDate) < new Date();
  
  const isExpired = agreement.validTo && 
    new Date(agreement.validTo) < new Date();
  
  const getStatusBadge = () => {
    if (isExpired) {
      return { label: 'Utløpt', color: 'bg-gray-500' };
    }
    if (isOverdue) {
      return { label: 'Forfalt', color: 'bg-red-500' };
    }
    return { label: 'Aktiv', color: 'bg-green-500' };
  };
  
  const status = getStatusBadge();
  
  const formatDate = (date: Date | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('nb-NO');
  };
  
  return (
    <Pressable
      onPress={onPress}
      className="bg-white rounded-xl p-4 mb-3 shadow-sm border border-gray-100"
    >
      <View className="flex-row items-start justify-between mb-2">
        <View className="flex-row items-center flex-1">
          <View className="w-10 h-10 bg-primary/10 rounded-full items-center justify-center mr-3">
            <Building2 size={20} color="#003366" />
          </View>
          <View className="flex-1">
            <Text className="text-gray-500 text-xs">
              {agreement.agreementNumber}
            </Text>
            <Text className="font-semibold text-gray-900" numberOfLines={1}>
              {agreement.customerName || 'Uten kunde'}
            </Text>
          </View>
        </View>
        
        <View className={`px-2 py-1 rounded-full ${status.color}`}>
          <Text className="text-white text-xs font-medium">
            {status.label}
          </Text>
        </View>
      </View>
      
      {/* Service info */}
      <View className="flex-row items-center mt-2">
        <Calendar size={14} color="#666" />
        <Text className={`text-sm ml-1 ${isOverdue ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
          Neste service: {formatDate(agreement.nextServiceDate)}
          {isOverdue && ' (forfalt)'}
        </Text>
      </View>
      
      {/* Avtaleperiode */}
      <View className="flex-row items-center mt-1">
        <Check size={14} color="#666" />
        <Text className="text-gray-500 text-sm ml-1">
          {formatDate(agreement.validFrom)} - {formatDate(agreement.validTo)}
        </Text>
      </View>
      
      {/* Action */}
      <View className="mt-3 pt-3 border-t border-gray-100">
        <Pressable className="bg-gray-50 py-2 rounded-lg">
          <Text className="text-center text-gray-600 font-medium">
            Rediger avtale
          </Text>
        </Pressable>
      </View>
    </Pressable>
  );
}
```

### Stats Cards Component

Fil: `apps/mobile/features/agreements/components/StatsCards.tsx`

```tsx
import { View, Text } from 'react-native';
import { FileText, CheckCircle, Clock, AlertTriangle } from 'lucide-react-native';

interface Props {
  stats: {
    total: number;
    active: number;
    serviceSoon?: number;
    overdue?: number;
    expired: number;
  };
}

export function StatsCards({ stats }: Props) {
  const cards = [
    { 
      label: 'Totalt', 
      value: stats.total, 
      icon: FileText,
      color: 'bg-white/20' 
    },
    { 
      label: 'Aktive', 
      value: stats.active, 
      icon: CheckCircle,
      color: 'bg-green-500/20' 
    },
    { 
      label: 'Service snart', 
      value: stats.serviceSoon || 0, 
      icon: Clock,
      color: 'bg-yellow-500/20' 
    },
    { 
      label: 'Forfalt', 
      value: stats.overdue || 0, 
      icon: AlertTriangle,
      color: 'bg-red-500/20' 
    },
  ];
  
  return (
    <View className="flex-row gap-2">
      {cards.map((card) => (
        <View 
          key={card.label}
          className={`flex-1 ${card.color} rounded-lg p-3`}
        >
          <card.icon size={20} color="white" />
          <Text className="text-white text-2xl font-bold mt-1">
            {card.value}
          </Text>
          <Text className="text-white/80 text-xs">
            {card.label}
          </Text>
        </View>
      ))}
    </View>
  );
}
```

### Service Calendar Component

Fil: `apps/mobile/features/agreements/components/ServiceCalendar.tsx`

```tsx
import { View, Text, ScrollView } from 'react-native';

interface Props {
  data: Record<number, number>;
}

const monthNames = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mai', 'Jun',
  'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Des'
];

export function ServiceCalendar({ data }: Props) {
  const currentMonth = new Date().getMonth() + 1;
  
  return (
    <View className="bg-white px-4 py-3 border-b border-gray-200">
      <Text className="text-gray-500 text-xs mb-2">Service per måned</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View className="flex-row gap-2">
          {monthNames.map((name, index) => {
            const month = index + 1;
            const count = data[month] || 0;
            const isCurrentMonth = month === currentMonth;
            
            return (
              <View 
                key={month}
                className={`items-center px-3 py-2 rounded-lg ${
                  isCurrentMonth ? 'bg-accent/10' : 'bg-gray-50'
                }`}
              >
                <Text className={`text-xs ${
                  isCurrentMonth ? 'text-accent font-medium' : 'text-gray-500'
                }`}>
                  {name}
                </Text>
                <Text className={`text-lg font-bold ${
                  isCurrentMonth ? 'text-accent' : 'text-gray-700'
                }`}>
                  {count}
                </Text>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}
```

---

## Del 3: Redigering Modal

Fil: `apps/mobile/features/agreements/components/EditAgreementModal.tsx`

```tsx
import { View, Text, ScrollView, Pressable, TextInput, Modal } from 'react-native';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { trpc } from '../../../lib/api';
import { X, Save } from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

interface Props {
  agreementId: string | null;
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function EditAgreementModal({ agreementId, visible, onClose, onSaved }: Props) {
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  
  const { data: agreement } = trpc.agreements.getMaintenanceById.useQuery(
    { id: agreementId! },
    { enabled: !!agreementId }
  );
  
  const [formData, setFormData] = useState({
    customerName: '',
    contactPerson: '',
    contactPhone: '',
    contactEmail: '',
    deliveryAddress: '',
    visitsPerYear: 1,
    validFrom: new Date(),
    validTo: new Date(),
  });
  
  useEffect(() => {
    if (agreement) {
      setFormData({
        customerName: agreement.customerName || '',
        contactPerson: agreement.contactPerson || '',
        contactPhone: agreement.contactPhone || '',
        contactEmail: agreement.contactEmail || '',
        deliveryAddress: agreement.deliveryAddress || '',
        visitsPerYear: agreement.visitsPerYear || 1,
        validFrom: agreement.validFrom ? new Date(agreement.validFrom) : new Date(),
        validTo: agreement.validTo ? new Date(agreement.validTo) : new Date(),
      });
    }
  }, [agreement]);
  
  const updateMutation = trpc.agreements.updateMaintenance.useMutation({
    onSuccess: () => {
      utils.agreements.listMaintenance.invalidate();
      onSaved();
      onClose();
    },
  });
  
  const handleSave = () => {
    if (!agreementId) return;
    
    updateMutation.mutate({
      id: agreementId,
      data: {
        ...formData,
        validFrom: formData.validFrom.toISOString(),
        validTo: formData.validTo.toISOString(),
      },
    });
  };
  
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View className="flex-1 bg-white">
        {/* Header */}
        <View className="flex-row items-center justify-between p-4 border-b border-gray-200 bg-primary">
          <Pressable onPress={onClose} className="p-2">
            <X size={24} color="white" />
          </Pressable>
          <Text className="text-white text-lg font-semibold">
            Rediger avtale
          </Text>
          <Pressable 
            onPress={handleSave}
            disabled={updateMutation.isPending}
            className="p-2"
          >
            <Save size={24} color="white" />
          </Pressable>
        </View>
        
        <ScrollView className="flex-1 p-4">
          {/* Tittel/Kunde */}
          <View className="mb-4">
            <Text className="text-gray-700 mb-1 font-medium">Tittel *</Text>
            <TextInput
              className="border border-gray-200 rounded-lg p-3"
              value={formData.customerName}
              onChangeText={(v) => setFormData({...formData, customerName: v})}
              placeholder="F.eks. Meny Stavern"
            />
          </View>
          
          {/* Service-intervall */}
          <View className="mb-4">
            <Text className="text-gray-700 mb-2 font-medium">Service-intervall</Text>
            <View className="flex-row gap-2">
              {[1, 2, 3, 4].map((n) => (
                <Pressable
                  key={n}
                  onPress={() => setFormData({...formData, visitsPerYear: n})}
                  className={`flex-1 py-3 rounded-lg ${
                    formData.visitsPerYear === n 
                      ? 'bg-accent' 
                      : 'bg-gray-100'
                  }`}
                >
                  <Text className={`text-center ${
                    formData.visitsPerYear === n 
                      ? 'text-white font-medium' 
                      : 'text-gray-700'
                  }`}>
                    {n}x
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text className="text-gray-500 text-xs mt-1">
              Antall servicebesøk per år
            </Text>
          </View>
          
          {/* Kontaktperson */}
          <View className="mb-4">
            <Text className="text-gray-700 mb-1 font-medium">Kontaktinformasjon</Text>
            <TextInput
              className="border border-gray-200 rounded-lg p-3 mb-2"
              value={formData.contactPerson}
              onChangeText={(v) => setFormData({...formData, contactPerson: v})}
              placeholder="Kontaktperson"
            />
            <View className="flex-row gap-2">
              <TextInput
                className="flex-1 border border-gray-200 rounded-lg p-3"
                value={formData.contactPhone}
                onChangeText={(v) => setFormData({...formData, contactPhone: v})}
                placeholder="Telefon"
                keyboardType="phone-pad"
              />
              <TextInput
                className="flex-1 border border-gray-200 rounded-lg p-3"
                value={formData.contactEmail}
                onChangeText={(v) => setFormData({...formData, contactEmail: v})}
                placeholder="E-post"
                keyboardType="email-address"
              />
            </View>
          </View>
          
          {/* Kontraktsperiode */}
          <View className="mb-4">
            <Text className="text-gray-700 mb-2 font-medium">Kontraktsperiode</Text>
            <View className="flex-row gap-2">
              <View className="flex-1">
                <Text className="text-gray-500 text-xs mb-1">Fra</Text>
                <View className="border border-gray-200 rounded-lg p-3">
                  <Text>
                    {formData.validFrom.toLocaleDateString('nb-NO')}
                  </Text>
                </View>
              </View>
              <View className="flex-1">
                <Text className="text-gray-500 text-xs mb-1">Til</Text>
                <View className="border border-gray-200 rounded-lg p-3">
                  <Text>
                    {formData.validTo.toLocaleDateString('nb-NO')}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </ScrollView>
        
        {/* Save button */}
        <View className="p-4 border-t border-gray-200">
          <Pressable
            onPress={handleSave}
            disabled={updateMutation.isPending}
            className={`py-4 rounded-xl ${
              updateMutation.isPending ? 'bg-gray-400' : 'bg-accent'
            }`}
          >
            <Text className="text-white text-center font-semibold text-lg">
              {updateMutation.isPending ? 'Lagrer...' : 'Lagre avtale'}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
```

---

## Del 4: Routing

Fil: `apps/mobile/app/(dashboard)/agreements/index.tsx`

```tsx
import { AgreementsListScreen } from '../../../features/agreements/screens/AgreementsListScreen';

export default function AgreementsPage() {
  return <AgreementsListScreen />;
}
```

---

## Test

```bash
pnpm --filter @myhrvold/api dev
pnpm --filter mobile dev -- --web
```

1. Gå til `/agreements`
2. Verifiser statistikk-kort
3. Test filter-knappene
4. Åpne en avtale
5. Test redigering
6. Opprett ny avtale

---

## Sjekkliste

- [ ] Backend router med list, get, create, update
- [ ] Statistikk-kort viser riktige tall
- [ ] Service-kalender viser besøk per måned
- [ ] Filter-knapper fungerer
- [ ] Avtale-kort viser riktig status
- [ ] "Forfalt" vises rødt
- [ ] Redigering-modal fungerer
- [ ] Ny avtale kan opprettes
- [ ] Data lagres korrekt
- [ ] Norske oversettelser
