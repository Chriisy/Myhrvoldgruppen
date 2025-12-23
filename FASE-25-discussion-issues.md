# FASE 25: Discussion Issues API + UI

> Fase 1-24 må være fullført.
> Estimert tid: ~45 minutter.

## Mål

Implementer diskusjonssaker for leverandørkommunikasjon (Outlook-integrasjon).

---

## Backend: Discussion Issues Module

### apps/api/src/modules/discussion-issues/discussion-issues.policy.ts

```typescript
import type { User } from '../../trpc/context';

export const DiscussionIssuePermissions = {
  list: ['super_admin', 'admin', 'leder', 'service', 'tekniker', 'viewer'],
  read: ['super_admin', 'admin', 'leder', 'service', 'tekniker', 'viewer'],
  create: ['super_admin', 'admin', 'leder', 'service'],
  update: ['super_admin', 'admin', 'leder', 'service'],
  delete: ['super_admin', 'admin'],
  assign: ['super_admin', 'admin', 'leder'],
} as const;

type Action = keyof typeof DiscussionIssuePermissions;

export function canPerform(user: User, action: Action): boolean {
  return DiscussionIssuePermissions[action].includes(user.role as any);
}

export function assertCan(user: User, action: Action): void {
  if (!canPerform(user, action)) {
    throw new Error(`Ingen tilgang til ${action} diskusjonssak`);
  }
}
```

---

### apps/api/src/modules/discussion-issues/discussion-issues.repo.ts

```typescript
import { eq, ilike, or, and, isNull, desc, SQL, sql } from 'drizzle-orm';
import type { Database } from '../../lib/db';
import { discussionIssues, suppliers, users } from '@myhrvold/db/schema';

interface ListParams {
  page: number;
  limit: number;
  search?: string;
  status?: string;
  category?: string;
  supplierId?: string;
  assignedToId?: string;
  priority?: string;
}

export class DiscussionIssuesRepository {
  constructor(private db: Database) {}

  async findMany(params: ListParams) {
    const { page, limit, search, status, category, supplierId, assignedToId, priority } = params;
    const offset = (page - 1) * limit;

    const conditions: SQL[] = [isNull(discussionIssues.deletedAt)];

    if (search) {
      conditions.push(
        or(
          ilike(discussionIssues.issueNumber, `%${search}%`),
          ilike(discussionIssues.subject, `%${search}%`),
          ilike(discussionIssues.description, `%${search}%`)
        )!
      );
    }

    if (status) conditions.push(eq(discussionIssues.status, status));
    if (category) conditions.push(eq(discussionIssues.category, category));
    if (supplierId) conditions.push(eq(discussionIssues.supplierId, supplierId));
    if (assignedToId) conditions.push(eq(discussionIssues.assignedToId, assignedToId));
    if (priority) conditions.push(eq(discussionIssues.priority, priority));

    return this.db.query.discussionIssues.findMany({
      where: and(...conditions),
      with: {
        supplier: {
          columns: { id: true, name: true, shortCode: true },
        },
        assignedTo: {
          columns: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: [desc(discussionIssues.createdAt)],
      limit,
      offset,
    });
  }

  async findById(id: string) {
    return this.db.query.discussionIssues.findFirst({
      where: and(eq(discussionIssues.id, id), isNull(discussionIssues.deletedAt)),
      with: {
        supplier: true,
        assignedTo: {
          columns: { id: true, firstName: true, lastName: true, email: true },
        },
        createdBy: {
          columns: { id: true, firstName: true, lastName: true },
        },
      },
    });
  }

  async create(data: typeof discussionIssues.$inferInsert) {
    const [result] = await this.db.insert(discussionIssues).values(data).returning();
    return result;
  }

  async update(id: string, data: Partial<typeof discussionIssues.$inferInsert>) {
    const [result] = await this.db
      .update(discussionIssues)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(discussionIssues.id, id))
      .returning();
    return result;
  }

  async softDelete(id: string) {
    const [result] = await this.db
      .update(discussionIssues)
      .set({ deletedAt: new Date() })
      .where(eq(discussionIssues.id, id))
      .returning();
    return result;
  }

  async count(params: Omit<ListParams, 'page' | 'limit'>) {
    const { search, status, category, supplierId, priority } = params;
    const conditions: SQL[] = [isNull(discussionIssues.deletedAt)];

    if (search) {
      conditions.push(
        or(
          ilike(discussionIssues.issueNumber, `%${search}%`),
          ilike(discussionIssues.subject, `%${search}%`)
        )!
      );
    }

    if (status) conditions.push(eq(discussionIssues.status, status));
    if (category) conditions.push(eq(discussionIssues.category, category));
    if (supplierId) conditions.push(eq(discussionIssues.supplierId, supplierId));
    if (priority) conditions.push(eq(discussionIssues.priority, priority));

    const result = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(discussionIssues)
      .where(and(...conditions));

    return result[0]?.count ?? 0;
  }

  async generateIssueNumber() {
    const year = new Date().getFullYear();
    const prefix = `DI-${year}`;

    const lastIssue = await this.db.query.discussionIssues.findFirst({
      where: ilike(discussionIssues.issueNumber, `${prefix}%`),
      orderBy: [desc(discussionIssues.issueNumber)],
    });

    let sequence = 1;
    if (lastIssue?.issueNumber) {
      const lastSequence = parseInt(lastIssue.issueNumber.slice(-4), 10);
      sequence = lastSequence + 1;
    }

    return `${prefix}-${sequence.toString().padStart(4, '0')}`;
  }

  async getStats() {
    const result = await this.db
      .select({
        status: discussionIssues.status,
        count: sql<number>`count(*)`,
      })
      .from(discussionIssues)
      .where(isNull(discussionIssues.deletedAt))
      .groupBy(discussionIssues.status);

    return result.reduce((acc, row) => {
      acc[row.status] = row.count;
      return acc;
    }, {} as Record<string, number>);
  }

  async getCategories() {
    const result = await this.db
      .selectDistinct({ category: discussionIssues.category })
      .from(discussionIssues)
      .where(and(isNull(discussionIssues.deletedAt), sql`${discussionIssues.category} IS NOT NULL`));

    return result.map(r => r.category).filter(Boolean) as string[];
  }
}
```

