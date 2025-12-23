# FASE 23: Installations API + UI

> Fase 1-22 må være fullført.
> Estimert tid: ~60 minutter.

## Mål

Implementer komplett installasjonsmodul med prosjektstyring.

---

## Backend: Installations Module

### apps/api/src/modules/installations/installations.policy.ts

```typescript
import type { User } from '../../trpc/context';

export const InstallationPermissions = {
  list: ['super_admin', 'admin', 'leder', 'service', 'tekniker', 'viewer'],
  read: ['super_admin', 'admin', 'leder', 'service', 'tekniker', 'viewer'],
  create: ['super_admin', 'admin', 'leder', 'service'],
  update: ['super_admin', 'admin', 'leder', 'service'],
  delete: ['super_admin', 'admin'],
  assign: ['super_admin', 'admin', 'leder'],
} as const;

type Action = keyof typeof InstallationPermissions;

export function canPerform(user: User, action: Action): boolean {
  return InstallationPermissions[action].includes(user.role as any);
}

export function assertCan(user: User, action: Action): void {
  if (!canPerform(user, action)) {
    throw new Error(`Ingen tilgang til ${action} installasjon`);
  }
}
```

---

### apps/api/src/modules/installations/installations.repo.ts

```typescript
import { eq, ilike, or, and, isNull, desc, asc, SQL, sql, gte, lte } from 'drizzle-orm';
import type { Database } from '../../lib/db';
import { installations, customers, users } from '@myhrvold/db/schema';

interface ListParams {
  page: number;
  limit: number;
  search?: string;
  status?: string;
  customerId?: string;
  assignedToId?: string;
  fromDate?: Date;
  toDate?: Date;
}

export class InstallationsRepository {
  constructor(private db: Database) {}

  async findMany(params: ListParams) {
    const { page, limit, search, status, customerId, assignedToId, fromDate, toDate } = params;
    const offset = (page - 1) * limit;

    const conditions: SQL[] = [isNull(installations.deletedAt)];

    if (search) {
      conditions.push(
        or(
          ilike(installations.projectNumber, `%${search}%`),
          ilike(installations.projectName, `%${search}%`),
          ilike(installations.orderNumber, `%${search}%`)
        )!
      );
    }

    if (status) {
      conditions.push(eq(installations.status, status));
    }

    if (customerId) {
      conditions.push(eq(installations.customerId, customerId));
    }

    if (assignedToId) {
      conditions.push(eq(installations.assignedToId, assignedToId));
    }

    if (fromDate) {
      conditions.push(gte(installations.plannedDate, fromDate));
    }

    if (toDate) {
      conditions.push(lte(installations.plannedDate, toDate));
    }

    return this.db.query.installations.findMany({
      where: and(...conditions),
      with: {
        customer: {
          columns: { id: true, name: true, city: true },
        },
        assignedTo: {
          columns: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: [desc(installations.plannedDate)],
      limit,
      offset,
    });
  }

  async findById(id: string) {
    return this.db.query.installations.findFirst({
      where: and(eq(installations.id, id), isNull(installations.deletedAt)),
      with: {
        customer: true,
        assignedTo: {
          columns: { id: true, firstName: true, lastName: true, email: true },
        },
        createdBy: {
          columns: { id: true, firstName: true, lastName: true },
        },
      },
    });
  }

  async create(data: typeof installations.$inferInsert) {
    const [result] = await this.db.insert(installations).values(data).returning();
    return result;
  }

  async update(id: string, data: Partial<typeof installations.$inferInsert>) {
    const [result] = await this.db
      .update(installations)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(installations.id, id))
      .returning();
    return result;
  }

  async softDelete(id: string) {
    const [result] = await this.db
      .update(installations)
      .set({ deletedAt: new Date() })
      .where(eq(installations.id, id))
      .returning();
    return result;
  }

  async count(params: Omit<ListParams, 'page' | 'limit'>) {
    const { search, status, customerId } = params;
    const conditions: SQL[] = [isNull(installations.deletedAt)];

    if (search) {
      conditions.push(
        or(
          ilike(installations.projectNumber, `%${search}%`),
          ilike(installations.projectName, `%${search}%`)
        )!
      );
    }

    if (status) {
      conditions.push(eq(installations.status, status));
    }

    if (customerId) {
      conditions.push(eq(installations.customerId, customerId));
    }

    const result = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(installations)
      .where(and(...conditions));

    return result[0]?.count ?? 0;
  }

  async generateProjectNumber() {
    const year = new Date().getFullYear().toString().slice(-2);
    const month = (new Date().getMonth() + 1).toString().padStart(2, '0');
    const prefix = `INS-${year}${month}`;

    const lastInstallation = await this.db.query.installations.findFirst({
      where: ilike(installations.projectNumber, `${prefix}%`),
      orderBy: [desc(installations.projectNumber)],
    });

    let sequence = 1;
    if (lastInstallation?.projectNumber) {
      const lastSequence = parseInt(lastInstallation.projectNumber.slice(-4), 10);
      sequence = lastSequence + 1;
    }

    return `${prefix}-${sequence.toString().padStart(4, '0')}`;
  }

  async getStats() {
    const result = await this.db
      .select({
        status: installations.status,
        count: sql<number>`count(*)`,
      })
      .from(installations)
      .where(isNull(installations.deletedAt))
      .groupBy(installations.status);

    return result.reduce((acc, row) => {
      acc[row.status] = row.count;
      return acc;
    }, {} as Record<string, number>);
  }
}
```

