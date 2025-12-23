# FASE 26: Admin Panel (Users/Roles/Departments)

> Fase 1-25 må være fullført.
> Estimert tid: ~60 minutter.

## Mål

Implementer brukeradministrasjon med roller, avdelinger og tilganger.

---

## Backend: Users Module

### apps/api/src/modules/users/users.policy.ts

```typescript
import type { User } from '../../trpc/context';

export const UserPermissions = {
  list: ['super_admin', 'admin', 'leder'],
  read: ['super_admin', 'admin', 'leder'],
  create: ['super_admin', 'admin'],
  update: ['super_admin', 'admin'],
  delete: ['super_admin'],
  changeRole: ['super_admin'],
  resetPassword: ['super_admin', 'admin'],
} as const;

type Action = keyof typeof UserPermissions;

export function canPerform(user: User, action: Action): boolean {
  return UserPermissions[action].includes(user.role as any);
}

export function assertCan(user: User, action: Action): void {
  if (!canPerform(user, action)) {
    throw new Error(`Ingen tilgang til ${action} bruker`);
  }
}

// Prevent role escalation
export function canAssignRole(currentUser: User, targetRole: string): boolean {
  const roleHierarchy = ['viewer', 'tekniker', 'service', 'leder', 'admin', 'super_admin'];
  const currentLevel = roleHierarchy.indexOf(currentUser.role);
  const targetLevel = roleHierarchy.indexOf(targetRole);
  
  // Can only assign roles lower than own level
  return currentLevel > targetLevel;
}
```

---

### apps/api/src/modules/users/users.repo.ts

```typescript
import { eq, ilike, or, and, isNull, desc, asc, SQL, sql } from 'drizzle-orm';
import type { Database } from '../../lib/db';
import { users, departments } from '@myhrvold/db/schema';

interface ListParams {
  page: number;
  limit: number;
  search?: string;
  role?: string;
  departmentId?: string;
  isActive?: boolean;
}

export class UsersRepository {
  constructor(private db: Database) {}

  async findMany(params: ListParams) {
    const { page, limit, search, role, departmentId, isActive } = params;
    const offset = (page - 1) * limit;

    const conditions: SQL[] = [isNull(users.deletedAt)];

    if (search) {
      conditions.push(
        or(
          ilike(users.email, `%${search}%`),
          ilike(users.firstName, `%${search}%`),
          ilike(users.lastName, `%${search}%`),
          ilike(users.employeeNumber, `%${search}%`)
        )!
      );
    }

    if (role) conditions.push(eq(users.role, role));
    if (departmentId) conditions.push(eq(users.departmentId, departmentId));
    if (isActive !== undefined) conditions.push(eq(users.isActive, isActive));

    return this.db.query.users.findMany({
      where: and(...conditions),
      columns: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        departmentId: true,
        employeeNumber: true,
        phone: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
      },
      with: {
        department: {
          columns: { id: true, name: true },
        },
      },
      orderBy: [asc(users.firstName), asc(users.lastName)],
      limit,
      offset,
    });
  }

  async findById(id: string) {
    return this.db.query.users.findFirst({
      where: and(eq(users.id, id), isNull(users.deletedAt)),
      columns: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        departmentId: true,
        employeeNumber: true,
        phone: true,
        avatarUrl: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
      with: {
        department: true,
      },
    });
  }

  async findByEmail(email: string) {
    return this.db.query.users.findFirst({
      where: and(eq(users.email, email.toLowerCase()), isNull(users.deletedAt)),
    });
  }

  async create(data: typeof users.$inferInsert) {
    const [result] = await this.db.insert(users).values({
      ...data,
      email: data.email.toLowerCase(),
    }).returning();
    return result;
  }

  async update(id: string, data: Partial<typeof users.$inferInsert>) {
    const [result] = await this.db
      .update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return result;
  }

  async softDelete(id: string) {
    const [result] = await this.db
      .update(users)
      .set({ deletedAt: new Date(), isActive: false })
      .where(eq(users.id, id))
      .returning();
    return result;
  }

  async count(params: Omit<ListParams, 'page' | 'limit'>) {
    const { search, role, departmentId, isActive } = params;
    const conditions: SQL[] = [isNull(users.deletedAt)];

    if (search) {
      conditions.push(
        or(
          ilike(users.email, `%${search}%`),
          ilike(users.firstName, `%${search}%`),
          ilike(users.lastName, `%${search}%`)
        )!
      );
    }

    if (role) conditions.push(eq(users.role, role));
    if (departmentId) conditions.push(eq(users.departmentId, departmentId));
    if (isActive !== undefined) conditions.push(eq(users.isActive, isActive));

    const result = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(and(...conditions));

    return result[0]?.count ?? 0;
  }

  async getRoleStats() {
    const result = await this.db
      .select({
        role: users.role,
        count: sql<number>`count(*)`,
      })
      .from(users)
      .where(and(isNull(users.deletedAt), eq(users.isActive, true)))
      .groupBy(users.role);

    return result.reduce((acc, row) => {
      acc[row.role] = row.count;
      return acc;
    }, {} as Record<string, number>);
  }
}
```

