# FASE 17: Planlagte besøk UI

> **Stack**: Expo SDK 54, Expo Router v6, React Native, TypeScript
> **Tid**: ~45-60 minutter

## Mål

Bygg UI for planlagte servicebesøk med kalendervisning og teknikertildeling.

---

## Skjermbilder

```
┌─────────────────────────────────────────────────────────────────┐
│  1. Besøksoversikt                                              │
│     - Statistikk: I dag, Denne uken, Denne måneden, Utført      │
│     - Ukekalender (mandag-søndag)                               │
│     - Filtrer: Tekniker, Avdeling, Status                       │
│     - Besøkskort med kunde, adresse, tid                        │
├─────────────────────────────────────────────────────────────────┤
│  2. Besøksdetaljer                                              │
│     - Avtalenummer og kunde                                     │
│     - Adresse med kartlenke                                     │
│     - Tildelt tekniker                                          │
│     - Planlagt dato/tid                                         │
│     - Handlinger: Start besøk, Flytt, Kanseller                 │
├─────────────────────────────────────────────────────────────────┤
│  3. Nytt besøk (modal)                                          │
│     - Velg avtale                                               │
│     - Velg dato og tid                                          │
│     - Tildel tekniker                                           │
│     - Legg til notater                                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Mappestruktur

```
apps/mobile/features/visits/
├── components/
│   ├── VisitStats.tsx
│   ├── WeekCalendar.tsx
│   ├── VisitCard.tsx
│   ├── VisitFilters.tsx
│   ├── NewVisitSheet.tsx
│   └── VisitDetail.tsx
├── hooks/
│   └── useVisits.ts
├── screens/
│   ├── PlannedVisitsScreen.tsx
│   └── VisitDetailScreen.tsx
└── types.ts
```

---

## Del 1: API Router

**Fil**: `apps/api/src/trpc/routers/visits.ts`

```typescript
import { router, protectedProcedure } from '../trpc';
import { z } from 'zod';
import { plannedVisits, serviceVisits, users } from '@myhrvold/db/schema';
import { eq, and, isNull, gte, lte, desc } from 'drizzle-orm';

export const visitsRouter = router({
  // Hent planlagte besøk for periode
  list: protectedProcedure
    .input(z.object({
      startDate: z.string().datetime(),
      endDate: z.string().datetime(),
      technicianId: z.string().uuid().optional(),
      status: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const conditions = [
        isNull(plannedVisits.deletedAt),
        gte(plannedVisits.scheduledDate, new Date(input.startDate)),
        lte(plannedVisits.scheduledDate, new Date(input.endDate)),
      ];
      
      if (input.technicianId) {
        conditions.push(eq(plannedVisits.technicianId, input.technicianId));
      }
      if (input.status) {
        conditions.push(eq(plannedVisits.status, input.status as any));
      }
      
      return ctx.db.query.plannedVisits.findMany({
        where: and(...conditions),
        orderBy: plannedVisits.scheduledDate,
        with: {
          customer: true,
          technician: { columns: { id: true, firstName: true, lastName: true } },
          maintenanceAgreement: true,
        },
      });
    }),

  // Hent teknikere
  technicians: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.query.users.findMany({
      where: and(
        eq(users.role, 'tekniker'),
        eq(users.isActive, true)
      ),
      columns: { id: true, firstName: true, lastName: true, avatar: true },
    });
  }),

  // Opprett nytt besøk
  create: protectedProcedure
    .input(z.object({
      maintenanceAgreementId: z.string().uuid().optional(),
      storkjokkenAgreementId: z.string().uuid().optional(),
      customerId: z.string().uuid().optional(),
      technicianId: z.string().uuid(),
      scheduledDate: z.string().datetime(),
      scheduledTime: z.string().optional(),
      estimatedDuration: z.string().optional(),
      visitAddress: z.string().optional(),
      contactPerson: z.string().optional(),
      contactPhone: z.string().optional(),
      description: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const visitNumber = `BES-${Date.now().toString(36).toUpperCase()}`;
      
      const [visit] = await ctx.db.insert(plannedVisits).values({
        ...input,
        visitNumber,
        scheduledDate: new Date(input.scheduledDate),
        createdById: ctx.user.id,
        status: 'planned',
      }).returning();
      
      return visit;
    }),

  // Oppdater status
  updateStatus: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      status: z.enum(['planned', 'confirmed', 'in_progress', 'completed', 'cancelled', 'rescheduled']),
      cancelReason: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.update(plannedVisits)
        .set({
          status: input.status,
          cancelReason: input.cancelReason,
          cancelledAt: input.status === 'cancelled' ? new Date() : undefined,
          updatedAt: new Date(),
        })
        .where(eq(plannedVisits.id, input.id));
      
      return { success: true };
    }),
});
```

---

## Del 2: Week Calendar

**Fil**: `features/visits/components/WeekCalendar.tsx`

```typescript
import { View, Text, Pressable, ScrollView } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';

interface Props {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  onWeekChange: (direction: 'prev' | 'next') => void;
  visitCounts: Record<string, number>;
}