---

### apps/api/src/modules/installations/installations.service.ts

```typescript
import { TRPCError } from '@trpc/server';
import type { Database } from '../../lib/db';
import type { Logger } from 'pino';
import { InstallationsRepository } from './installations.repo';

interface CreateInstallationInput {
  customerId: string;
  projectName: string;
  orderNumber?: string;
  description?: string;
  plannedDate?: Date;
  estimatedHours?: number;
  assignedToId?: string;
  contactPerson?: string;
  contactPhone?: string;
  deliveryAddress?: string;
  deliveryPostalCode?: string;
  deliveryCity?: string;
  notes?: string;
  equipmentList?: Record<string, unknown>[];
}

export class InstallationsService {
  private repo: InstallationsRepository;

  constructor(
    private db: Database,
    private log: Logger
  ) {
    this.repo = new InstallationsRepository(db);
  }

  async list(params: {
    page: number;
    limit: number;
    search?: string;
    status?: string;
    customerId?: string;
    assignedToId?: string;
    fromDate?: string;
    toDate?: string;
  }) {
    const [items, total] = await Promise.all([
      this.repo.findMany({
        ...params,
        fromDate: params.fromDate ? new Date(params.fromDate) : undefined,
        toDate: params.toDate ? new Date(params.toDate) : undefined,
      }),
      this.repo.count(params),
    ]);

    return {
      items,
      total,
      page: params.page,
      totalPages: Math.ceil(total / params.limit),
    };
  }

  async getById(id: string) {
    const installation = await this.repo.findById(id);
    if (!installation) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Installasjon ikke funnet',
      });
    }
    return installation;
  }

  async create(input: CreateInstallationInput, userId: string) {
    const projectNumber = await this.repo.generateProjectNumber();

    const installation = await this.repo.create({
      ...input,
      projectNumber,
      status: 'planned',
      createdById: userId,
    });

    this.log.info({ installationId: installation.id, projectNumber }, 'Installation created');
    return installation;
  }

  async update(id: string, input: Partial<CreateInstallationInput>, userId: string) {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Installasjon ikke funnet',
      });
    }

    const installation = await this.repo.update(id, {
      ...input,
      updatedById: userId,
    });

    this.log.info({ installationId: id }, 'Installation updated');
    return installation;
  }

  async updateStatus(id: string, status: string, userId: string) {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Installasjon ikke funnet',
      });
    }

    const updates: Record<string, any> = {
      status,
      updatedById: userId,
    };

    // Sett completedAt ved fullføring
    if (status === 'completed' && existing.status !== 'completed') {
      updates.completedAt = new Date();
    }

    const installation = await this.repo.update(id, updates);
    this.log.info({ installationId: id, status }, 'Installation status updated');
    return installation;
  }

  async assign(id: string, assignedToId: string, userId: string) {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Installasjon ikke funnet',
      });
    }

    const installation = await this.repo.update(id, {
      assignedToId,
      updatedById: userId,
    });

    this.log.info({ installationId: id, assignedToId }, 'Installation assigned');
    return installation;
  }

  async delete(id: string) {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Installasjon ikke funnet',
      });
    }

    await this.repo.softDelete(id);
    this.log.info({ installationId: id }, 'Installation deleted');
    return { success: true };
  }

  async getStats() {
    return this.repo.getStats();
  }
}
```