---

### apps/api/src/modules/users/users.service.ts

```typescript
import { TRPCError } from '@trpc/server';
import { hash } from 'bcrypt';
import type { Database } from '../../lib/db';
import type { Logger } from 'pino';
import { UsersRepository } from './users.repo';
import { canAssignRole } from './users.policy';
import type { User } from '../../trpc/context';

interface CreateUserInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: string;
  departmentId?: string;
  employeeNumber?: string;
  phone?: string;
}

interface UpdateUserInput {
  firstName?: string;
  lastName?: string;
  role?: string;
  departmentId?: string;
  employeeNumber?: string;
  phone?: string;
  isActive?: boolean;
}

export class UsersService {
  private repo: UsersRepository;

  constructor(
    private db: Database,
    private log: Logger
  ) {
    this.repo = new UsersRepository(db);
  }

  async list(params: {
    page: number;
    limit: number;
    search?: string;
    role?: string;
    departmentId?: string;
    isActive?: boolean;
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
    const user = await this.repo.findById(id);
    if (!user) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Bruker ikke funnet',
      });
    }
    return user;
  }

  async create(input: CreateUserInput, currentUser: User) {
    // Sjekk at e-post ikke er i bruk
    const existing = await this.repo.findByEmail(input.email);
    if (existing) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'E-postadressen er allerede i bruk',
      });
    }

    // Sjekk rolle-tildeling
    if (!canAssignRole(currentUser, input.role)) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Du kan ikke tildele denne rollen',
      });
    }

    const passwordHash = await hash(input.password, 12);

    const user = await this.repo.create({
      ...input,
      passwordHash,
      createdById: currentUser.id,
    });

    this.log.info({ userId: user.id, email: input.email }, 'User created');
    return user;
  }

  async update(id: string, input: UpdateUserInput, currentUser: User) {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Bruker ikke funnet',
      });
    }

    // Sjekk rolle-endring
    if (input.role && input.role !== existing.role) {
      if (!canAssignRole(currentUser, input.role)) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Du kan ikke tildele denne rollen',
        });
      }
    }

    const user = await this.repo.update(id, {
      ...input,
      updatedById: currentUser.id,
    });

    this.log.info({ userId: id }, 'User updated');
    return user;
  }

  async resetPassword(id: string, newPassword: string, currentUser: User) {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Bruker ikke funnet',
      });
    }

    const passwordHash = await hash(newPassword, 12);

    await this.repo.update(id, {
      passwordHash,
      updatedById: currentUser.id,
    });

    this.log.info({ userId: id, by: currentUser.id }, 'User password reset');
    return { success: true };
  }

  async toggleActive(id: string, isActive: boolean, currentUser: User) {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Bruker ikke funnet',
      });
    }

    // Kan ikke deaktivere seg selv
    if (id === currentUser.id && !isActive) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Du kan ikke deaktivere din egen konto',
      });
    }

    const user = await this.repo.update(id, {
      isActive,
      updatedById: currentUser.id,
    });

    this.log.info({ userId: id, isActive }, 'User active status changed');
    return user;
  }

  async delete(id: string, currentUser: User) {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Bruker ikke funnet',
      });
    }

    // Kan ikke slette seg selv
    if (id === currentUser.id) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Du kan ikke slette din egen konto',
      });
    }

    await this.repo.softDelete(id);
    this.log.info({ userId: id }, 'User deleted');
    return { success: true };
  }

  async getRoleStats() {
    return this.repo.getRoleStats();
  }
}
```

