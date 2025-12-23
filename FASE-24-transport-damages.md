# FASE 24: Transport Damages API + UI

> Fase 1-23 må være fullført.
> Estimert tid: ~45 minutter.

## Mål

Implementer transportskademodul for registrering og oppfølging.

---

## Backend: Transport Damages Module

### apps/api/src/modules/transport-damages/transport-damages.policy.ts

```typescript
import type { User } from '../../trpc/context';

export const TransportDamagePermissions = {
  list: ['super_admin', 'admin', 'leder', 'service', 'tekniker', 'viewer'],
  read: ['super_admin', 'admin', 'leder', 'service', 'tekniker', 'viewer'],
  create: ['super_admin', 'admin', 'leder', 'service', 'tekniker'],
  update: ['super_admin', 'admin', 'leder', 'service'],
  delete: ['super_admin', 'admin'],
} as const;

type Action = keyof typeof TransportDamagePermissions;

export function canPerform(user: User, action: Action): boolean {
  return TransportDamagePermissions[action].includes(user.role as any);
}

export function assertCan(user: User, action: Action): void {
  if (!canPerform(user, action)) {
    throw new Error(`Ingen tilgang til ${action} transportskade`);
  }
}
```

---

### apps/api/src/modules/transport-damages/transport-damages.repo.ts

```typescript
import { eq, ilike, or, and, isNull, desc, SQL, sql } from 'drizzle-orm';
import type { Database } from '../../lib/db';
import { transportDamages, suppliers, installations } from '@myhrvold/db/schema';

interface ListParams {
  page: number;
  limit: number;
  search?: string;
  status?: string;
  supplierId?: string;
  installationId?: string;
}

export class TransportDamagesRepository {
  constructor(private db: Database) {}

  async findMany(params: ListParams) {
    const { page, limit, search, status, supplierId, installationId } = params;
    const offset = (page - 1) * limit;

    const conditions: SQL[] = [isNull(transportDamages.deletedAt)];

    if (search) {
      conditions.push(
        or(
          ilike(transportDamages.caseNumber, `%${search}%`),
          ilike(transportDamages.productDescription, `%${search}%`),
          ilike(transportDamages.orderNumber, `%${search}%`)
        )!
      );
    }

    if (status) {
      conditions.push(eq(transportDamages.status, status));
    }

    if (supplierId) {
      conditions.push(eq(transportDamages.supplierId, supplierId));
    }

    if (installationId) {
      conditions.push(eq(transportDamages.installationId, installationId));
    }

    return this.db.query.transportDamages.findMany({
      where: and(...conditions),
      with: {
        supplier: {
          columns: { id: true, name: true, shortCode: true },
        },
        installation: {
          columns: { id: true, projectNumber: true, projectName: true },
        },
      },
      orderBy: [desc(transportDamages.reportedAt)],
      limit,
      offset,
    });
  }

  async findById(id: string) {
    return this.db.query.transportDamages.findFirst({
      where: and(eq(transportDamages.id, id), isNull(transportDamages.deletedAt)),
      with: {
        supplier: true,
        installation: {
          with: {
            customer: true,
          },
        },
        reportedBy: {
          columns: { id: true, firstName: true, lastName: true },
        },
      },
    });
  }

  async create(data: typeof transportDamages.$inferInsert) {
    const [result] = await this.db.insert(transportDamages).values(data).returning();
    return result;
  }

  async update(id: string, data: Partial<typeof transportDamages.$inferInsert>) {
    const [result] = await this.db
      .update(transportDamages)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(transportDamages.id, id))
      .returning();
    return result;
  }

  async softDelete(id: string) {
    const [result] = await this.db
      .update(transportDamages)
      .set({ deletedAt: new Date() })
      .where(eq(transportDamages.id, id))
      .returning();
    return result;
  }

  async count(params: Omit<ListParams, 'page' | 'limit'>) {
    const { search, status, supplierId } = params;
    const conditions: SQL[] = [isNull(transportDamages.deletedAt)];

    if (search) {
      conditions.push(ilike(transportDamages.caseNumber, `%${search}%`));
    }

    if (status) {
      conditions.push(eq(transportDamages.status, status));
    }

    if (supplierId) {
      conditions.push(eq(transportDamages.supplierId, supplierId));
    }

    const result = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(transportDamages)
      .where(and(...conditions));

    return result[0]?.count ?? 0;
  }

  async generateCaseNumber() {
    const year = new Date().getFullYear();
    const prefix = `TS-${year}`;

    const lastDamage = await this.db.query.transportDamages.findFirst({
      where: ilike(transportDamages.caseNumber, `${prefix}%`),
      orderBy: [desc(transportDamages.caseNumber)],
    });

    let sequence = 1;
    if (lastDamage?.caseNumber) {
      const lastSequence = parseInt(lastDamage.caseNumber.slice(-4), 10);
      sequence = lastSequence + 1;
    }

    return `${prefix}-${sequence.toString().padStart(4, '0')}`;
  }

  async getStats() {
    const result = await this.db
      .select({
        status: transportDamages.status,
        count: sql<number>`count(*)`,
      })
      .from(transportDamages)
      .where(isNull(transportDamages.deletedAt))
      .groupBy(transportDamages.status);

    return result.reduce((acc, row) => {
      acc[row.status] = row.count;
      return acc;
    }, {} as Record<string, number>);
  }
}
```