---

### apps/api/src/modules/discussion-issues/discussion-issues.service.ts

```typescript
import { TRPCError } from '@trpc/server';
import type { Database } from '../../lib/db';
import type { Logger } from 'pino';
import { DiscussionIssuesRepository } from './discussion-issues.repo';

interface CreateIssueInput {
  supplierId: string;
  subject: string;
  description: string;
  category?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  assignedToId?: string;
  relatedClaimId?: string;
  relatedInstallationId?: string;
  outlookConversationId?: string;
  dueDate?: Date;
}

export class DiscussionIssuesService {
  private repo: DiscussionIssuesRepository;

  constructor(
    private db: Database,
    private log: Logger
  ) {
    this.repo = new DiscussionIssuesRepository(db);
  }

  async list(params: {
    page: number;
    limit: number;
    search?: string;
    status?: string;
    category?: string;
    supplierId?: string;
    assignedToId?: string;
    priority?: string;
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
    const issue = await this.repo.findById(id);
    if (!issue) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Diskusjonssak ikke funnet',
      });
    }
    return issue;
  }

  async create(input: CreateIssueInput, userId: string) {
    const issueNumber = await this.repo.generateIssueNumber();

    const issue = await this.repo.create({
      ...input,
      issueNumber,
      status: 'open',
      createdById: userId,
    });

    this.log.info({ issueId: issue.id, issueNumber }, 'Discussion issue created');
    return issue;
  }

  async update(id: string, input: Partial<CreateIssueInput>, userId: string) {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Diskusjonssak ikke funnet',
      });
    }

    const issue = await this.repo.update(id, {
      ...input,
      updatedById: userId,
    });

    this.log.info({ issueId: id }, 'Discussion issue updated');
    return issue;
  }

  async updateStatus(id: string, status: string, resolution?: string, userId?: string) {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Diskusjonssak ikke funnet',
      });
    }

    const updates: Record<string, any> = {
      status,
      updatedById: userId,
    };

    if ((status === 'resolved' || status === 'closed') && resolution) {
      updates.resolution = resolution;
      updates.resolvedAt = new Date();
    }

    const issue = await this.repo.update(id, updates);
    this.log.info({ issueId: id, status }, 'Discussion issue status updated');
    return issue;
  }

  async assign(id: string, assignedToId: string, userId: string) {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Diskusjonssak ikke funnet',
      });
    }

    const issue = await this.repo.update(id, {
      assignedToId,
      updatedById: userId,
    });

    this.log.info({ issueId: id, assignedToId }, 'Discussion issue assigned');
    return issue;
  }

  async delete(id: string) {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Diskusjonssak ikke funnet',
      });
    }

    await this.repo.softDelete(id);
    this.log.info({ issueId: id }, 'Discussion issue deleted');
    return { success: true };
  }

  async getStats() {
    return this.repo.getStats();
  }

  async getCategories() {
    return this.repo.getCategories();
  }
}
```

