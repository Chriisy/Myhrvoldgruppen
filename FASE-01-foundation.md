# FASE 1: Database Foundation

> Denne fasen setter opp grunnstrukturen for hele prosjektet.
> Estimert tid: ~20 minutter.

## Mål

- Sett opp monorepo med Turborepo
- Opprett packages/db med Drizzle ORM
- Opprett packages/shared for delte typer og schemas
- Implementer soft delete og timestamps fra start

---

## Monorepo Struktur

```
myhrvoldgruppen-service/
├── apps/
│   ├── api/                 # Fastify + tRPC (FASE 8+)
│   └── mobile/              # Expo Router (FASE 11+)
├── packages/
│   ├── db/                  # Drizzle ORM schemas
│   ├── shared/              # Zod schemas, typer, konstanter
│   └── ui/                  # Delte React Native komponenter
├── turbo.json
├── package.json
└── pnpm-workspace.yaml
```

---

## Del 1: Root Setup

### package.json (root)

```json
{
  "name": "myhrvoldgruppen-service",
  "private": true,
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "lint": "turbo lint",
    "typecheck": "turbo typecheck",
    "db:generate": "turbo db:generate",
    "db:push": "turbo db:push",
    "db:studio": "pnpm --filter @myhrvold/db db:studio"
  },
  "devDependencies": {
    "turbo": "^2.3.0",
    "typescript": "^5.6.0"
  },
  "packageManager": "pnpm@9.0.0"
}
```

### pnpm-workspace.yaml

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

### turbo.json

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {},
    "typecheck": {
      "dependsOn": ["^build"]
    },
    "db:generate": {
      "cache": false
    },
    "db:push": {
      "cache": false
    }
  }
}
```

---

## Del 2: packages/db

### packages/db/package.json

```json
{
  "name": "@myhrvold/db",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./schema": "./src/schema/index.ts",
    "./client": "./src/client.ts"
  },
  "scripts": {
    "db:generate": "drizzle-kit generate",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "drizzle-orm": "^0.36.0",
    "pg": "^8.13.0"
  },
  "devDependencies": {
    "@types/pg": "^8.11.0",
    "drizzle-kit": "^0.28.0",
    "typescript": "^5.6.0"
  }
}
```

### packages/db/drizzle.config.ts

```typescript
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

### packages/db/tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "outDir": "./dist"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

---

## Del 3: Common Schema (KRITISK)

### packages/db/src/schema/common.ts

```typescript
import { timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * Standard timestamps for alle tabeller
 * Brukes med spread operator: ...timestamps
 */
export const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
};

/**
 * Soft delete felter - PÅKREVD på alle tabeller
 * Gjør at data aldri slettes permanent
 */
export const softDelete = {
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  deletedBy: uuid('deleted_by'),
};

/**
 * Kombiner timestamps og soft delete
 * Bruk dette på ALLE tabeller:
 * 
 * export const myTable = pgTable('my_table', {
 *   id: uuid('id').primaryKey().defaultRandom(),
 *   // ... andre felt
 *   ...baseFields,
 * });
 */
export const baseFields = {
  ...timestamps,
  ...softDelete,
};
```

---

## Del 4: Auth Schema

### packages/db/src/schema/auth/users.ts

```typescript
import { pgTable, uuid, varchar, text, boolean, timestamp, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { baseFields } from '../common';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Autentisering
  email: varchar('email', { length: 255 }).notNull().unique(),
  password: text('password'), // bcrypt hash
  
  // Profil
  firstName: varchar('first_name', { length: 100 }),
  lastName: varchar('last_name', { length: 100 }),
  phone: varchar('phone', { length: 50 }),
  avatar: varchar('avatar', { length: 500 }),
  
  // Rolle & Avdeling
  role: varchar('role', { length: 50 }).notNull().default('viewer'),
  departmentId: uuid('department_id').references(() => departments.id),
  
  // Status
  isActive: boolean('is_active').default(true).notNull(),
  isApproved: boolean('is_approved').default(false),
  approvedBy: uuid('approved_by'),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  
  // Aktivitet
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  
  ...baseFields,
}, (table) => ({
  emailIdx: index('idx_users_email').on(table.email),
  roleIdx: index('idx_users_role').on(table.role),
  departmentIdx: index('idx_users_department').on(table.departmentId),
  activeIdx: index('idx_users_active').on(table.isActive),
}));

export const usersRelations = relations(users, ({ one }) => ({
  department: one(departments, {
    fields: [users.departmentId],
    references: [departments.id],
  }),
}));

// Import etter definisjon for å unngå sirkulær import
import { departments } from '../organization/departments';
```

### packages/db/src/schema/auth/sessions.ts

```typescript
import { pgTable, uuid, text, varchar, timestamp, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';

export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  userId: uuid('user_id').references(() => users.id).notNull(),
  
  // Token
  token: text('token').notNull().unique(),
  
  // Metadata
  userAgent: text('user_agent'),
  ipAddress: varchar('ip_address', { length: 45 }),
  
  // Gyldighet
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userIdx: index('idx_sessions_user').on(table.userId),
  tokenIdx: index('idx_sessions_token').on(table.token),
  expiresIdx: index('idx_sessions_expires').on(table.expiresAt),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));
```

### packages/db/src/schema/auth/index.ts

```typescript
export * from './users';
export * from './sessions';
```

---

## Del 5: Organization Schema

### packages/db/src/schema/organization/departments.ts