---

### apps/api/src/modules/users/users.router.ts

```typescript
import { z } from 'zod';
import { router, protectedProcedure } from '../../trpc/trpc';
import { UsersService } from './users.service';
import { assertCan } from './users.policy';

const roleEnum = z.enum([
  'super_admin',
  'admin',
  'leder',
  'service',
  'tekniker',
  'viewer',
]);

const createInput = z.object({
  email: z.string().email('Ugyldig e-postadresse'),
  password: z.string().min(8, 'Passord må være minst 8 tegn'),
  firstName: z.string().min(1, 'Fornavn er påkrevd'),
  lastName: z.string().min(1, 'Etternavn er påkrevd'),
  role: roleEnum,
  departmentId: z.string().uuid().optional(),
  employeeNumber: z.string().optional(),
  phone: z.string().optional(),
});

const updateInput = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  role: roleEnum.optional(),
  departmentId: z.string().uuid().nullable().optional(),
  employeeNumber: z.string().optional(),
  phone: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const usersRouter = router({
  list: protectedProcedure
    .input(z.object({
      page: z.number().int().min(1).default(1),
      limit: z.number().int().min(1).max(100).default(20),
      search: z.string().optional(),
      role: z.string().optional(),
      departmentId: z.string().uuid().optional(),
      isActive: z.boolean().optional(),
    }))
    .query(async ({ ctx, input }) => {
      assertCan(ctx.user, 'list');
      const service = new UsersService(ctx.db, ctx.log);
      return service.list(input);
    }),

  byId: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      assertCan(ctx.user, 'read');
      const service = new UsersService(ctx.db, ctx.log);
      return service.getById(input.id);
    }),

  create: protectedProcedure
    .input(createInput)
    .mutation(async ({ ctx, input }) => {
      assertCan(ctx.user, 'create');
      const service = new UsersService(ctx.db, ctx.log);
      return service.create(input, ctx.user);
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      data: updateInput,
    }))
    .mutation(async ({ ctx, input }) => {
      assertCan(ctx.user, 'update');
      const service = new UsersService(ctx.db, ctx.log);
      return service.update(input.id, input.data, ctx.user);
    }),

  resetPassword: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      newPassword: z.string().min(8),
    }))
    .mutation(async ({ ctx, input }) => {
      assertCan(ctx.user, 'resetPassword');
      const service = new UsersService(ctx.db, ctx.log);
      return service.resetPassword(input.id, input.newPassword, ctx.user);
    }),

  toggleActive: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      isActive: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      assertCan(ctx.user, 'update');
      const service = new UsersService(ctx.db, ctx.log);
      return service.toggleActive(input.id, input.isActive, ctx.user);
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      assertCan(ctx.user, 'delete');
      const service = new UsersService(ctx.db, ctx.log);
      return service.delete(input.id, ctx.user);
    }),

  roleStats: protectedProcedure
    .query(async ({ ctx }) => {
      assertCan(ctx.user, 'list');
      const service = new UsersService(ctx.db, ctx.log);
      return service.getRoleStats();
    }),

  roles: protectedProcedure
    .query(() => {
      return [
        { value: 'super_admin', label: 'Super Admin', description: 'Full tilgang' },
        { value: 'admin', label: 'Administrator', description: 'Administrasjonstilgang' },
        { value: 'leder', label: 'Leder', description: 'Avdelingsleder' },
        { value: 'service', label: 'Service', description: 'Servicekoordinator' },
        { value: 'tekniker', label: 'Tekniker', description: 'Felttekniker' },
        { value: 'viewer', label: 'Leser', description: 'Kun lesetilgang' },
      ];
    }),
});

export type UsersRouter = typeof usersRouter;
```

---

## Backend: Departments Module

### apps/api/src/modules/departments/departments.router.ts

