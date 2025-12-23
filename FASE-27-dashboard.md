# FASE 27: Dashboard + KPI + Statistikk

> Fase 1-26 må være fullført.
> Estimert tid: ~60 minutter.

## Mål

Implementer dashboard med KPI-er, statistikk og grafer.

---

## Backend: Dashboard Module

### apps/api/src/modules/dashboard/dashboard.service.ts

```typescript
import { sql, and, isNull, gte, lte, eq, count } from 'drizzle-orm';
import type { Database } from '../../lib/db';
import type { Logger } from 'pino';
import { 
  claims, 
  installations, 
  transportDamages, 
  discussionIssues,
  serviceVisits,
  maintenanceAgreements,
  users,
} from '@myhrvold/db/schema';

export class DashboardService {
  constructor(
    private db: Database,
    private log: Logger
  ) {}

  async getOverview() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    // Aktive saker
    const [
      openClaims,
      openInstallations,
      openDamages,
      openIssues,
      activeAgreements,
      activeUsers,
    ] = await Promise.all([
      this.db.select({ count: count() }).from(claims)
        .where(and(
          isNull(claims.deletedAt),
          sql`${claims.status} NOT IN ('resolved', 'closed', 'rejected')`
        )),
      this.db.select({ count: count() }).from(installations)
        .where(and(
          isNull(installations.deletedAt),
          sql`${installations.status} NOT IN ('completed', 'cancelled')`
        )),
      this.db.select({ count: count() }).from(transportDamages)
        .where(and(
          isNull(transportDamages.deletedAt),
          sql`${transportDamages.status} NOT IN ('resolved', 'rejected')`
        )),
      this.db.select({ count: count() }).from(discussionIssues)
        .where(and(
          isNull(discussionIssues.deletedAt),
          sql`${discussionIssues.status} NOT IN ('resolved', 'closed')`
        )),
      this.db.select({ count: count() }).from(maintenanceAgreements)
        .where(and(
          isNull(maintenanceAgreements.deletedAt),
          eq(maintenanceAgreements.isActive, true)
        )),
      this.db.select({ count: count() }).from(users)
        .where(and(
          isNull(users.deletedAt),
          eq(users.isActive, true)
        )),
    ]);

    // Denne måned vs forrige måned
    const [claimsThisMonth, claimsLastMonth] = await Promise.all([
      this.db.select({ count: count() }).from(claims)
        .where(and(
          isNull(claims.deletedAt),
          gte(claims.createdAt, startOfMonth)
        )),
      this.db.select({ count: count() }).from(claims)
        .where(and(
          isNull(claims.deletedAt),
          gte(claims.createdAt, startOfLastMonth),
          lte(claims.createdAt, endOfLastMonth)
        )),
    ]);

    return {
      openClaims: openClaims[0]?.count ?? 0,
      openInstallations: openInstallations[0]?.count ?? 0,
      openDamages: openDamages[0]?.count ?? 0,
      openIssues: openIssues[0]?.count ?? 0,
      activeAgreements: activeAgreements[0]?.count ?? 0,
      activeUsers: activeUsers[0]?.count ?? 0,
      claimsThisMonth: claimsThisMonth[0]?.count ?? 0,
      claimsLastMonth: claimsLastMonth[0]?.count ?? 0,
    };
  }

  async getClaimsStats(period: 'week' | 'month' | 'year' = 'month') {
    const now = new Date();
    let startDate: Date;
    let groupBy: string;

    switch (period) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        groupBy = "TO_CHAR(created_at, 'YYYY-MM-DD')";
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        groupBy = "TO_CHAR(created_at, 'YYYY-MM')";
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        groupBy = "TO_CHAR(created_at, 'YYYY-MM-DD')";
    }

    // Claims by status
    const byStatus = await this.db
      .select({
        status: claims.status,
        count: count(),
      })
      .from(claims)
      .where(and(
        isNull(claims.deletedAt),
        gte(claims.createdAt, startDate)
      ))
      .groupBy(claims.status);

    // Claims over time
    const overTime = await this.db.execute(sql`
      SELECT 
        ${sql.raw(groupBy)} as date,
        COUNT(*) as count
      FROM claims
      WHERE deleted_at IS NULL
        AND created_at >= ${startDate}
      GROUP BY ${sql.raw(groupBy)}
      ORDER BY date
    `);

    // Top suppliers by claims
    const topSuppliers = await this.db.execute(sql`
      SELECT 
        s.name as supplier_name,
        COUNT(c.id) as claim_count
      FROM claims c
      JOIN suppliers s ON c.supplier_id = s.id
      WHERE c.deleted_at IS NULL
        AND c.created_at >= ${startDate}
      GROUP BY s.id, s.name
      ORDER BY claim_count DESC
      LIMIT 10
    `);

    return {
      byStatus: byStatus.reduce((acc, row) => {
        acc[row.status] = row.count;
        return acc;
      }, {} as Record<string, number>),
      overTime: overTime.rows as { date: string; count: number }[],
      topSuppliers: topSuppliers.rows as { supplier_name: string; claim_count: number }[],
    };
  }

  async getServiceStats() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Service visits by status
    const visitsByStatus = await this.db
      .select({
        status: serviceVisits.status,
        count: count(),
      })
      .from(serviceVisits)
      .where(and(
        isNull(serviceVisits.deletedAt),
        gte(serviceVisits.createdAt, startOfMonth)
      ))
      .groupBy(serviceVisits.status);

    // Technician performance
    const technicianStats = await this.db.execute(sql`
      SELECT 
        u.first_name || ' ' || u.last_name as technician_name,
        COUNT(sv.id) as visit_count,
        ROUND(AVG(EXTRACT(EPOCH FROM (sv.completed_at - sv.started_at)) / 3600), 1) as avg_hours
      FROM service_visits sv
      JOIN users u ON sv.technician_id = u.id
      WHERE sv.deleted_at IS NULL
        AND sv.status = 'completed'
        AND sv.created_at >= ${startOfMonth}
      GROUP BY u.id, u.first_name, u.last_name
      ORDER BY visit_count DESC
      LIMIT 10
    `);

    return {
      visitsByStatus: visitsByStatus.reduce((acc, row) => {
        acc[row.status] = row.count;
        return acc;
      }, {} as Record<string, number>),
      technicianStats: technicianStats.rows,
    };
  }

  async getRecentActivity(limit: number = 20) {
    // Kombiner nylige hendelser fra alle moduler
    const recentClaims = await this.db.query.claims.findMany({
      where: isNull(claims.deletedAt),
      orderBy: [sql`created_at DESC`],
      limit: limit / 4,
      columns: {
        id: true,
        claimNumber: true,
        status: true,
        createdAt: true,
      },
      with: {
        supplier: { columns: { name: true } },
      },
    });

    const recentInstallations = await this.db.query.installations.findMany({
      where: isNull(installations.deletedAt),
      orderBy: [sql`created_at DESC`],
      limit: limit / 4,
      columns: {
        id: true,
        projectNumber: true,
        projectName: true,
        status: true,
        createdAt: true,
      },
    });

    // Kombiner og sorter
    const activities = [
      ...recentClaims.map(c => ({
        type: 'claim' as const,
        id: c.id,
        title: `Reklamasjon ${c.claimNumber}`,
        subtitle: c.supplier?.name,
        status: c.status,
        createdAt: c.createdAt,
      })),
      ...recentInstallations.map(i => ({
        type: 'installation' as const,
        id: i.id,
        title: `Installasjon ${i.projectNumber}`,
        subtitle: i.projectName,
        status: i.status,
        createdAt: i.createdAt,
      })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
     .slice(0, limit);

    return activities;
  }
}
```