---

### apps/api/src/modules/transport-damages/transport-damages.service.ts

```typescript
import { TRPCError } from '@trpc/server';
import type { Database } from '../../lib/db';
import type { Logger } from 'pino';
import { TransportDamagesRepository } from './transport-damages.repo';

interface CreateTransportDamageInput {
  supplierId: string;
  installationId?: string;
  orderNumber?: string;
  deliveryDate?: Date;
  productDescription: string;
  articleNumber?: string;
  damageDescription: string;
  damageType?: string;
  carrierName?: string;
  carrierTrackingNumber?: string;
  photosTaken?: boolean;
  packagingInspected?: boolean;
  estimatedValue?: number;
  notes?: string;
}

export class TransportDamagesService {
  private repo: TransportDamagesRepository;

  constructor(
    private db: Database,
    private log: Logger
  ) {
    this.repo = new TransportDamagesRepository(db);
  }

  async list(params: {
    page: number;
    limit: number;
    search?: string;
    status?: string;
    supplierId?: string;
    installationId?: string;
  }) {
    const [items, total] = await Promise.all([
      this.repo.findMany(params),
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
    const damage = await this.repo.findById(id);
    if (!damage) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Transportskade ikke funnet',
      });
    }
    return damage;
  }

  async create(input: CreateTransportDamageInput, userId: string) {
    const caseNumber = await this.repo.generateCaseNumber();

    const damage = await this.repo.create({
      ...input,
      caseNumber,
      status: 'reported',
      reportedAt: new Date(),
      reportedById: userId,
      createdById: userId,
    });

    this.log.info({ damageId: damage.id, caseNumber }, 'Transport damage created');
    return damage;
  }

  async update(id: string, input: Partial<CreateTransportDamageInput>, userId: string) {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Transportskade ikke funnet',
      });
    }

    const damage = await this.repo.update(id, {
      ...input,
      updatedById: userId,
    });

    this.log.info({ damageId: id }, 'Transport damage updated');
    return damage;
  }

  async updateStatus(id: string, status: string, resolution?: string, userId?: string) {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Transportskade ikke funnet',
      });
    }

    const updates: Record<string, any> = {
      status,
      updatedById: userId,
    };

    if (status === 'resolved' && resolution) {
      updates.resolution = resolution;
      updates.resolvedAt = new Date();
    }

    if (status === 'claim_submitted') {
      updates.claimSubmittedAt = new Date();
    }

    const damage = await this.repo.update(id, updates);
    this.log.info({ damageId: id, status }, 'Transport damage status updated');
    return damage;
  }

  async delete(id: string) {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Transportskade ikke funnet',
      });
    }

    await this.repo.softDelete(id);
    this.log.info({ damageId: id }, 'Transport damage deleted');
    return { success: true };
  }

  async getStats() {
    return this.repo.getStats();
  }
}
```

---

### apps/api/src/modules/transport-damages/transport-damages.router.ts

