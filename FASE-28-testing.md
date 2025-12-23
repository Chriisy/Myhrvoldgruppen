# FASE 28: Testing (Unit/Integration/E2E)

> Fase 1-27 må være fullført.
> Estimert tid: ~90 minutter.

## Mål

Implementer komplett testoppsett med Vitest for backend og React Native Testing Library for frontend.

---

## Backend Testing Setup

### packages/config/vitest.config.ts

```typescript
import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.test.ts', '**/*.spec.ts'],
    exclude: ['node_modules', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: ['**/*.test.ts', '**/*.spec.ts', '**/types/**'],
    },
    setupFiles: ['./test/setup.ts'],
  },
});
```

---

### apps/api/test/setup.ts

```typescript
import { beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import * as schema from '@myhrvold/db/schema';

// Test database connection
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || 
  'postgresql://postgres:postgres@localhost:5432/myhrvold_test';

let sql: ReturnType<typeof postgres>;
let db: ReturnType<typeof drizzle>;

export const getTestDb = () => db;
export const getTestSql = () => sql;

beforeAll(async () => {
  sql = postgres(TEST_DATABASE_URL, { max: 1 });
  db = drizzle(sql, { schema });
  
  // Run migrations
  await migrate(db, { migrationsFolder: './drizzle' });
});

afterAll(async () => {
  await sql.end();
});

beforeEach(async () => {
  // Truncate all tables before each test
  await sql`TRUNCATE TABLE 
    users, sessions, departments, 
    customers, suppliers, products,
    claims, claim_timeline_events, claim_attachments,
    installations, service_visits, maintenance_agreements,
    transport_damages, discussion_issues
  CASCADE`;
});

// Mock logger
vi.mock('pino', () => ({
  default: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    child: vi.fn().mockReturnThis(),
  }),
}));
```

---

### apps/api/test/helpers.ts

```typescript
import { hash } from 'bcrypt';
import type { Database } from '../src/lib/db';
import { users, departments, suppliers, customers } from '@myhrvold/db/schema';

export async function createTestUser(db: Database, overrides: Partial<typeof users.$inferInsert> = {}) {
  const passwordHash = await hash('password123', 12);
  
  const [user] = await db.insert(users).values({
    email: `test-${Date.now()}@example.com`,
    passwordHash,
    firstName: 'Test',
    lastName: 'User',
    role: 'tekniker',
    isActive: true,
    ...overrides,
  }).returning();
  
  return user;
}

export async function createTestAdmin(db: Database) {
  return createTestUser(db, {
    email: `admin-${Date.now()}@example.com`,
    role: 'admin',
  });
}

export async function createTestDepartment(db: Database, overrides: Partial<typeof departments.$inferInsert> = {}) {
  const [department] = await db.insert(departments).values({
    name: `Test Department ${Date.now()}`,
    code: `TD${Date.now() % 1000}`,
    ...overrides,
  }).returning();
  
  return department;
}

export async function createTestSupplier(db: Database, overrides: Partial<typeof suppliers.$inferInsert> = {}) {
  const [supplier] = await db.insert(suppliers).values({
    name: `Test Supplier ${Date.now()}`,
    shortCode: `TS${Date.now() % 1000}`,
    isActive: true,
    ...overrides,
  }).returning();
  
  return supplier;
}

export async function createTestCustomer(db: Database, overrides: Partial<typeof customers.$inferInsert> = {}) {
  const [customer] = await db.insert(customers).values({
    name: `Test Customer ${Date.now()}`,
    customerNumber: `C${Date.now()}`,
    isActive: true,
    ...overrides,
  }).returning();
  
  return customer;
}

export function mockContext(db: Database, user: typeof users.$inferSelect) {
  return {
    db,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      departmentId: user.departmentId,
    },
    log: {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      child: vi.fn().mockReturnThis(),
    },
    correlationId: 'test-correlation-id',
  };
}
```

---

## Unit Tests