---

### apps/api/src/modules/discussion-issues/discussion-issues.router.ts

```typescript
import { z } from 'zod';
import { router, protectedProcedure } from '../../trpc/trpc';
import { DiscussionIssuesService } from './discussion-issues.service';
import { assertCan } from './discussion-issues.policy';

const createInput = z.object({
  supplierId: z.string().uuid(),
  subject: z.string().min(1, 'Emne er påkrevd'),
  description: z.string().min(1, 'Beskrivelse er påkrevd'),
  category: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  assignedToId: z.string().uuid().optional(),
  relatedClaimId: z.string().uuid().optional(),
  relatedInstallationId: z.string().uuid().optional(),
  outlookConversationId: z.string().optional(),
  dueDate: z.coerce.date().optional(),
});

const statusEnum = z.enum([
  'open',
  'in_progress',
  'awaiting_response',
  'resolved',
  'closed',
]);

export const discussionIssuesRouter = router({
  list: protectedProcedure
    .input(z.object({
      page: z.number().int().min(1).default(1),
      limit: z.number().int().min(1).max(100).default(20),
      search: z.string().optional(),
      status: z.string().optional(),
      category: z.string().optional(),
      supplierId: z.string().uuid().optional(),
      assignedToId: z.string().uuid().optional(),
      priority: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      assertCan(ctx.user, 'list');
      const service = new DiscussionIssuesService(ctx.db, ctx.log);
      return service.list(input);
    }),

  byId: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      assertCan(ctx.user, 'read');
      const service = new DiscussionIssuesService(ctx.db, ctx.log);
      return service.getById(input.id);
    }),

  create: protectedProcedure
    .input(createInput)
    .mutation(async ({ ctx, input }) => {
      assertCan(ctx.user, 'create');
      const service = new DiscussionIssuesService(ctx.db, ctx.log);
      return service.create(input, ctx.user.id);
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      data: createInput.partial(),
    }))
    .mutation(async ({ ctx, input }) => {
      assertCan(ctx.user, 'update');
      const service = new DiscussionIssuesService(ctx.db, ctx.log);
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
      const service = new DiscussionIssuesService(ctx.db, ctx.log);
      return service.updateStatus(input.id, input.status, input.resolution, ctx.user.id);
    }),

  assign: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      assignedToId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      assertCan(ctx.user, 'assign');
      const service = new DiscussionIssuesService(ctx.db, ctx.log);
      return service.assign(input.id, input.assignedToId, ctx.user.id);
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      assertCan(ctx.user, 'delete');
      const service = new DiscussionIssuesService(ctx.db, ctx.log);
      return service.delete(input.id);
    }),

  stats: protectedProcedure
    .query(async ({ ctx }) => {
      assertCan(ctx.user, 'list');
      const service = new DiscussionIssuesService(ctx.db, ctx.log);
      return service.getStats();
    }),

  categories: protectedProcedure
    .query(async ({ ctx }) => {
      assertCan(ctx.user, 'list');
      const service = new DiscussionIssuesService(ctx.db, ctx.log);
      return service.getCategories();
    }),
});

export type DiscussionIssuesRouter = typeof discussionIssuesRouter;
```

---

## Frontend: Discussion Issues UI

### src/features/discussions/components/IssueCard.tsx