---

### apps/api/src/modules/dashboard/dashboard.router.ts

```typescript
import { z } from 'zod';
import { router, protectedProcedure } from '../../trpc/trpc';
import { DashboardService } from './dashboard.service';

export const dashboardRouter = router({
  overview: protectedProcedure
    .query(async ({ ctx }) => {
      const service = new DashboardService(ctx.db, ctx.log);
      return service.getOverview();
    }),

  claimsStats: protectedProcedure
    .input(z.object({
      period: z.enum(['week', 'month', 'year']).default('month'),
    }).optional())
    .query(async ({ ctx, input }) => {
      const service = new DashboardService(ctx.db, ctx.log);
      return service.getClaimsStats(input?.period);
    }),

  serviceStats: protectedProcedure
    .query(async ({ ctx }) => {
      const service = new DashboardService(ctx.db, ctx.log);
      return service.getServiceStats();
    }),

  recentActivity: protectedProcedure
    .input(z.object({
      limit: z.number().int().min(5).max(50).default(20),
    }).optional())
    .query(async ({ ctx, input }) => {
      const service = new DashboardService(ctx.db, ctx.log);
      return service.getRecentActivity(input?.limit);
    }),
});

export type DashboardRouter = typeof dashboardRouter;
```

---

## Frontend: Dashboard UI