```typescript
import { z } from 'zod';
import { router, protectedProcedure } from '../../trpc/trpc';
import { eq, isNull, asc, sql, and } from 'drizzle-orm';
import { departments } from '@myhrvold/db/schema';

export const departmentsRouter = router({
  list: protectedProcedure
    .query(async ({ ctx }) => {
      return ctx.db.query.departments.findMany({
        where: isNull(departments.deletedAt),
        orderBy: [asc(departments.name)],
      });
    }),

  byId: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.departments.findFirst({
        where: and(eq(departments.id, input.id), isNull(departments.deletedAt)),
        with: {
          users: {
            where: isNull(departments.deletedAt),
            columns: { id: true, firstName: true, lastName: true, role: true },
          },
        },
      });
    }),

  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      code: z.string().min(1).max(10),
      description: z.string().optional(),
      region: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [result] = await ctx.db.insert(departments).values({
        ...input,
        createdById: ctx.user.id,
      }).returning();
      return result;
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      data: z.object({
        name: z.string().min(1).optional(),
        code: z.string().min(1).max(10).optional(),
        description: z.string().optional(),
        region: z.string().optional(),
        isActive: z.boolean().optional(),
      }),
    }))
    .mutation(async ({ ctx, input }) => {
      const [result] = await ctx.db
        .update(departments)
        .set({ ...input.data, updatedAt: new Date() })
        .where(eq(departments.id, input.id))
        .returning();
      return result;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(departments)
        .set({ deletedAt: new Date() })
        .where(eq(departments.id, input.id));
      return { success: true };
    }),
});

export type DepartmentsRouter = typeof departmentsRouter;
```

---

## Frontend: Users Admin UI

### src/features/users/components/UserCard.tsx

```tsx
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { User as UserIcon, Mail, Phone, ChevronRight } from 'lucide-react-native';
import { RoleBadge } from './RoleBadge';

interface User {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  role: string;
  isActive: boolean;
  department?: { name: string } | null;
  lastLoginAt?: Date | null;
}

export function UserCard({ user }: { user: User }) {
  const router = useRouter();

  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email;

  return (
    <Pressable
      onPress={() => router.push(`/admin/users/${user.id}`)}
      className="bg-white p-4 rounded-xl mb-3 border border-gray-100 active:bg-gray-50"
    >
      <View className="flex-row items-center">
        <View className={`w-12 h-12 rounded-full items-center justify-center ${
          user.isActive ? 'bg-primary/10' : 'bg-gray-100'
        }`}>
          <UserIcon size={24} color={user.isActive ? '#003366' : '#9ca3af'} />
        </View>
        
        <View className="ml-3 flex-1">
          <View className="flex-row items-center gap-2">
            <Text className={`font-semibold ${user.isActive ? 'text-gray-900' : 'text-gray-400'}`}>
              {fullName}
            </Text>
            {!user.isActive && (
              <View className="px-1.5 py-0.5 bg-gray-100 rounded">
                <Text className="text-gray-500 text-xs">Inaktiv</Text>
              </View>
            )}
          </View>
          
          <Text className="text-gray-500 text-sm">{user.email}</Text>
          
          <View className="flex-row items-center mt-1 gap-2">
            <RoleBadge role={user.role} />
            {user.department && (
              <Text className="text-gray-400 text-xs">{user.department.name}</Text>
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

### src/features/users/components/RoleBadge.tsx

```tsx
import { View, Text } from 'react-native';

const ROLE_COLORS = {
  super_admin: { bg: 'bg-red-100', text: 'text-red-700' },
  admin: { bg: 'bg-purple-100', text: 'text-purple-700' },
  leder: { bg: 'bg-blue-100', text: 'text-blue-700' },
  service: { bg: 'bg-teal-100', text: 'text-teal-700' },
  tekniker: { bg: 'bg-green-100', text: 'text-green-700' },
  viewer: { bg: 'bg-gray-100', text: 'text-gray-600' },
} as const;

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Administrator',
  leder: 'Leder',
  service: 'Service',
  tekniker: 'Tekniker',
  viewer: 'Leser',
};