---

### apps/api/src/modules/installations/installations.router.ts

```typescript
import { z } from 'zod';
import { router, protectedProcedure } from '../../trpc/trpc';
import { InstallationsService } from './installations.service';
import { assertCan } from './installations.policy';

const createInput = z.object({
  customerId: z.string().uuid(),
  projectName: z.string().min(1, 'Prosjektnavn er påkrevd'),
  orderNumber: z.string().optional(),
  description: z.string().optional(),
  plannedDate: z.coerce.date().optional(),
  estimatedHours: z.number().positive().optional(),
  assignedToId: z.string().uuid().optional(),
  contactPerson: z.string().optional(),
  contactPhone: z.string().optional(),
  deliveryAddress: z.string().optional(),
  deliveryPostalCode: z.string().optional(),
  deliveryCity: z.string().optional(),
  notes: z.string().optional(),
  equipmentList: z.array(z.record(z.unknown())).optional(),
});

const statusEnum = z.enum([
  'planned',
  'confirmed',
  'in_progress',
  'completed',
  'cancelled',
  'on_hold',
]);

export const installationsRouter = router({
  list: protectedProcedure
    .input(z.object({
      page: z.number().int().min(1).default(1),
      limit: z.number().int().min(1).max(100).default(20),
      search: z.string().optional(),
      status: z.string().optional(),
      customerId: z.string().uuid().optional(),
      assignedToId: z.string().uuid().optional(),
      fromDate: z.string().optional(),
      toDate: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      assertCan(ctx.user, 'list');
      const service = new InstallationsService(ctx.db, ctx.log);
      return service.list(input);
    }),

  byId: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      assertCan(ctx.user, 'read');
      const service = new InstallationsService(ctx.db, ctx.log);
      return service.getById(input.id);
    }),

  create: protectedProcedure
    .input(createInput)
    .mutation(async ({ ctx, input }) => {
      assertCan(ctx.user, 'create');
      const service = new InstallationsService(ctx.db, ctx.log);
      return service.create(input, ctx.user.id);
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      data: createInput.partial(),
    }))
    .mutation(async ({ ctx, input }) => {
      assertCan(ctx.user, 'update');
      const service = new InstallationsService(ctx.db, ctx.log);
      return service.update(input.id, input.data, ctx.user.id);
    }),

  updateStatus: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      status: statusEnum,
    }))
    .mutation(async ({ ctx, input }) => {
      assertCan(ctx.user, 'update');
      const service = new InstallationsService(ctx.db, ctx.log);
      return service.updateStatus(input.id, input.status, ctx.user.id);
    }),

  assign: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      assignedToId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      assertCan(ctx.user, 'assign');
      const service = new InstallationsService(ctx.db, ctx.log);
      return service.assign(input.id, input.assignedToId, ctx.user.id);
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      assertCan(ctx.user, 'delete');
      const service = new InstallationsService(ctx.db, ctx.log);
      return service.delete(input.id);
    }),

  stats: protectedProcedure
    .query(async ({ ctx }) => {
      assertCan(ctx.user, 'list');
      const service = new InstallationsService(ctx.db, ctx.log);
      return service.getStats();
    }),
});

export type InstallationsRouter = typeof installationsRouter;
```

---

## Frontend: Installations UI

### src/features/installations/components/InstallationCard.tsx