### src/features/dashboard/screens/DashboardScreen.tsx

```tsx
import { View, Text, ScrollView, RefreshControl, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { trpc } from '../../../lib/api';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { KPICard } from '../components/KPICard';
import { ActivityFeed } from '../components/ActivityFeed';
import { ClaimsChart } from '../components/ClaimsChart';
import { 
  FileText, 
  Wrench, 
  AlertTriangle, 
  MessageCircle,
  FileCheck,
  Users,
  TrendingUp,
  TrendingDown,
} from 'lucide-react-native';

export function DashboardScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const { data: overview, isLoading, refetch } = trpc.dashboard.overview.useQuery();
  const { data: claimsStats } = trpc.dashboard.claimsStats.useQuery();
  const { data: activity } = trpc.dashboard.recentActivity.useQuery();

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  if (isLoading) return <LoadingScreen />;

  const claimsTrend = overview 
    ? ((overview.claimsThisMonth - overview.claimsLastMonth) / (overview.claimsLastMonth || 1)) * 100
    : 0;

  return (
    <ScrollView 
      className="flex-1 bg-gray-50"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#003366" />
      }
    >
      {/* Header */}
      <View className="bg-primary pt-12 pb-8 px-4">
        <Text className="text-white text-2xl font-bold">Dashboard</Text>
        <Text className="text-white/70 mt-1">
          Oversikt over aktivitet
        </Text>
      </View>

      {/* KPI Cards */}
      <View className="px-4 -mt-4">
        <View className="flex-row flex-wrap -mx-1">
          <View className="w-1/2 px-1 mb-2">
            <KPICard
              title="Åpne reklamasjoner"
              value={overview?.openClaims ?? 0}
              icon={FileText}
              color="#3b82f6"
              trend={claimsTrend}
              onPress={() => router.push('/claims')}
            />
          </View>
          <View className="w-1/2 px-1 mb-2">
            <KPICard
              title="Installasjoner"
              value={overview?.openInstallations ?? 0}
              icon={Wrench}
              color="#8b5cf6"
              onPress={() => router.push('/installations')}
            />
          </View>
          <View className="w-1/2 px-1 mb-2">
            <KPICard
              title="Transportskader"
              value={overview?.openDamages ?? 0}
              icon={AlertTriangle}
              color="#f59e0b"
              onPress={() => router.push('/transport-damages')}
            />
          </View>
          <View className="w-1/2 px-1 mb-2">
            <KPICard
              title="Diskusjonssaker"
              value={overview?.openIssues ?? 0}
              icon={MessageCircle}
              color="#ec4899"
              onPress={() => router.push('/discussions')}
            />
          </View>
        </View>

        {/* Secondary Stats */}
        <View className="flex-row bg-white rounded-xl p-4 mt-2">
          <View className="flex-1 items-center border-r border-gray-100">
            <FileCheck size={20} color="#0d9488" />
            <Text className="text-2xl font-bold text-gray-900 mt-1">
              {overview?.activeAgreements ?? 0}
            </Text>
            <Text className="text-gray-500 text-xs">Aktive avtaler</Text>
          </View>
          <View className="flex-1 items-center">
            <Users size={20} color="#003366" />
            <Text className="text-2xl font-bold text-gray-900 mt-1">
              {overview?.activeUsers ?? 0}
            </Text>
            <Text className="text-gray-500 text-xs">Aktive brukere</Text>
          </View>
        </View>
      </View>

      {/* Claims Chart */}
      {claimsStats && (
        <View className="mx-4 mt-6">
          <Text className="text-lg font-semibold text-gray-900 mb-3">
            Reklamasjoner denne måneden
          </Text>
          <ClaimsChart data={claimsStats} />
        </View>
      )}

      {/* Top Suppliers */}
      {claimsStats?.topSuppliers && claimsStats.topSuppliers.length > 0 && (
        <View className="mx-4 mt-6">
          <Text className="text-lg font-semibold text-gray-900 mb-3">
            Topp leverandører (reklamasjoner)
          </Text>
          <View className="bg-white rounded-xl overflow-hidden">
            {claimsStats.topSuppliers.slice(0, 5).map((supplier, index) => (
              <View 
                key={supplier.supplier_name}
                className={`flex-row items-center justify-between p-3 ${
                  index < 4 ? 'border-b border-gray-100' : ''
                }`}
              >
                <View className="flex-row items-center">
                  <Text className="text-gray-400 w-6">{index + 1}.</Text>
                  <Text className="text-gray-900">{supplier.supplier_name}</Text>
                </View>
                <View className="bg-red-50 px-2 py-1 rounded">
                  <Text className="text-red-700 font-medium">
                    {supplier.claim_count}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Recent Activity */}
      <View className="mx-4 mt-6 mb-8">
        <Text className="text-lg font-semibold text-gray-900 mb-3">
          Siste aktivitet
        </Text>
        <ActivityFeed activities={activity ?? []} />
      </View>
    </ScrollView>
  );
}
```