export function RoleBadge({ role }: { role: string }) {
  const colors = ROLE_COLORS[role as keyof typeof ROLE_COLORS] || ROLE_COLORS.viewer;

  return (
    <View className={`px-2 py-0.5 rounded ${colors.bg}`}>
      <Text className={`text-xs font-medium ${colors.text}`}>
        {ROLE_LABELS[role] || role}
      </Text>
    </View>
  );
}
```

---

### src/features/users/screens/UsersListScreen.tsx

```tsx
import { View, Text, FlatList, RefreshControl, TextInput, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { trpc } from '../../../lib/api';
import { UserCard } from '../components/UserCard';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { ErrorView } from '../../../components/ErrorView';
import { Search, Plus, Users } from 'lucide-react-native';

export function UsersListScreen() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);

  const { 
    data, 
    isLoading, 
    error, 
    refetch,
    isRefetching,
  } = trpc.users.list.useQuery({ 
    page: 1, 
    limit: 100,
    search: search || undefined,
    isActive: showInactive ? undefined : true,
  });

  const { data: roleStats } = trpc.users.roleStats.useQuery();

  if (isLoading) return <LoadingScreen />;
  if (error) return <ErrorView error={error} onRetry={refetch} />;

  const totalActive = roleStats 
    ? Object.values(roleStats).reduce((a, b) => a + b, 0)
    : 0;

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-primary pt-12 pb-6 px-4">
        <View className="flex-row items-center justify-between mb-4">
          <View className="flex-row items-center">
            <Users size={24} color="white" />
            <Text className="text-white text-2xl font-bold ml-2">Brukere</Text>
            <View className="ml-2 bg-white/20 px-2 py-0.5 rounded-full">
              <Text className="text-white text-sm">{totalActive}</Text>
            </View>
          </View>
          <Pressable
            onPress={() => router.push('/admin/users/new')}
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
            placeholder="Søk brukere..."
            placeholderTextColor="rgba(255,255,255,0.5)"
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </View>

      {/* Filter */}
      <View className="bg-white px-4 py-3 border-b border-gray-100">
        <Pressable 
          onPress={() => setShowInactive(!showInactive)}
          className="flex-row items-center"
        >
          <View className={`w-5 h-5 rounded border mr-2 items-center justify-center ${
            showInactive ? 'bg-primary border-primary' : 'border-gray-300'
          }`}>
            {showInactive && <Text className="text-white text-xs">✓</Text>}
          </View>
          <Text className="text-gray-600 text-sm">Vis inaktive brukere</Text>
        </Pressable>
      </View>

      {/* List */}
      <FlatList
        data={data?.items ?? []}
        renderItem={({ item }) => <UserCard user={item} />}
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
            <Users size={48} color="#d1d5db" />
            <Text className="text-gray-500 mt-2">Ingen brukere funnet</Text>
          </View>
        }
      />
    </View>
  );
}
```

---

## Route Files

### app/(dashboard)/admin/users/index.tsx

```tsx
import { UsersListScreen } from '../../../../src/features/users/screens/UsersListScreen';

export default function UsersPage() {
  return <UsersListScreen />;
}
```

### app/(dashboard)/admin/users/new.tsx

```tsx
import { useRouter } from 'expo-router';
import { trpc } from '../../../../src/lib/api';
import { UserForm } from '../../../../src/features/users/components/UserForm';

export default function NewUserPage() {
  const router = useRouter();
  const utils = trpc.useUtils();

  const createMutation = trpc.users.create.useMutation({
    onSuccess: () => {
      utils.users.list.invalidate();
      router.back();
    },
  });

  return (
    <UserForm
      onSubmit={(data) => createMutation.mutate(data)}
      isLoading={createMutation.isPending}
    />
  );
}
```

---

## Oppdater AppRouter

```typescript
import { usersRouter } from '../modules/users/users.router';
import { departmentsRouter } from '../modules/departments/departments.router';

export const appRouter = router({
  // ... existing
  users: usersRouter,
  departments: departmentsRouter,
});
```

---

## Sjekkliste

- [ ] users.policy.ts med rolle-hierarki
- [ ] users.repo.ts
- [ ] users.service.ts med passordhåndtering
- [ ] users.router.ts
- [ ] departments.router.ts
- [ ] UserCard komponent
- [ ] RoleBadge komponent
- [ ] UsersListScreen
- [ ] UserDetailScreen
- [ ] UserForm med rolle-velger
- [ ] AppRouter oppdatert

---

## Neste fase

Gå til **FASE 27: Dashboard + KPI + Statistikk**.