const DAYS = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn'];

export function WeekCalendar({ selectedDate, onDateSelect, onWeekChange, visitCounts }: Props) {
  // Get week dates
  const getWeekDates = () => {
    const start = new Date(selectedDate);
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1);
    start.setDate(diff);
    
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      dates.push(d);
    }
    return dates;
  };
  
  const weekDates = getWeekDates();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const formatWeekRange = () => {
    const start = weekDates[0];
    const end = weekDates[6];
    const startMonth = start.toLocaleDateString('nb-NO', { month: 'short' });
    const endMonth = end.toLocaleDateString('nb-NO', { month: 'short' });
    
    if (startMonth === endMonth) {
      return `${start.getDate()} - ${end.getDate()} ${startMonth}`;
    }
    return `${start.getDate()} ${startMonth} - ${end.getDate()} ${endMonth}`;
  };
  
  return (
    <View className="bg-white mx-4 rounded-xl p-4 mb-4 shadow-sm">
      {/* Week navigation */}
      <View className="flex-row items-center justify-between mb-4">
        <Pressable onPress={() => onWeekChange('prev')} className="p-2">
          <ChevronLeft size={20} color="#374151" />
        </Pressable>
        <Text className="font-semibold text-gray-900">{formatWeekRange()}</Text>
        <Pressable onPress={() => onWeekChange('next')} className="p-2">
          <ChevronRight size={20} color="#374151" />
        </Pressable>
      </View>
      
      {/* Days */}
      <View className="flex-row justify-between">
        {weekDates.map((date, i) => {
          const dateStr = date.toISOString().split('T')[0];
          const isSelected = date.toDateString() === selectedDate.toDateString();
          const isToday = date.toDateString() === today.toDateString();
          const count = visitCounts[dateStr] || 0;
          
          return (
            <Pressable
              key={i}
              onPress={() => onDateSelect(date)}
              className={`items-center py-2 px-3 rounded-xl ${
                isSelected ? 'bg-accent-500' : ''
              }`}
            >
              <Text className={`text-xs mb-1 ${
                isSelected ? 'text-white' : 'text-gray-500'
              }`}>
                {DAYS[i]}
              </Text>
              <Text className={`text-lg font-semibold ${
                isSelected ? 'text-white' : isToday ? 'text-accent-600' : 'text-gray-900'
              }`}>
                {date.getDate()}
              </Text>
              {count > 0 && (
                <View className={`mt-1 w-5 h-5 rounded-full items-center justify-center ${
                  isSelected ? 'bg-white/20' : 'bg-accent-100'
                }`}>
                  <Text className={`text-xs font-medium ${
                    isSelected ? 'text-white' : 'text-accent-700'
                  }`}>{count}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
```

---

## Del 3: Visit Card

**Fil**: `features/visits/components/VisitCard.tsx`

```typescript
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Clock, MapPin, User, ChevronRight } from 'lucide-react-native';

interface Props {
  visit: {
    id: string;
    visitNumber: string;
    status: string;
    scheduledDate: Date;
    scheduledTime?: string;
    visitAddress?: string;
    customer?: { name: string };
    technician?: { firstName: string; lastName: string };
    maintenanceAgreement?: { agreementNumber: string };
  };
}

const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  planned: { bg: 'bg-blue-100', text: 'text-blue-700', dot: 'bg-blue-500' },
  confirmed: { bg: 'bg-green-100', text: 'text-green-700', dot: 'bg-green-500' },
  in_progress: { bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500' },
  completed: { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' },
  cancelled: { bg: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-500' },
};

export function VisitCard({ visit }: Props) {
  const router = useRouter();
  const colors = STATUS_COLORS[visit.status] || STATUS_COLORS.planned;
  
  return (
    <Pressable
      onPress={() => router.push(`/visits/${visit.id}`)}
      className="bg-white rounded-xl p-4 mb-3 shadow-sm"
    >
      <View className="flex-row items-start justify-between mb-3">
        <View className="flex-1">
          <View className="flex-row items-center gap-2 mb-1">
            <View className={`w-2 h-2 rounded-full ${colors.dot}`} />
            <Text className="text-xs text-gray-500">{visit.visitNumber}</Text>
            {visit.maintenanceAgreement && (
              <Text className="text-xs text-gray-400">
                • {visit.maintenanceAgreement.agreementNumber}
              </Text>
            )}
          </View>
          <Text className="font-semibold text-gray-900">
            {visit.customer?.name || 'Ukjent kunde'}
          </Text>
        </View>
        <ChevronRight size={20} color="#9ca3af" />
      </View>
      
      <View className="flex-row items-center gap-4">
        {visit.scheduledTime && (
          <View className="flex-row items-center gap-1">
            <Clock size={14} color="#6b7280" />
            <Text className="text-sm text-gray-600">{visit.scheduledTime}</Text>
          </View>
        )}
        
        {visit.visitAddress && (
          <View className="flex-row items-center gap-1 flex-1">
            <MapPin size={14} color="#6b7280" />
            <Text className="text-sm text-gray-600" numberOfLines={1}>
              {visit.visitAddress}
            </Text>
          </View>
        )}
        
        {visit.technician && (
          <View className="flex-row items-center gap-1">
            <User size={14} color="#6b7280" />
            <Text className="text-sm text-gray-600">
              {visit.technician.firstName}
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}
```

---

## Del 4: Planned Visits Screen

**Fil**: `features/visits/screens/PlannedVisitsScreen.tsx`

```typescript
import { View, Text, FlatList, Pressable, RefreshControl } from 'react-native';
import { useState, useMemo } from 'react';
import { Plus, Filter } from 'lucide-react-native';
import { trpc } from '../../../lib/api';
import { WeekCalendar } from '../components/WeekCalendar';
import { VisitCard } from '../components/VisitCard';
import { NewVisitSheet } from '../components/NewVisitSheet';

export function PlannedVisitsScreen() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showNewVisit, setShowNewVisit] = useState(false);
  
  // Calculate week range
  const weekRange = useMemo(() => {
    const start = new Date(selectedDate);
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1);
    start.setDate(diff);
    start.setHours(0, 0, 0, 0);
    
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    
    return { start, end };
  }, [selectedDate]);
  
  const { data: visits, isLoading, refetch } = trpc.visits.list.useQuery({
    startDate: weekRange.start.toISOString(),
    endDate: weekRange.end.toISOString(),
  });
  
  // Count visits per day
  const visitCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    visits?.forEach((v) => {
      const dateStr = new Date(v.scheduledDate).toISOString().split('T')[0];
      counts[dateStr] = (counts[dateStr] || 0) + 1;
    });
    return counts;
  }, [visits]);
  
  // Filter to selected date
  const todaysVisits = useMemo(() => {
    const dateStr = selectedDate.toISOString().split('T')[0];
    return visits?.filter((v) => 
      new Date(v.scheduledDate).toISOString().split('T')[0] === dateStr
    ) || [];
  }, [visits, selectedDate]);
  
  const handleWeekChange = (direction: 'prev' | 'next') => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
    setSelectedDate(newDate);
  };
  
  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-primary-800 px-4 pt-12 pb-6">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-primary-200 text-sm">Service</Text>
            <Text className="text-white text-2xl font-bold">Planlagte besøk</Text>
          </View>
          <View className="flex-row gap-2">
            <Pressable className="bg-primary-700 w-10 h-10 rounded-full items-center justify-center">
              <Filter size={20} color="white" />
            </Pressable>
            <Pressable 
              onPress={() => setShowNewVisit(true)}
              className="bg-accent-500 w-10 h-10 rounded-full items-center justify-center"
            >
              <Plus size={24} color="white" />
            </Pressable>
          </View>
        </View>
      </View>
      
      {/* Calendar */}
      <View className="pt-4">
        <WeekCalendar
          selectedDate={selectedDate}
          onDateSelect={setSelectedDate}
          onWeekChange={handleWeekChange}
          visitCounts={visitCounts}
        />
      </View>
      
      {/* Date header */}
      <View className="px-4 mb-2">
        <Text className="text-lg font-semibold text-gray-900">
          {selectedDate.toLocaleDateString('nb-NO', { 
            weekday: 'long', 
            day: 'numeric', 
            month: 'long' 
          })}
        </Text>
        <Text className="text-gray-500">{todaysVisits.length} besøk</Text>
      </View>
      
      {/* Visits list */}
      <FlatList
        data={todaysVisits}
        keyExtractor={(item) => item.id}
        contentContainerClassName="px-4 pb-20"
        renderItem={({ item }) => <VisitCard visit={item} />}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refetch} />
        }
        ListEmptyComponent={
          <View className="items-center py-12">
            <Text className="text-4xl mb-4">📅</Text>
            <Text className="text-gray-500">Ingen besøk planlagt</Text>
          </View>
        }
      />
      
      {/* New Visit Sheet */}
      <NewVisitSheet
        visible={showNewVisit}
        onClose={() => setShowNewVisit(false)}
        onCreated={() => {
          setShowNewVisit(false);
          refetch();
        }}
        initialDate={selectedDate}
      />
    </View>
  );
}
```

---

## Del 5: Routes

**Fil**: `app/(dashboard)/visits/index.tsx`

```typescript
import { PlannedVisitsScreen } from '../../../features/visits/screens/PlannedVisitsScreen';

export default function VisitsPage() {
  return <PlannedVisitsScreen />;
}
```

**Fil**: `app/(dashboard)/visits/[id].tsx`

```typescript
import { VisitDetailScreen } from '../../../features/visits/screens/VisitDetailScreen';

export default function VisitDetailPage() {
  return <VisitDetailScreen />;
}
```

---

## Sjekkliste

- [ ] visits.ts API router
- [ ] WeekCalendar med navigasjon
- [ ] VisitCard komponent
- [ ] PlannedVisitsScreen
- [ ] VisitDetailScreen
- [ ] NewVisitSheet
- [ ] Routes: /visits og /visits/[id]
- [ ] Filter per tekniker
- [ ] Telling per dag i kalender