### apps/api/src/modules/claims/claims.service.test.ts

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TRPCError } from '@trpc/server';
import { getTestDb } from '../../../test/setup';
import { createTestUser, createTestSupplier, createTestCustomer } from '../../../test/helpers';
import { ClaimsService } from './claims.service';
import { claims } from '@myhrvold/db/schema';

describe('ClaimsService', () => {
  let db: ReturnType<typeof getTestDb>;
  let service: ClaimsService;
  let mockLog: any;

  beforeEach(() => {
    db = getTestDb();
    mockLog = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      child: vi.fn().mockReturnThis(),
    };
    service = new ClaimsService(db, mockLog);
  });

  describe('create', () => {
    it('should create a claim with auto-generated claim number', async () => {
      const user = await createTestUser(db);
      const supplier = await createTestSupplier(db);
      const customer = await createTestCustomer(db);

      const claim = await service.create({
        supplierId: supplier.id,
        customerId: customer.id,
        productName: 'Test Product',
        serialNumber: 'SN123',
        purchaseDate: new Date('2024-01-15'),
        faultDescription: 'Product not working',
      }, user.id);

      expect(claim.id).toBeDefined();
      expect(claim.claimNumber).toMatch(/^RK-\d{4}-\d{4}$/);
      expect(claim.status).toBe('new');
      expect(claim.supplierId).toBe(supplier.id);
      expect(claim.createdById).toBe(user.id);
    });

    it('should throw error for missing required fields', async () => {
      const user = await createTestUser(db);

      await expect(
        service.create({
          supplierId: 'invalid-uuid',
          productName: '',
          faultDescription: '',
        } as any, user.id)
      ).rejects.toThrow();
    });
  });

  describe('getById', () => {
    it('should return claim with relations', async () => {
      const user = await createTestUser(db);
      const supplier = await createTestSupplier(db);
      const customer = await createTestCustomer(db);

      const created = await service.create({
        supplierId: supplier.id,
        customerId: customer.id,
        productName: 'Test Product',
        faultDescription: 'Test fault',
      }, user.id);

      const found = await service.getById(created.id);

      expect(found.id).toBe(created.id);
      expect(found.supplier).toBeDefined();
      expect(found.supplier?.name).toBe(supplier.name);
    });

    it('should throw NOT_FOUND for invalid id', async () => {
      await expect(
        service.getById('00000000-0000-0000-0000-000000000000')
      ).rejects.toThrow(TRPCError);
    });
  });

  describe('updateStatus', () => {
    it('should update status and create timeline event', async () => {
      const user = await createTestUser(db);
      const supplier = await createTestSupplier(db);

      const claim = await service.create({
        supplierId: supplier.id,
        productName: 'Test',
        faultDescription: 'Test',
      }, user.id);

      const updated = await service.updateStatus(
        claim.id, 
        'in_progress', 
        'Started processing',
        user.id
      );

      expect(updated.status).toBe('in_progress');
      expect(mockLog.info).toHaveBeenCalledWith(
        expect.objectContaining({ claimId: claim.id, status: 'in_progress' }),
        expect.any(String)
      );
    });

    it('should set resolvedAt when resolved', async () => {
      const user = await createTestUser(db);
      const supplier = await createTestSupplier(db);

      const claim = await service.create({
        supplierId: supplier.id,
        productName: 'Test',
        faultDescription: 'Test',
      }, user.id);

      const updated = await service.updateStatus(
        claim.id,
        'resolved',
        'Issue fixed',
        user.id
      );

      expect(updated.status).toBe('resolved');
      expect(updated.resolvedAt).toBeDefined();
    });
  });

  describe('list', () => {
    it('should paginate results', async () => {
      const user = await createTestUser(db);
      const supplier = await createTestSupplier(db);

      // Create 5 claims
      for (let i = 0; i < 5; i++) {
        await service.create({
          supplierId: supplier.id,
          productName: `Product ${i}`,
          faultDescription: 'Test',
        }, user.id);
      }

      const page1 = await service.list({ page: 1, limit: 2 });
      const page2 = await service.list({ page: 2, limit: 2 });

      expect(page1.items.length).toBe(2);
      expect(page1.total).toBe(5);
      expect(page1.totalPages).toBe(3);
      expect(page2.items.length).toBe(2);
    });

    it('should filter by status', async () => {
      const user = await createTestUser(db);
      const supplier = await createTestSupplier(db);

      const claim1 = await service.create({
        supplierId: supplier.id,
        productName: 'Product 1',
        faultDescription: 'Test',
      }, user.id);

      await service.create({
        supplierId: supplier.id,
        productName: 'Product 2',
        faultDescription: 'Test',
      }, user.id);

      await service.updateStatus(claim1.id, 'in_progress', 'Processing', user.id);

      const result = await service.list({ page: 1, limit: 10, status: 'in_progress' });

      expect(result.items.length).toBe(1);
      expect(result.items[0].id).toBe(claim1.id);
    });

    it('should search by claim number', async () => {
      const user = await createTestUser(db);
      const supplier = await createTestSupplier(db);

      const claim = await service.create({
        supplierId: supplier.id,
        productName: 'Searchable Product',
        faultDescription: 'Test',
      }, user.id);

      const result = await service.list({ 
        page: 1, 
        limit: 10, 
        search: claim.claimNumber 
      });

      expect(result.items.length).toBe(1);
      expect(result.items[0].id).toBe(claim.id);
    });
  });

  describe('softDelete', () => {
    it('should soft delete claim', async () => {
      const user = await createTestUser(db);
      const supplier = await createTestSupplier(db);

      const claim = await service.create({
        supplierId: supplier.id,
        productName: 'Test',
        faultDescription: 'Test',
      }, user.id);

      await service.delete(claim.id);

      // Should not be found
      await expect(service.getById(claim.id)).rejects.toThrow(TRPCError);

      // But should exist in DB with deletedAt
      const [deleted] = await db
        .select()
        .from(claims)
        .where(eq(claims.id, claim.id));
      
      expect(deleted.deletedAt).toBeDefined();
    });
  });
});
```

---

### apps/api/src/modules/auth/auth.service.test.ts

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TRPCError } from '@trpc/server';
import { getTestDb } from '../../../test/setup';
import { createTestUser } from '../../../test/helpers';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let db: ReturnType<typeof getTestDb>;
  let service: AuthService;
  let mockLog: any;

  beforeEach(() => {
    db = getTestDb();
    mockLog = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      child: vi.fn().mockReturnThis(),
    };
    service = new AuthService(db, mockLog);
  });

  describe('login', () => {
    it('should return token for valid credentials', async () => {
      await createTestUser(db, { email: 'test@example.com' });

      const result = await service.login(
        'test@example.com',
        'password123',
        { userAgent: 'test', ipAddress: '127.0.0.1' }
      );

      expect(result.token).toBeDefined();
      expect(result.token.length).toBe(64); // 32 bytes hex
      expect(result.user.email).toBe('test@example.com');
    });

    it('should throw for invalid email', async () => {
      await expect(
        service.login('nonexistent@example.com', 'password123', {})
      ).rejects.toThrow(TRPCError);
    });

    it('should throw for invalid password', async () => {
      await createTestUser(db, { email: 'test@example.com' });

      await expect(
        service.login('test@example.com', 'wrongpassword', {})
      ).rejects.toThrow(TRPCError);
    });

    it('should throw for inactive user', async () => {
      await createTestUser(db, { 
        email: 'inactive@example.com',
        isActive: false,
      });

      await expect(
        service.login('inactive@example.com', 'password123', {})
      ).rejects.toThrow(TRPCError);
    });
  });

  describe('validateSession', () => {
    it('should return user for valid token', async () => {
      const user = await createTestUser(db, { email: 'test@example.com' });
      const { token } = await service.login('test@example.com', 'password123', {});

      const validated = await service.validateSession(token);

      expect(validated.id).toBe(user.id);
      expect(validated.email).toBe(user.email);
    });

    it('should return null for invalid token', async () => {
      const result = await service.validateSession('invalid-token');
      expect(result).toBeNull();
    });
  });

  describe('logout', () => {
    it('should invalidate session', async () => {
      await createTestUser(db, { email: 'test@example.com' });
      const { token } = await service.login('test@example.com', 'password123', {});

      await service.logout(token);

      const validated = await service.validateSession(token);
      expect(validated).toBeNull();
    });
  });
});
```