---

### src/features/dashboard/components/KPICard.tsx

```tsx
import { View, Text, Pressable } from 'react-native';
import { TrendingUp, TrendingDown } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';

interface KPICardProps {
  title: string;
  value: number;
  icon: LucideIcon;
  color: string;
  trend?: number;
  onPress?: () => void;
}

export function KPICard({ title, value, icon: Icon, color, trend, onPress }: KPICardProps) {
  return (
    <Pressable
      onPress={onPress}
      className="bg-white rounded-xl p-4 active:bg-gray-50"
    >
      <View className="flex-row items-center justify-between">
        <View 
          className="w-10 h-10 rounded-lg items-center justify-center"
          style={{ backgroundColor: `${color}15` }}
        >
          <Icon size={20} color={color} />
        </View>
        {trend !== undefined && trend !== 0 && (
          <View className={`flex-row items-center px-1.5 py-0.5 rounded ${
            trend > 0 ? 'bg-red-50' : 'bg-green-50'
          }`}>
            {trend > 0 ? (
              <TrendingUp size={12} color="#ef4444" />
            ) : (
              <TrendingDown size={12} color="#22c55e" />
            )}
            <Text className={`text-xs ml-0.5 ${
              trend > 0 ? 'text-red-600' : 'text-green-600'
            }`}>
              {Math.abs(trend).toFixed(0)}%
            </Text>
          </View>
        )}
      </View>
      <Text className="text-3xl font-bold text-gray-900 mt-3">
        {value}
      </Text>
      <Text className="text-gray-500 text-sm mt-1">{title}</Text>
    </Pressable>
  );
}
```

---

### src/features/dashboard/components/ClaimsChart.tsx

```tsx
import { View, Text, Dimensions } from 'react-native';

interface ClaimsChartProps {
  data: {
    byStatus: Record<string, number>;
    overTime: { date: string; count: number }[];
  };
}

const STATUS_COLORS: Record<string, string> = {
  new: '#3b82f6',
  in_progress: '#eab308',
  pending_supplier: '#f97316',
  resolved: '#22c55e',
  closed: '#6b7280',
  rejected: '#ef4444',
};

const STATUS_LABELS: Record<string, string> = {
  new: 'Ny',
  in_progress: 'Pågår',
  pending_supplier: 'Venter leverandør',
  resolved: 'Løst',
  closed: 'Lukket',
  rejected: 'Avvist',
};

export function ClaimsChart({ data }: ClaimsChartProps) {
  const total = Object.values(data.byStatus).reduce((a, b) => a + b, 0);
  const screenWidth = Dimensions.get('window').width - 48;

  return (
    <View className="bg-white rounded-xl p-4">
      {/* Status Bar */}
      <View className="h-4 flex-row rounded-full overflow-hidden bg-gray-100">
        {Object.entries(data.byStatus).map(([status, count]) => {
          const percentage = total > 0 ? (count / total) * 100 : 0;
          if (percentage === 0) return null;
          return (
            <View
              key={status}
              style={{
                width: `${percentage}%`,
                backgroundColor: STATUS_COLORS[status] || '#6b7280',
              }}
            />
          );
        })}
      </View>

      {/* Legend */}
      <View className="flex-row flex-wrap mt-4">
        {Object.entries(data.byStatus).map(([status, count]) => (
          <View key={status} className="flex-row items-center mr-4 mb-2">
            <View
              className="w-3 h-3 rounded-full mr-1.5"
              style={{ backgroundColor: STATUS_COLORS[status] || '#6b7280' }}
            />
            <Text className="text-gray-600 text-sm">
              {STATUS_LABELS[status] || status}: {count}
            </Text>
          </View>
        ))}
      </View>

      {/* Simple Bar Chart */}
      {data.overTime.length > 0 && (
        <View className="mt-4 pt-4 border-t border-gray-100">
          <Text className="text-gray-500 text-sm mb-3">Siste 7 dager</Text>
          <View className="flex-row items-end justify-between h-20">
            {data.overTime.slice(-7).map((item, index) => {
              const maxCount = Math.max(...data.overTime.map(d => d.count));
              const height = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
              return (
                <View key={index} className="flex-1 items-center">
                  <View
                    className="w-6 bg-primary rounded-t"
                    style={{ height: `${Math.max(height, 5)}%` }}
                  />
                  <Text className="text-gray-400 text-xs mt-1">
                    {new Date(item.date).getDate()}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
}
```