```tsx
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Wrench, Calendar, MapPin, User, ChevronRight } from 'lucide-react-native';
import { InstallationStatusBadge } from './InstallationStatusBadge';

interface Installation {
  id: string;
  projectNumber: string;
  projectName: string;
  status: string;
  plannedDate?: Date | null;
  customer?: { name: string; city?: string | null } | null;
  assignedTo?: { firstName?: string | null; lastName?: string | null } | null;
}

export function InstallationCard({ installation }: { installation: Installation }) {
  const router = useRouter();

  const formatDate = (date?: Date | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('nb-NO', {
      day: '2-digit',
      month: 'short',
    });
  };

  const assignedName = installation.assignedTo
    ? `${installation.assignedTo.firstName ?? ''} ${installation.assignedTo.lastName ?? ''}`.trim()
    : null;

  return (
    <Pressable
      onPress={() => router.push(`/installations/${installation.id}`)}
      className="bg-white p-4 rounded-xl mb-3 border border-gray-100 active:bg-gray-50"
    >
      <View className="flex-row items-start justify-between">
        <View className="flex-1">
          {/* Header */}
          <View className="flex-row items-center gap-2 mb-1">
            <Text className="text-primary font-bold">{installation.projectNumber}</Text>
            <InstallationStatusBadge status={installation.status} />
          </View>

          {/* Project Name */}
          <Text className="text-gray-900 font-medium" numberOfLines={1}>
            {installation.projectName}
          </Text>

          {/* Customer */}
          <Text className="text-gray-500 text-sm" numberOfLines={1}>
            {installation.customer?.name}
          </Text>

          {/* Meta */}
          <View className="flex-row items-center mt-2 gap-4">
            {installation.plannedDate && (
              <View className="flex-row items-center">
                <Calendar size={12} color="#9ca3af" />
                <Text className="text-gray-400 text-xs ml-1">
                  {formatDate(installation.plannedDate)}
                </Text>
              </View>
            )}
            {installation.customer?.city && (
              <View className="flex-row items-center">
                <MapPin size={12} color="#9ca3af" />
                <Text className="text-gray-400 text-xs ml-1">
                  {installation.customer.city}
                </Text>
              </View>
            )}
            {assignedName && (
              <View className="flex-row items-center">
                <User size={12} color="#9ca3af" />
                <Text className="text-gray-400 text-xs ml-1">
                  {assignedName}
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

### src/features/installations/components/InstallationStatusBadge.tsx

```tsx
import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';

const STATUS_COLORS = {
  planned: { bg: 'bg-blue-100', text: 'text-blue-700' },
  confirmed: { bg: 'bg-indigo-100', text: 'text-indigo-700' },
  in_progress: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  completed: { bg: 'bg-green-100', text: 'text-green-700' },
  cancelled: { bg: 'bg-red-100', text: 'text-red-700' },
  on_hold: { bg: 'bg-gray-100', text: 'text-gray-700' },
} as const;

const STATUS_LABELS: Record<string, string> = {
  planned: 'Planlagt',
  confirmed: 'Bekreftet',
  in_progress: 'Pågår',
  completed: 'Fullført',
  cancelled: 'Kansellert',
  on_hold: 'På vent',
};