---

## Integration Tests

### apps/api/src/modules/claims/claims.router.test.ts

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createCaller } from '../../trpc/trpc';
import { appRouter } from '../../trpc';
import { getTestDb } from '../../../test/setup';
import { createTestUser, createTestSupplier, createTestAdmin, mockContext } from '../../../test/helpers';

describe('Claims Router', () => {
  let db: ReturnType<typeof getTestDb>;

  beforeEach(() => {
    db = getTestDb();
  });

  describe('claims.list', () => {
    it('should list claims for authenticated user', async () => {
      const user = await createTestUser(db);
      const supplier = await createTestSupplier(db);
      const ctx = mockContext(db, user);
      const caller = createCaller(ctx);

      // Create a claim first
      await caller.claims.create({
        supplierId: supplier.id,
        productName: 'Test Product',
        faultDescription: 'Test fault',
      });

      const result = await caller.claims.list({ page: 1, limit: 10 });

      expect(result.items.length).toBe(1);
      expect(result.items[0].productName).toBe('Test Product');
    });
  });

  describe('claims.create', () => {
    it('should create claim for authorized user', async () => {
      const user = await createTestUser(db, { role: 'service' });
      const supplier = await createTestSupplier(db);
      const ctx = mockContext(db, user);
      const caller = createCaller(ctx);

      const claim = await caller.claims.create({
        supplierId: supplier.id,
        productName: 'New Product',
        serialNumber: 'SN456',
        faultDescription: 'Does not work',
      });

      expect(claim.id).toBeDefined();
      expect(claim.claimNumber).toBeDefined();
    });

    it('should reject for viewer role', async () => {
      const user = await createTestUser(db, { role: 'viewer' });
      const supplier = await createTestSupplier(db);
      const ctx = mockContext(db, user);
      const caller = createCaller(ctx);

      await expect(
        caller.claims.create({
          supplierId: supplier.id,
          productName: 'Product',
          faultDescription: 'Fault',
        })
      ).rejects.toThrow();
    });
  });

  describe('claims.updateStatus', () => {
    it('should update status', async () => {
      const user = await createTestUser(db, { role: 'service' });
      const supplier = await createTestSupplier(db);
      const ctx = mockContext(db, user);
      const caller = createCaller(ctx);

      const claim = await caller.claims.create({
        supplierId: supplier.id,
        productName: 'Product',
        faultDescription: 'Fault',
      });

      const updated = await caller.claims.updateStatus({
        id: claim.id,
        status: 'in_progress',
        comment: 'Started work',
      });

      expect(updated.status).toBe('in_progress');
    });
  });

  describe('claims.delete', () => {
    it('should allow admin to delete', async () => {
      const admin = await createTestAdmin(db);
      const supplier = await createTestSupplier(db);
      const ctx = mockContext(db, admin);
      const caller = createCaller(ctx);

      const claim = await caller.claims.create({
        supplierId: supplier.id,
        productName: 'Product',
        faultDescription: 'Fault',
      });

      const result = await caller.claims.delete({ id: claim.id });

      expect(result.success).toBe(true);
    });

    it('should reject delete for tekniker', async () => {
      const tekniker = await createTestUser(db, { role: 'tekniker' });
      const admin = await createTestAdmin(db);
      const supplier = await createTestSupplier(db);

      // Admin creates claim
      const adminCtx = mockContext(db, admin);
      const adminCaller = createCaller(adminCtx);
      const claim = await adminCaller.claims.create({
        supplierId: supplier.id,
        productName: 'Product',
        faultDescription: 'Fault',
      });

      // Tekniker tries to delete
      const teknikerCtx = mockContext(db, tekniker);
      const teknikerCaller = createCaller(teknikerCtx);

      await expect(
        teknikerCaller.claims.delete({ id: claim.id })
      ).rejects.toThrow();
    });
  });
});
```

---

## Frontend Testing Setup

### apps/mobile/jest.config.js

```javascript
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['@testing-library/jest-native/extend-expect', './test/setup.ts'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)',
  ],
  testMatch: ['**/*.test.tsx', '**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
```

---

### apps/mobile/test/setup.ts

```typescript
import '@testing-library/jest-native/extend-expect';
import { jest } from '@jest/globals';

// Mock expo-router
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  }),
  useLocalSearchParams: () => ({}),
  Link: ({ children }: any) => children,
}));