```typescript
import { z } from 'zod';
import { router, protectedProcedure } from '../../trpc/trpc';
import { TransportDamagesService } from './transport-damages.service';
import { assertCan } from './transport-damages.policy';

const createInput = z.object({
  supplierId: z.string().uuid(),
  installationId: z.string().uuid().optional(),
  orderNumber: z.string().optional(),
  deliveryDate: z.coerce.date().optional(),
  productDescription: z.string().min(1, 'Produktbeskrivelse er påkrevd'),
  articleNumber: z.string().optional(),
  damageDescription: z.string().min(1, 'Skadebeskrivelse er påkrevd'),
  damageType: z.enum(['cosmetic', 'functional', 'packaging', 'missing_parts']).optional(),
  carrierName: z.string().optional(),
  carrierTrackingNumber: z.string().optional(),
  photosTaken: z.boolean().optional(),
  packagingInspected: z.boolean().optional(),
  estimatedValue: z.number().positive().optional(),
  notes: z.string().optional(),
});

const statusEnum = z.enum([
  'reported',
  'investigating',
  'claim_submitted',
  'awaiting_response',
  'resolved',
  'rejected',
]);

export const transportDamagesRouter = router({
  list: protectedProcedure
    .input(z.object({
      page: z.number().int().min(1).default(1),
      limit: z.number().int().min(1).max(100).default(20),
      search: z.string().optional(),
      status: z.string().optional(),
      supplierId: z.string().uuid().optional(),
      installationId: z.string().uuid().optional(),
    }))
    .query(async ({ ctx, input }) => {
      assertCan(ctx.user, 'list');
      const service = new TransportDamagesService(ctx.db, ctx.log);
      return service.list(input);
    }),

  byId: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      assertCan(ctx.user, 'read');
      const service = new TransportDamagesService(ctx.db, ctx.log);
      return service.getById(input.id);
    }),

  create: protectedProcedure
    .input(createInput)
    .mutation(async ({ ctx, input }) => {
      assertCan(ctx.user, 'create');
      const service = new TransportDamagesService(ctx.db, ctx.log);
      return service.create(input, ctx.user.id);
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      data: createInput.partial(),
    }))
    .mutation(async ({ ctx, input }) => {
      assertCan(ctx.user, 'update');
      const service = new TransportDamagesService(ctx.db, ctx.log);
      return service.update(input.id, input.data, ctx.user.id);
    }),

  updateStatus: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      status: statusEnum,
      resolution: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      assertCan(ctx.user, 'update');
      const service = new TransportDamagesService(ctx.db, ctx.log);
      return service.updateStatus(input.id, input.status, input.resolution, ctx.user.id);
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      assertCan(ctx.user, 'delete');
      const service = new TransportDamagesService(ctx.db, ctx.log);
      return service.delete(input.id);
    }),

  stats: protectedProcedure
    .query(async ({ ctx }) => {
      assertCan(ctx.user, 'list');
      const service = new TransportDamagesService(ctx.db, ctx.log);
      return service.getStats();
    }),
});

export type TransportDamagesRouter = typeof transportDamagesRouter;
```

---

## Frontend: Transport Damages UI

### src/features/transport-damages/components/DamageCard.tsx

```tsx
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Package, AlertTriangle, Calendar, ChevronRight } from 'lucide-react-native';
import { DamageStatusBadge } from './DamageStatusBadge';

interface TransportDamage {
  id: string;
  caseNumber: string;
  status: string;
  productDescription: string;
  damageType?: string | null;
  reportedAt: Date;
  supplier?: { name: string; shortCode: string } | null;
}

export function DamageCard({ damage }: { damage: TransportDamage }) {
  const router = useRouter();

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('nb-NO', {
      day: '2-digit',
      month: 'short',
    });
  };

  const damageTypeLabels: Record<string, string> = {
    cosmetic: 'Kosmetisk',
    functional: 'Funksjonell',
    packaging: 'Emballasje',
    missing_parts: 'Manglende deler',
  };

  return (
    <Pressable
      onPress={() => router.push(`/transport-damages/${damage.id}`)}
      className="bg-white p-4 rounded-xl mb-3 border border-gray-100 active:bg-gray-50"
    >
      <View className="flex-row items-start justify-between">
        <View className="flex-1">
          <View className="flex-row items-center gap-2 mb-1">
            <Text className="text-orange-600 font-bold">{damage.caseNumber}</Text>
            <DamageStatusBadge status={damage.status} />
          </View>

          <Text className="text-gray-900 font-medium" numberOfLines={2}>
            {damage.productDescription}
          </Text>

          <View className="flex-row items-center mt-2 gap-3">
            {damage.supplier && (
              <Text className="text-gray-500 text-sm">{damage.supplier.name}</Text>
            )}
            {damage.damageType && (
              <View className="px-2 py-0.5 bg-orange-50 rounded">
                <Text className="text-orange-700 text-xs">
                  {damageTypeLabels[damage.damageType] || damage.damageType}
                </Text>
              </View>
            )}
          </View>

          <View className="flex-row items-center mt-2">
            <Calendar size={12} color="#9ca3af" />
            <Text className="text-gray-400 text-xs ml-1">
              {formatDate(damage.reportedAt)}
            </Text>
          </View>
        </View>
        <ChevronRight size={20} color="#9ca3af" />
      </View>
    </Pressable>
  );
}
```