---

### src/features/dashboard/components/ActivityFeed.tsx

```tsx
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { FileText, Wrench, AlertTriangle, MessageCircle } from 'lucide-react-native';

interface Activity {
  type: 'claim' | 'installation' | 'damage' | 'issue';
  id: string;
  title: string;
  subtitle?: string | null;
  status: string;
  createdAt: Date;
}

const TYPE_ICONS = {
  claim: FileText,
  installation: Wrench,
  damage: AlertTriangle,
  issue: MessageCircle,
};

const TYPE_COLORS = {
  claim: '#3b82f6',
  installation: '#8b5cf6',
  damage: '#f59e0b',
  issue: '#ec4899',
};

const TYPE_ROUTES = {
  claim: '/claims',
  installation: '/installations',
  damage: '/transport-damages',
  issue: '/discussions',
};

export function ActivityFeed({ activities }: { activities: Activity[] }) {
  const router = useRouter();

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return 'Nå';
    if (minutes < 60) return `${minutes} min siden`;
    if (hours < 24) return `${hours} t siden`;
    if (days < 7) return `${days} d siden`;
    return new Date(date).toLocaleDateString('nb-NO');
  };

  if (activities.length === 0) {
    return (
      <View className="bg-white rounded-xl p-6 items-center">
        <Text className="text-gray-400">Ingen nylig aktivitet</Text>
      </View>
    );
  }

  return (
    <View className="bg-white rounded-xl overflow-hidden">
      {activities.map((activity, index) => {
        const Icon = TYPE_ICONS[activity.type];
        const color = TYPE_COLORS[activity.type];
        const route = TYPE_ROUTES[activity.type];

        return (
          <Pressable
            key={`${activity.type}-${activity.id}`}
            onPress={() => router.push(`${route}/${activity.id}` as any)}
            className={`flex-row items-center p-4 active:bg-gray-50 ${
              index < activities.length - 1 ? 'border-b border-gray-100' : ''
            }`}
          >
            <View
              className="w-10 h-10 rounded-lg items-center justify-center"
              style={{ backgroundColor: `${color}15` }}
            >
              <Icon size={18} color={color} />
            </View>
            <View className="flex-1 ml-3">
              <Text className="text-gray-900 font-medium" numberOfLines={1}>
                {activity.title}
              </Text>
              {activity.subtitle && (
                <Text className="text-gray-500 text-sm" numberOfLines={1}>
                  {activity.subtitle}
                </Text>
              )}
            </View>
            <Text className="text-gray-400 text-xs">
              {formatTime(activity.createdAt)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
```

---

## Route Files

### app/(dashboard)/index.tsx

```tsx
import { DashboardScreen } from '../../src/features/dashboard/screens/DashboardScreen';

export default function HomePage() {
  return <DashboardScreen />;
}
```

---

## Oppdater AppRouter

```typescript
import { dashboardRouter } from '../modules/dashboard/dashboard.router';

export const appRouter = router({
  // ... existing
  dashboard: dashboardRouter,
});
```

---

## Sjekkliste

- [ ] dashboard.service.ts med statistikk-queries
- [ ] dashboard.router.ts
- [ ] DashboardScreen med layout
- [ ] KPICard komponent
- [ ] ClaimsChart med status-bar
- [ ] ActivityFeed komponent
- [ ] Tab navigation - Dashboard som startside
- [ ] Pull-to-refresh fungerer

---

## Neste fase

Gå til **FASE 28: Testing (Unit/Integration/E2E)**.