```typescript
import { pgTable, uuid, varchar, text, boolean, integer, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { baseFields } from '../common';

export const departments = pgTable('departments', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  name: varchar('name', { length: 100 }).notNull(),
  code: varchar('code', { length: 20 }).unique(),
  description: text('description'),
  
  // Hierarki
  parentId: uuid('parent_id'),
  sortOrder: integer('sort_order').default(0),
  
  // Region (Oslo, Bergen, Trondheim, etc.)
  region: varchar('region', { length: 100 }),
  
  isActive: boolean('is_active').default(true).notNull(),
  
  ...baseFields,
}, (table) => ({
  codeIdx: index('idx_departments_code').on(table.code),
  regionIdx: index('idx_departments_region').on(table.region),
  activeIdx: index('idx_departments_active').on(table.isActive),
}));

export const departmentsRelations = relations(departments, ({ one, many }) => ({
  parent: one(departments, {
    fields: [departments.parentId],
    references: [departments.id],
    relationName: 'parentChild',
  }),
  children: many(departments, { relationName: 'parentChild' }),
}));
```

### packages/db/src/schema/organization/index.ts

```typescript
export * from './departments';
```

---

## Del 6: Hovedindex

### packages/db/src/schema/index.ts

```typescript
// Common
export * from './common';

// Auth
export * from './auth';

// Organization
export * from './organization';

// CRM (FASE 2)
// export * from './crm';

// Claims (FASE 3)
// export * from './claims';

// Service (FASE 4-5)
// export * from './service';

// Installations (FASE 6)
// export * from './installations';

// Communication (FASE 7)
// export * from './communication';
```

### packages/db/src/client.ts

```typescript
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

export function createDb(connectionString: string) {
  const pool = new Pool({ connectionString });
  return drizzle(pool, { schema });
}

export type Database = ReturnType<typeof createDb>;
```

### packages/db/src/index.ts

```typescript
export * from './schema';
export * from './client';
```

---

## Del 7: packages/shared

### packages/shared/package.json

```json
{
  "name": "@myhrvold/shared",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./schemas": "./src/schemas/index.ts",
    "./constants": "./src/constants/index.ts"
  },
  "dependencies": {
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "typescript": "^5.6.0"
  }
}
```

### packages/shared/src/schemas/common.schema.ts

```typescript
import { z } from 'zod';

// Pagination
export const paginationInput = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
});

export const paginatedOutput = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    items: z.array(itemSchema),
    total: z.number(),
    page: z.number(),
    limit: z.number(),
    totalPages: z.number(),
  });

// ID validering
export const idInput = z.object({
  id: z.string().uuid(),
});

// Timestamp output
export const timestampsOutput = z.object({
  createdAt: z.date(),
  updatedAt: z.date(),
  deletedAt: z.date().nullable(),
});

export type PaginationInput = z.infer<typeof paginationInput>;
export type IdInput = z.infer<typeof idInput>;
```

### packages/shared/src/schemas/auth.schema.ts

```typescript
import { z } from 'zod';

// Roller
export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  LEADER: 'leader',
  SERVICE: 'service',
  TECHNICIAN: 'technician',
  INSTALLER: 'installer',
  SALES: 'sales',
  VIEWER: 'viewer',
} as const;

export const roleEnum = z.enum([
  ROLES.SUPER_ADMIN,
  ROLES.ADMIN,
  ROLES.LEADER,
  ROLES.SERVICE,
  ROLES.TECHNICIAN,
  ROLES.INSTALLER,
  ROLES.SALES,
  ROLES.VIEWER,
]);

// Login
export const loginInput = z.object({
  email: z.string().email('Ugyldig e-postadresse'),
  password: z.string().min(6, 'Passord må være minst 6 tegn'),
});

// User output
export const userOutput = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  role: roleEnum,
  departmentId: z.string().uuid().nullable(),
  isActive: z.boolean(),
});

// Session output
export const sessionOutput = z.object({
  token: z.string(),
  user: userOutput,
  expiresAt: z.date(),
});

export type Role = z.infer<typeof roleEnum>;
export type LoginInput = z.infer<typeof loginInput>;
export type UserOutput = z.infer<typeof userOutput>;
export type SessionOutput = z.infer<typeof sessionOutput>;
```

### packages/shared/src/schemas/index.ts

```typescript
export * from './common.schema';
export * from './auth.schema';
```

### packages/shared/src/constants/index.ts

```typescript
export { ROLES } from '../schemas/auth.schema';

// Norske labels for roller
export const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Administrator',
  leader: 'Leder',
  service: 'Service',
  technician: 'Tekniker',
  installer: 'Montør',
  sales: 'Salg',
  viewer: 'Leser',
};

// Status labels
export const STATUS_LABELS = {
  active: 'Aktiv',
  inactive: 'Inaktiv',
  pending: 'Venter',
  approved: 'Godkjent',
  rejected: 'Avvist',
};
```

### packages/shared/src/index.ts

```typescript
export * from './schemas';
export * from './constants';
```

---

## Test

```bash
# Installer dependencies
pnpm install

# Generer database schema
pnpm db:generate

# Push til database (krever DATABASE_URL)
pnpm db:push
```

---

## Sjekkliste

- [ ] Monorepo struktur opprettet
- [ ] packages/db med Drizzle ORM
- [ ] common.ts med baseFields (timestamps + softDelete)
- [ ] users tabell med roller
- [ ] sessions tabell
- [ ] departments tabell
- [ ] packages/shared med Zod schemas
- [ ] Konstanter med norske labels
- [ ] `pnpm db:generate` kjører uten feil

---

## Neste fase

Gå til **FASE 2: CRM** for å legge til suppliers, products og customers.