---

### src/features/transport-damages/components/DamageStatusBadge.tsx

```tsx
import { View, Text } from 'react-native';

const STATUS_COLORS = {
  reported: { bg: 'bg-red-100', text: 'text-red-700' },
  investigating: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  claim_submitted: { bg: 'bg-blue-100', text: 'text-blue-700' },
  awaiting_response: { bg: 'bg-purple-100', text: 'text-purple-700' },
  resolved: { bg: 'bg-green-100', text: 'text-green-700' },
  rejected: { bg: 'bg-gray-100', text: 'text-gray-700' },
} as const;

const STATUS_LABELS: Record<string, string> = {
  reported: 'Rapportert',
  investigating: 'Under undersøkelse',
  claim_submitted: 'Krav sendt',
  awaiting_response: 'Venter svar',
  resolved: 'Løst',
  rejected: 'Avvist',
};

export function DamageStatusBadge({ status }: { status: string }) {
  const colors = STATUS_COLORS[status as keyof typeof STATUS_COLORS] || STATUS_COLORS.reported;

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

### src/features/transport-damages/screens/TransportDamagesListScreen.tsx

```tsx
import { View, Text, FlatList, RefreshControl, TextInput, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { trpc } from '../../../lib/api';
import { DamageCard } from '../components/DamageCard';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { ErrorView } from '../../../components/ErrorView';
import { Search, Plus, AlertTriangle } from 'lucide-react-native';

export function TransportDamagesListScreen() {
  const router = useRouter();
  const [search, setSearch] = useState('');

  const { 
    data, 
    isLoading, 
    error, 
    refetch,
    isRefetching,
  } = trpc.transportDamages.list.useQuery({ 
    page: 1, 
    limit: 50,
    search: search || undefined,
  });

  const { data: stats } = trpc.transportDamages.stats.useQuery();

  if (isLoading) return <LoadingScreen />;
  if (error) return <ErrorView error={error} onRetry={refetch} />;

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-orange-600 pt-12 pb-6 px-4">
        <View className="flex-row items-center justify-between mb-4">
          <View className="flex-row items-center">
            <AlertTriangle size={24} color="white" />
            <Text className="text-white text-2xl font-bold ml-2">
              Transportskader
            </Text>
          </View>
          <Pressable
            onPress={() => router.push('/transport-damages/new')}
            className="bg-white/20 px-4 py-2 rounded-lg flex-row items-center"
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
            placeholder="Søk saker..."
            placeholderTextColor="rgba(255,255,255,0.5)"
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </View>

      {/* Stats */}
      {stats && (
        <View className="flex-row bg-white px-4 py-3 border-b border-gray-100">
          <StatItem label="Åpne" value={(stats.reported ?? 0) + (stats.investigating ?? 0)} color="#ef4444" />
          <StatItem label="Venter" value={stats.awaiting_response ?? 0} color="#8b5cf6" />
          <StatItem label="Løst" value={stats.resolved ?? 0} color="#22c55e" />
        </View>
      )}

      {/* List */}
      <FlatList
        data={data?.items ?? []}
        renderItem={({ item }) => <DamageCard damage={item} />}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl 
            refreshing={isRefetching} 
            onRefresh={refetch}
            tintColor="#ea580c"
          />
        }
        ListEmptyComponent={
          <View className="items-center py-12">
            <AlertTriangle size={48} color="#d1d5db" />
            <Text className="text-gray-500 mt-2">Ingen transportskader</Text>
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

### app/(dashboard)/transport-damages/index.tsx

```tsx
import { TransportDamagesListScreen } from '../../../src/features/transport-damages/screens/TransportDamagesListScreen';

export default function TransportDamagesPage() {
  return <TransportDamagesListScreen />;
}
```

---

## Oppdater AppRouter

```typescript
import { transportDamagesRouter } from '../modules/transport-damages/transport-damages.router';

export const appRouter = router({
  // ... existing
  transportDamages: transportDamagesRouter,
});
```

---

## Sjekkliste

- [ ] transport-damages.policy.ts
- [ ] transport-damages.repo.ts
- [ ] transport-damages.service.ts
- [ ] transport-damages.router.ts
- [ ] DamageCard komponent
- [ ] DamageStatusBadge
- [ ] TransportDamagesListScreen
- [ ] TransportDamageDetailScreen
- [ ] Create form
- [ ] AppRouter oppdatert

---

## Neste fase

Gå til **FASE 25: Discussion Issues API + UI**.