```tsx
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { MessageCircle, User, Calendar, ChevronRight } from 'lucide-react-native';
import { IssueStatusBadge } from './IssueStatusBadge';
import { PriorityBadge } from './PriorityBadge';

interface Issue {
  id: string;
  issueNumber: string;
  subject: string;
  status: string;
  priority: string;
  createdAt: Date;
  supplier?: { name: string } | null;
  assignedTo?: { firstName?: string | null; lastName?: string | null } | null;
}

export function IssueCard({ issue }: { issue: Issue }) {
  const router = useRouter();

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('nb-NO', {
      day: '2-digit',
      month: 'short',
    });
  };

  return (
    <Pressable
      onPress={() => router.push(`/discussions/${issue.id}`)}
      className="bg-white p-4 rounded-xl mb-3 border border-gray-100 active:bg-gray-50"
    >
      <View className="flex-row items-start justify-between">
        <View className="flex-1">
          <View className="flex-row items-center gap-2 mb-1">
            <Text className="text-purple-600 font-bold">{issue.issueNumber}</Text>
            <IssueStatusBadge status={issue.status} />
            <PriorityBadge priority={issue.priority} />
          </View>

          <Text className="text-gray-900 font-medium" numberOfLines={2}>
            {issue.subject}
          </Text>

          <Text className="text-gray-500 text-sm mt-1">
            {issue.supplier?.name}
          </Text>

          <View className="flex-row items-center mt-2 gap-4">
            {issue.assignedTo && (
              <View className="flex-row items-center">
                <User size={12} color="#9ca3af" />
                <Text className="text-gray-400 text-xs ml-1">
                  {issue.assignedTo.firstName} {issue.assignedTo.lastName}
                </Text>
              </View>
            )}
            <View className="flex-row items-center">
              <Calendar size={12} color="#9ca3af" />
              <Text className="text-gray-400 text-xs ml-1">
                {formatDate(issue.createdAt)}
              </Text>
            </View>
          </View>
        </View>
        <ChevronRight size={20} color="#9ca3af" />
      </View>
    </Pressable>
  );
}
```

---

### src/features/discussions/components/PriorityBadge.tsx

```tsx
import { View, Text } from 'react-native';

const PRIORITY_COLORS = {
  low: { bg: 'bg-gray-100', text: 'text-gray-600' },
  medium: { bg: 'bg-blue-100', text: 'text-blue-600' },
  high: { bg: 'bg-orange-100', text: 'text-orange-600' },
  urgent: { bg: 'bg-red-100', text: 'text-red-600' },
} as const;

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Lav',
  medium: 'Medium',
  high: 'Høy',
  urgent: 'Haster',
};

export function PriorityBadge({ priority }: { priority: string }) {
  const colors = PRIORITY_COLORS[priority as keyof typeof PRIORITY_COLORS] || PRIORITY_COLORS.medium;

  return (
    <View className={`px-2 py-0.5 rounded ${colors.bg}`}>
      <Text className={`text-xs font-medium ${colors.text}`}>
        {PRIORITY_LABELS[priority] || priority}
      </Text>
    </View>
  );
}
```

---

### src/features/discussions/components/IssueStatusBadge.tsx

```tsx
import { View, Text } from 'react-native';

const STATUS_COLORS = {
  open: { bg: 'bg-purple-100', text: 'text-purple-700' },
  in_progress: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  awaiting_response: { bg: 'bg-blue-100', text: 'text-blue-700' },
  resolved: { bg: 'bg-green-100', text: 'text-green-700' },
  closed: { bg: 'bg-gray-100', text: 'text-gray-700' },
} as const;

const STATUS_LABELS: Record<string, string> = {
  open: 'Åpen',
  in_progress: 'Under arbeid',
  awaiting_response: 'Venter svar',
  resolved: 'Løst',
  closed: 'Lukket',
};

export function IssueStatusBadge({ status }: { status: string }) {
  const colors = STATUS_COLORS[status as keyof typeof STATUS_COLORS] || STATUS_COLORS.open;

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

## Oppdater AppRouter

```typescript
import { discussionIssuesRouter } from '../modules/discussion-issues/discussion-issues.router';

export const appRouter = router({
  // ... existing
  discussionIssues: discussionIssuesRouter,
});
```

---

## Sjekkliste

- [ ] discussion-issues.policy.ts
- [ ] discussion-issues.repo.ts
- [ ] discussion-issues.service.ts
- [ ] discussion-issues.router.ts
- [ ] IssueCard komponent
- [ ] IssueStatusBadge
- [ ] PriorityBadge
- [ ] DiscussionsListScreen
- [ ] IssueDetailScreen
- [ ] AppRouter oppdatert

---

## Neste fase

Gå til **FASE 26: Admin Panel (Users/Roles)**.