export function InstallationStatusBadge({ status }: { status: string }) {
  const colors = STATUS_COLORS[status as keyof typeof STATUS_COLORS] || STATUS_COLORS.planned;

  return (
    <View className={`px-2 py-0.5 rounded ${colors.bg}`}>
      <Text className={`text-xs font-medium ${colors.text}`}>
        {STATUS_LABELS[status] || status}
      </Text>
    </View>
  );
}
```

---

### src/features/installations/screens/InstallationsListScreen.tsx

```tsx
import { View, Text, FlatList, RefreshControl, TextInput, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { trpc } from '../../../lib/api';
import { InstallationCard } from '../components/InstallationCard';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { ErrorView } from '../../../components/ErrorView';
import { Search, Plus, Filter, Calendar } from 'lucide-react-native';

export function InstallationsListScreen() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string | undefined>();

  const { 
    data, 
    isLoading, 
    error, 
    refetch,
    isRefetching,
  } = trpc.installations.list.useQuery({ 
    page: 1, 
    limit: 50,
    search: search || undefined,
    status,
  });

  const { data: stats } = trpc.installations.stats.useQuery();

  if (isLoading) return <LoadingScreen />;
  if (error) return <ErrorView error={error} onRetry={refetch} />;

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-primary pt-12 pb-6 px-4">
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-white text-2xl font-bold">Installasjoner</Text>
          <Pressable
            onPress={() => router.push('/installations/new')}
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
            placeholder="Søk prosjekter..."
            placeholderTextColor="rgba(255,255,255,0.5)"
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </View>

      {/* Stats Bar */}
      {stats && (
        <View className="flex-row bg-white px-4 py-3 border-b border-gray-100">
          <StatItem label="Planlagt" value={stats.planned ?? 0} color="#3b82f6" />
          <StatItem label="Pågår" value={stats.in_progress ?? 0} color="#eab308" />
          <StatItem label="Fullført" value={stats.completed ?? 0} color="#22c55e" />
        </View>
      )}

      {/* List */}
      <FlatList
        data={data?.items ?? []}
        renderItem={({ item }) => <InstallationCard installation={item} />}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl 
            refreshing={isRefetching} 
            onRefresh={refetch}
            tintColor="#003366"
          />
        }
        ListEmptyComponent={
          <View className="items-center py-12">
            <Text className="text-gray-500">Ingen installasjoner funnet</Text>
          </View>
        }
      />
    </View>
  );
}

function StatItem({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View className="flex-1 items-center">
      <Text className="text-2xl font-bold" style={{ color }}>{value}</Text>
      <Text className="text-gray-500 text-xs">{label}</Text>
    </View>
  );
}
```

---

## Route Files

### app/(dashboard)/installations/index.tsx

```tsx
import { InstallationsListScreen } from '../../../src/features/installations/screens/InstallationsListScreen';

export default function InstallationsPage() {
  return <InstallationsListScreen />;
}
```

### app/(dashboard)/installations/[id].tsx

```tsx
import { InstallationDetailScreen } from '../../../src/features/installations/screens/InstallationDetailScreen';

export default function InstallationDetailPage() {
  return <InstallationDetailScreen />;
}
```

### app/(dashboard)/installations/new.tsx

```tsx
import { useRouter } from 'expo-router';
import { trpc } from '../../../src/lib/api';
import { InstallationForm } from '../../../src/features/installations/components/InstallationForm';

export default function NewInstallationPage() {
  const router = useRouter();
  const utils = trpc.useUtils();

  const createMutation = trpc.installations.create.useMutation({
    onSuccess: (data) => {
      utils.installations.list.invalidate();
      router.replace(`/installations/${data.id}` as any);
    },
  });

  return (
    <InstallationForm
      onSubmit={(data) => createMutation.mutate(data)}
      isLoading={createMutation.isPending}
    />
  );
}
```

---

## Oppdater AppRouter

```typescript
// apps/api/src/trpc/index.ts
import { installationsRouter } from '../modules/installations/installations.router';

export const appRouter = router({
  // ... existing routers
  installations: installationsRouter,
});
```

---

## Oppdater Tabs

```tsx
// app/(dashboard)/_layout.tsx - legg til Installations tab
<Tabs.Screen
  name="installations"
  options={{
    title: 'Installasjoner',
    tabBarIcon: ({ color, size }) => <Wrench size={size} color={color} />,
  }}
/>
```

---

## Sjekkliste

- [ ] installations.policy.ts
- [ ] installations.repo.ts med projectNumber-generering
- [ ] installations.service.ts
- [ ] installations.router.ts
- [ ] InstallationCard komponent
- [ ] InstallationStatusBadge komponent  
- [ ] InstallationsListScreen med stats
- [ ] InstallationDetailScreen
- [ ] InstallationForm
- [ ] Route files
- [ ] Tab navigation oppdatert

---

## Neste fase

Gå til **FASE 24: Transport Damages API + UI**.