// Mock react-i18next
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'nb' },
  }),
}));

// Mock tRPC
jest.mock('../src/lib/api', () => ({
  trpc: {
    claims: {
      list: { useQuery: jest.fn() },
      byId: { useQuery: jest.fn() },
      create: { useMutation: jest.fn() },
    },
    useUtils: () => ({}),
  },
}));
```

---

### apps/mobile/src/features/claims/components/ClaimCard.test.tsx

```tsx
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { ClaimCard } from './ClaimCard';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

describe('ClaimCard', () => {
  const mockClaim = {
    id: '123',
    claimNumber: 'RK-2024-0001',
    status: 'new',
    productName: 'Test Oppvaskmaskin',
    createdAt: new Date('2024-01-15'),
    customer: { name: 'Test Kunde' },
    supplier: { name: 'Test Leverandør', shortCode: 'TL' },
  };

  beforeEach(() => {
    mockPush.mockClear();
  });

  it('renders claim information', () => {
    render(<ClaimCard claim={mockClaim} />);

    expect(screen.getByText('RK-2024-0001')).toBeTruthy();
    expect(screen.getByText('Test Oppvaskmaskin')).toBeTruthy();
    expect(screen.getByText('Test Kunde')).toBeTruthy();
  });

  it('displays correct status badge', () => {
    render(<ClaimCard claim={mockClaim} />);

    expect(screen.getByText('Ny')).toBeTruthy();
  });

  it('navigates on press', () => {
    render(<ClaimCard claim={mockClaim} />);

    fireEvent.press(screen.getByText('RK-2024-0001'));

    expect(mockPush).toHaveBeenCalledWith('/claims/123');
  });

  it('handles different statuses', () => {
    const { rerender } = render(
      <ClaimCard claim={{ ...mockClaim, status: 'in_progress' }} />
    );
    expect(screen.getByText('Pågår')).toBeTruthy();

    rerender(<ClaimCard claim={{ ...mockClaim, status: 'resolved' }} />);
    expect(screen.getByText('Løst')).toBeTruthy();
  });
});
```

---

## Package.json Scripts

### apps/api/package.json

```json
{
  "scripts": {
    "test": "vitest",
    "test:watch": "vitest watch",
    "test:coverage": "vitest run --coverage",
    "test:ui": "vitest --ui"
  }
}
```

### apps/mobile/package.json

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  }
}
```

---

## Test Commands

```bash
# Backend tests
pnpm --filter @myhrvold/api test
pnpm --filter @myhrvold/api test:coverage

# Frontend tests
pnpm --filter @myhrvold/mobile test
pnpm --filter @myhrvold/mobile test:coverage

# All tests
pnpm test
```

---

## Sjekkliste

- [ ] Vitest config for backend
- [ ] Test setup med database
- [ ] Test helpers for fixtures
- [ ] Unit tests for ClaimsService
- [ ] Unit tests for AuthService
- [ ] Integration tests for routers
- [ ] Jest config for mobile
- [ ] Component tests for ClaimCard
- [ ] Mocks for expo-router, i18n, tRPC
- [ ] Coverage reporting

---

## Neste fase

Gå til **FASE 29: CI/CD + Deployment**.
