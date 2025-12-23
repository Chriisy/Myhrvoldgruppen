# FASE 21: CRM API (Suppliers, Products, Customers)

> Fase 1-20 må være fullført.
> Estimert tid: ~60 minutter.

## Mål

Implementer komplette API-er for leverandører, produkter og kunder.

---

## Mappestruktur

```
apps/api/src/modules/
├── suppliers/
│   ├── suppliers.policy.ts
│   ├── suppliers.repo.ts
│   ├── suppliers.service.ts
│   └── suppliers.router.ts
├── products/
│   ├── products.policy.ts
│   ├── products.repo.ts
│   ├── products.service.ts
│   └── products.router.ts
└── customers/
    ├── customers.policy.ts
    ├── customers.repo.ts
    ├── customers.service.ts
    └── customers.router.ts
```

---

## Suppliers Module

### suppliers.policy.ts

```typescript
import type { User } from '../../trpc/context';

export const SupplierPermissions = {
  list: ['super_admin', 'admin', 'leder', 'service', 'tekniker', 'viewer'],
  read: ['super_admin', 'admin', 'leder', 'service', 'tekniker', 'viewer'],
  create: ['super_admin', 'admin'],
  update: ['super_admin', 'admin'],
  delete: ['super_admin'],
} as const;

type Action = keyof typeof SupplierPermissions;

export function canPerform(user: User, action: Action): boolean {
  return SupplierPermissions[action].includes(user.role as any);
}

export function assertCan(user: User, action: Action): void {
  if (!canPerform(user, action)) {
    throw new Error(`Ingen tilgang til ${action} leverandør`);
  }
}
```

---

### suppliers.repo.ts

```typescript
import { eq, ilike, or, and, isNull, desc, asc, SQL } from 'drizzle-orm';
import type { Database } from '../../lib/db';
import { suppliers } from '@myhrvold/db/schema';

interface ListParams {
  page: number;
  limit: number;
  search?: string;
  isActive?: boolean;
  sortBy?: 'name' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

export class SuppliersRepository {
  constructor(private db: Database) {}

  async findMany(params: ListParams) {
    const { page, limit, search, isActive, sortBy = 'name', sortOrder = 'asc' } = params;
    const offset = (page - 1) * limit;

    const conditions: SQL[] = [isNull(suppliers.deletedAt)];

    if (search) {
      conditions.push(
        or(
          ilike(suppliers.name, `%${search}%`),
          ilike(suppliers.shortCode, `%${search}%`),
          ilike(suppliers.contactEmail, `%${search}%`)
        )!
      );
    }

    if (isActive !== undefined) {
      conditions.push(eq(suppliers.isActive, isActive));
    }

    const orderFn = sortOrder === 'asc' ? asc : desc;
    const orderColumn = sortBy === 'name' ? suppliers.name : suppliers.createdAt;

    return this.db.query.suppliers.findMany({
      where: and(...conditions),
      orderBy: [orderFn(orderColumn)],
      limit,
      offset,
    });
  }

  async findById(id: string) {
    return this.db.query.suppliers.findFirst({
      where: and(eq(suppliers.id, id), isNull(suppliers.deletedAt)),
      with: {
        products: {
          where: isNull(suppliers.deletedAt),
          limit: 20,
        },
      },
    });
  }

  async findByShortCode(shortCode: string) {
    return this.db.query.suppliers.findFirst({
      where: and(eq(suppliers.shortCode, shortCode), isNull(suppliers.deletedAt)),
    });
  }

  async create(data: typeof suppliers.$inferInsert) {
    const [result] = await this.db.insert(suppliers).values(data).returning();
    return result;
  }

  async update(id: string, data: Partial<typeof suppliers.$inferInsert>) {
    const [result] = await this.db
      .update(suppliers)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(suppliers.id, id))
      .returning();
    return result;
  }

  async softDelete(id: string) {
    const [result] = await this.db
      .update(suppliers)
      .set({ deletedAt: new Date() })
      .where(eq(suppliers.id, id))
      .returning();
    return result;
  }

  async count(params: Omit<ListParams, 'page' | 'limit'>) {
    const { search, isActive } = params;
    const conditions: SQL[] = [isNull(suppliers.deletedAt)];

    if (search) {
      conditions.push(
        or(
          ilike(suppliers.name, `%${search}%`),
          ilike(suppliers.shortCode, `%${search}%`)
        )!
      );
    }

    if (isActive !== undefined) {
      conditions.push(eq(suppliers.isActive, isActive));
    }

    const result = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(suppliers)
      .where(and(...conditions));

    return result[0]?.count ?? 0;
  }
}
```

---

### suppliers.service.ts

```typescript
import { TRPCError } from '@trpc/server';
import type { Database } from '../../lib/db';
import type { Logger } from 'pino';
import { SuppliersRepository } from './suppliers.repo';

interface CreateSupplierInput {
  name: string;
  shortCode: string;
  contactEmail?: string;
  contactPhone?: string;
  contactPerson?: string;
  address?: string;
  postalCode?: string;
  city?: string;
  country?: string;
  warrantyMonths?: number;
  warrantyTerms?: string;
  claimEmailPrimary?: string;
  claimEmailCc?: string;
  portalUrl?: string;
  notes?: string;
}

export class SuppliersService {
  private repo: SuppliersRepository;

  constructor(
    private db: Database,
    private log: Logger
  ) {
    this.repo = new SuppliersRepository(db);
  }

  async list(params: {
    page: number;
    limit: number;
    search?: string;
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
    const supplier = await this.repo.findById(id);
    if (!supplier) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Leverandør ikke funnet',
      });
    }
    return supplier;
  }

  async create(input: CreateSupplierInput, userId: string) {
    // Sjekk at shortCode er unik
    const existing = await this.repo.findByShortCode(input.shortCode);
    if (existing) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Kortkode er allerede i bruk',
      });
    }

    const supplier = await this.repo.create({
      ...input,
      createdById: userId,
    });

    this.log.info({ supplierId: supplier.id }, 'Supplier created');
    return supplier;
  }

  async update(id: string, input: Partial<CreateSupplierInput>, userId: string) {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Leverandør ikke funnet',
      });
    }

    // Sjekk shortCode hvis endret
    if (input.shortCode && input.shortCode !== existing.shortCode) {
      const codeExists = await this.repo.findByShortCode(input.shortCode);
      if (codeExists) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Kortkode er allerede i bruk',
        });
      }
    }

    const supplier = await this.repo.update(id, {
      ...input,
      updatedById: userId,
    });

    this.log.info({ supplierId: id }, 'Supplier updated');
    return supplier;
  }

  async delete(id: string) {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Leverandør ikke funnet',
      });
    }

    await this.repo.softDelete(id);
    this.log.info({ supplierId: id }, 'Supplier deleted');
    return { success: true };
  }

  async getForDropdown() {
    return this.repo.findMany({
      page: 1,
      limit: 500,
      isActive: true,
      sortBy: 'name',
      sortOrder: 'asc',
    });
  }
}
```

---

### suppliers.router.ts

```typescript
import { z } from 'zod';
import { router, protectedProcedure } from '../../trpc/trpc';
import { SuppliersService } from './suppliers.service';
import { assertCan } from './suppliers.policy';

const createInput = z.object({
  name: z.string().min(1, 'Navn er påkrevd'),
  shortCode: z.string().min(2).max(10),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().optional(),
  contactPerson: z.string().optional(),
  address: z.string().optional(),
  postalCode: z.string().optional(),
  city: z.string().optional(),
  country: z.string().default('NO'),
  warrantyMonths: z.number().int().min(0).optional(),
  warrantyTerms: z.string().optional(),
  claimEmailPrimary: z.string().email().optional(),
  claimEmailCc: z.string().optional(),
  portalUrl: z.string().url().optional(),
  notes: z.string().optional(),
});

export const suppliersRouter = router({
  list: protectedProcedure
    .input(z.object({
      page: z.number().int().min(1).default(1),
      limit: z.number().int().min(1).max(100).default(20),
      search: z.string().optional(),
      isActive: z.boolean().optional(),
    }))
    .query(async ({ ctx, input }) => {
      assertCan(ctx.user, 'list');
      const service = new SuppliersService(ctx.db, ctx.log);
      return service.list(input);
    }),

  byId: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      assertCan(ctx.user, 'read');
      const service = new SuppliersService(ctx.db, ctx.log);
      return service.getById(input.id);
    }),

  create: protectedProcedure
    .input(createInput)
    .mutation(async ({ ctx, input }) => {
      assertCan(ctx.user, 'create');
      const service = new SuppliersService(ctx.db, ctx.log);
      return service.create(input, ctx.user.id);
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      data: createInput.partial(),
    }))
    .mutation(async ({ ctx, input }) => {
      assertCan(ctx.user, 'update');
      const service = new SuppliersService(ctx.db, ctx.log);
      return service.update(input.id, input.data, ctx.user.id);
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      assertCan(ctx.user, 'delete');
      const service = new SuppliersService(ctx.db, ctx.log);
      return service.delete(input.id);
    }),

  dropdown: protectedProcedure
    .query(async ({ ctx }) => {
      assertCan(ctx.user, 'list');
      const service = new SuppliersService(ctx.db, ctx.log);
      return service.getForDropdown();
    }),
});

export type SuppliersRouter = typeof suppliersRouter;
```

---

## Products Module

### products.policy.ts

```typescript
import type { User } from '../../trpc/context';

export const ProductPermissions = {
  list: ['super_admin', 'admin', 'leder', 'service', 'tekniker', 'viewer'],
  read: ['super_admin', 'admin', 'leder', 'service', 'tekniker', 'viewer'],
  create: ['super_admin', 'admin'],
  update: ['super_admin', 'admin'],
  delete: ['super_admin'],
} as const;

type Action = keyof typeof ProductPermissions;

export function canPerform(user: User, action: Action): boolean {
  return ProductPermissions[action].includes(user.role as any);
}

export function assertCan(user: User, action: Action): void {
  if (!canPerform(user, action)) {
    throw new Error(`Ingen tilgang til ${action} produkt`);
  }
}
```

---

### products.repo.ts

```typescript
import { eq, ilike, or, and, isNull, desc, asc, SQL, sql } from 'drizzle-orm';
import type { Database } from '../../lib/db';
import { products, suppliers } from '@myhrvold/db/schema';

interface ListParams {
  page: number;
  limit: number;
  search?: string;
  supplierId?: string;
  isActive?: boolean;
}

export class ProductsRepository {
  constructor(private db: Database) {}

  async findMany(params: ListParams) {
    const { page, limit, search, supplierId, isActive } = params;
    const offset = (page - 1) * limit;

    const conditions: SQL[] = [isNull(products.deletedAt)];

    if (search) {
      conditions.push(
        or(
          ilike(products.name, `%${search}%`),
          ilike(products.articleNumber, `%${search}%`),
          ilike(products.modelNumber, `%${search}%`)
        )!
      );
    }

    if (supplierId) {
      conditions.push(eq(products.supplierId, supplierId));
    }

    if (isActive !== undefined) {
      conditions.push(eq(products.isActive, isActive));
    }

    return this.db.query.products.findMany({
      where: and(...conditions),
      with: {
        supplier: {
          columns: { id: true, name: true, shortCode: true },
        },
      },
      orderBy: [asc(products.name)],
      limit,
      offset,
    });
  }

  async findById(id: string) {
    return this.db.query.products.findFirst({
      where: and(eq(products.id, id), isNull(products.deletedAt)),
      with: {
        supplier: true,
      },
    });
  }

  async findByArticleNumber(articleNumber: string, supplierId: string) {
    return this.db.query.products.findFirst({
      where: and(
        eq(products.articleNumber, articleNumber),
        eq(products.supplierId, supplierId),
        isNull(products.deletedAt)
      ),
    });
  }

  async create(data: typeof products.$inferInsert) {
    const [result] = await this.db.insert(products).values(data).returning();
    return result;
  }

  async update(id: string, data: Partial<typeof products.$inferInsert>) {
    const [result] = await this.db
      .update(products)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(products.id, id))
      .returning();
    return result;
  }

  async softDelete(id: string) {
    const [result] = await this.db
      .update(products)
      .set({ deletedAt: new Date() })
      .where(eq(products.id, id))
      .returning();
    return result;
  }

  async count(params: Omit<ListParams, 'page' | 'limit'>) {
    const { search, supplierId, isActive } = params;
    const conditions: SQL[] = [isNull(products.deletedAt)];

    if (search) {
      conditions.push(
        or(
          ilike(products.name, `%${search}%`),
          ilike(products.articleNumber, `%${search}%`)
        )!
      );
    }

    if (supplierId) {
      conditions.push(eq(products.supplierId, supplierId));
    }

    if (isActive !== undefined) {
      conditions.push(eq(products.isActive, isActive));
    }

    const result = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(products)
      .where(and(...conditions));

    return result[0]?.count ?? 0;
  }
}
```

---

### products.service.ts

```typescript
import { TRPCError } from '@trpc/server';
import type { Database } from '../../lib/db';
import type { Logger } from 'pino';
import { ProductsRepository } from './products.repo';

interface CreateProductInput {
  supplierId: string;
  name: string;
  articleNumber?: string;
  modelNumber?: string;
  description?: string;
  category?: string;
  warrantyMonthsOverride?: number;
  specifications?: Record<string, unknown>;
  documentationUrl?: string;
  imageUrl?: string;
}

export class ProductsService {
  private repo: ProductsRepository;

  constructor(
    private db: Database,
    private log: Logger
  ) {
    this.repo = new ProductsRepository(db);
  }

  async list(params: {
    page: number;
    limit: number;
    search?: string;
    supplierId?: string;
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
    const product = await this.repo.findById(id);
    if (!product) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Produkt ikke funnet',
      });
    }
    return product;
  }

  async create(input: CreateProductInput, userId: string) {
    // Sjekk duplikat artikelnummer hos samme leverandør
    if (input.articleNumber) {
      const existing = await this.repo.findByArticleNumber(
        input.articleNumber,
        input.supplierId
      );
      if (existing) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Artikelnummer finnes allerede for denne leverandøren',
        });
      }
    }

    const product = await this.repo.create({
      ...input,
      createdById: userId,
    });

    this.log.info({ productId: product.id }, 'Product created');
    return product;
  }

  async update(id: string, input: Partial<CreateProductInput>, userId: string) {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Produkt ikke funnet',
      });
    }

    const product = await this.repo.update(id, {
      ...input,
      updatedById: userId,
    });

    this.log.info({ productId: id }, 'Product updated');
    return product;
  }

  async delete(id: string) {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Produkt ikke funnet',
      });
    }

    await this.repo.softDelete(id);
    this.log.info({ productId: id }, 'Product deleted');
    return { success: true };
  }

  async getBySupplier(supplierId: string) {
    return this.repo.findMany({
      page: 1,
      limit: 500,
      supplierId,
      isActive: true,
    });
  }
}
```

---

### products.router.ts

```typescript
import { z } from 'zod';
import { router, protectedProcedure } from '../../trpc/trpc';
import { ProductsService } from './products.service';
import { assertCan } from './products.policy';

const createInput = z.object({
  supplierId: z.string().uuid(),
  name: z.string().min(1, 'Navn er påkrevd'),
  articleNumber: z.string().optional(),
  modelNumber: z.string().optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  warrantyMonthsOverride: z.number().int().min(0).optional(),
  specifications: z.record(z.unknown()).optional(),
  documentationUrl: z.string().url().optional(),
  imageUrl: z.string().url().optional(),
});

export const productsRouter = router({
  list: protectedProcedure
    .input(z.object({
      page: z.number().int().min(1).default(1),
      limit: z.number().int().min(1).max(100).default(20),
      search: z.string().optional(),
      supplierId: z.string().uuid().optional(),
      isActive: z.boolean().optional(),
    }))
    .query(async ({ ctx, input }) => {
      assertCan(ctx.user, 'list');
      const service = new ProductsService(ctx.db, ctx.log);
      return service.list(input);
    }),

  byId: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      assertCan(ctx.user, 'read');
      const service = new ProductsService(ctx.db, ctx.log);
      return service.getById(input.id);
    }),

  bySupplier: protectedProcedure
    .input(z.object({ supplierId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      assertCan(ctx.user, 'list');
      const service = new ProductsService(ctx.db, ctx.log);
      return service.getBySupplier(input.supplierId);
    }),

  create: protectedProcedure
    .input(createInput)
    .mutation(async ({ ctx, input }) => {
      assertCan(ctx.user, 'create');
      const service = new ProductsService(ctx.db, ctx.log);
      return service.create(input, ctx.user.id);
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      data: createInput.partial(),
    }))
    .mutation(async ({ ctx, input }) => {
      assertCan(ctx.user, 'update');
      const service = new ProductsService(ctx.db, ctx.log);
      return service.update(input.id, input.data, ctx.user.id);
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      assertCan(ctx.user, 'delete');
      const service = new ProductsService(ctx.db, ctx.log);
      return service.delete(input.id);
    }),
});

export type ProductsRouter = typeof productsRouter;
```

---

## Customers Module

### customers.policy.ts

```typescript
import type { User } from '../../trpc/context';

export const CustomerPermissions = {
  list: ['super_admin', 'admin', 'leder', 'service', 'tekniker', 'viewer'],
  read: ['super_admin', 'admin', 'leder', 'service', 'tekniker', 'viewer'],
  create: ['super_admin', 'admin', 'leder'],
  update: ['super_admin', 'admin', 'leder'],
  delete: ['super_admin'],
} as const;

type Action = keyof typeof CustomerPermissions;

export function canPerform(user: User, action: Action): boolean {
  return CustomerPermissions[action].includes(user.role as any);
}

export function assertCan(user: User, action: Action): void {
  if (!canPerform(user, action)) {
    throw new Error(`Ingen tilgang til ${action} kunde`);
  }
}
```

---

### customers.repo.ts

```typescript
import { eq, ilike, or, and, isNull, desc, asc, SQL, sql } from 'drizzle-orm';
import type { Database } from '../../lib/db';
import { customers } from '@myhrvold/db/schema';

interface ListParams {
  page: number;
  limit: number;
  search?: string;
  chain?: string;
  isActive?: boolean;
}

export class CustomersRepository {
  constructor(private db: Database) {}

  async findMany(params: ListParams) {
    const { page, limit, search, chain, isActive } = params;
    const offset = (page - 1) * limit;

    const conditions: SQL[] = [isNull(customers.deletedAt)];

    if (search) {
      conditions.push(
        or(
          ilike(customers.name, `%${search}%`),
          ilike(customers.customerNumber, `%${search}%`),
          ilike(customers.city, `%${search}%`),
          ilike(customers.contactEmail, `%${search}%`)
        )!
      );
    }

    if (chain) {
      conditions.push(eq(customers.chain, chain));
    }

    if (isActive !== undefined) {
      conditions.push(eq(customers.isActive, isActive));
    }

    return this.db.query.customers.findMany({
      where: and(...conditions),
      orderBy: [asc(customers.name)],
      limit,
      offset,
    });
  }

  async findById(id: string) {
    return this.db.query.customers.findFirst({
      where: and(eq(customers.id, id), isNull(customers.deletedAt)),
    });
  }

  async findByCustomerNumber(customerNumber: string) {
    return this.db.query.customers.findFirst({
      where: and(
        eq(customers.customerNumber, customerNumber),
        isNull(customers.deletedAt)
      ),
    });
  }

  async create(data: typeof customers.$inferInsert) {
    const [result] = await this.db.insert(customers).values(data).returning();
    return result;
  }

  async update(id: string, data: Partial<typeof customers.$inferInsert>) {
    const [result] = await this.db
      .update(customers)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(customers.id, id))
      .returning();
    return result;
  }

  async softDelete(id: string) {
    const [result] = await this.db
      .update(customers)
      .set({ deletedAt: new Date() })
      .where(eq(customers.id, id))
      .returning();
    return result;
  }

  async count(params: Omit<ListParams, 'page' | 'limit'>) {
    const { search, chain, isActive } = params;
    const conditions: SQL[] = [isNull(customers.deletedAt)];

    if (search) {
      conditions.push(
        or(
          ilike(customers.name, `%${search}%`),
          ilike(customers.customerNumber, `%${search}%`)
        )!
      );
    }

    if (chain) {
      conditions.push(eq(customers.chain, chain));
    }

    if (isActive !== undefined) {
      conditions.push(eq(customers.isActive, isActive));
    }

    const result = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(customers)
      .where(and(...conditions));

    return result[0]?.count ?? 0;
  }

  async getChains() {
    const result = await this.db
      .selectDistinct({ chain: customers.chain })
      .from(customers)
      .where(and(isNull(customers.deletedAt), sql`${customers.chain} IS NOT NULL`))
      .orderBy(asc(customers.chain));

    return result.map(r => r.chain).filter(Boolean) as string[];
  }
}
```

---

### customers.service.ts

```typescript
import { TRPCError } from '@trpc/server';
import type { Database } from '../../lib/db';
import type { Logger } from 'pino';
import { CustomersRepository } from './customers.repo';

interface CreateCustomerInput {
  name: string;
  customerNumber?: string;
  chain?: string;
  address?: string;
  postalCode?: string;
  city?: string;
  county?: string;
  contactPerson?: string;
  contactEmail?: string;
  contactPhone?: string;
  orgNumber?: string;
  vismaCustomerId?: string;
  notes?: string;
}

export class CustomersService {
  private repo: CustomersRepository;

  constructor(
    private db: Database,
    private log: Logger
  ) {
    this.repo = new CustomersRepository(db);
  }

  async list(params: {
    page: number;
    limit: number;
    search?: string;
    chain?: string;
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
    const customer = await this.repo.findById(id);
    if (!customer) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Kunde ikke funnet',
      });
    }
    return customer;
  }

  async create(input: CreateCustomerInput, userId: string) {
    // Sjekk duplikat kundenummer
    if (input.customerNumber) {
      const existing = await this.repo.findByCustomerNumber(input.customerNumber);
      if (existing) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Kundenummer finnes allerede',
        });
      }
    }

    const customer = await this.repo.create({
      ...input,
      createdById: userId,
    });

    this.log.info({ customerId: customer.id }, 'Customer created');
    return customer;
  }

  async update(id: string, input: Partial<CreateCustomerInput>, userId: string) {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Kunde ikke funnet',
      });
    }

    const customer = await this.repo.update(id, {
      ...input,
      updatedById: userId,
    });

    this.log.info({ customerId: id }, 'Customer updated');
    return customer;
  }

  async delete(id: string) {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Kunde ikke funnet',
      });
    }

    await this.repo.softDelete(id);
    this.log.info({ customerId: id }, 'Customer deleted');
    return { success: true };
  }

  async getChains() {
    return this.repo.getChains();
  }

  async search(query: string) {
    return this.repo.findMany({
      page: 1,
      limit: 20,
      search: query,
      isActive: true,
    });
  }
}
```

---

### customers.router.ts

```typescript
import { z } from 'zod';
import { router, protectedProcedure } from '../../trpc/trpc';
import { CustomersService } from './customers.service';
import { assertCan } from './customers.policy';

const createInput = z.object({
  name: z.string().min(1, 'Navn er påkrevd'),
  customerNumber: z.string().optional(),
  chain: z.string().optional(),
  address: z.string().optional(),
  postalCode: z.string().optional(),
  city: z.string().optional(),
  county: z.string().optional(),
  contactPerson: z.string().optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().optional(),
  orgNumber: z.string().optional(),
  vismaCustomerId: z.string().optional(),
  notes: z.string().optional(),
});

export const customersRouter = router({
  list: protectedProcedure
    .input(z.object({
      page: z.number().int().min(1).default(1),
      limit: z.number().int().min(1).max(100).default(20),
      search: z.string().optional(),
      chain: z.string().optional(),
      isActive: z.boolean().optional(),
    }))
    .query(async ({ ctx, input }) => {
      assertCan(ctx.user, 'list');
      const service = new CustomersService(ctx.db, ctx.log);
      return service.list(input);
    }),

  byId: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      assertCan(ctx.user, 'read');
      const service = new CustomersService(ctx.db, ctx.log);
      return service.getById(input.id);
    }),

  search: protectedProcedure
    .input(z.object({ query: z.string().min(2) }))
    .query(async ({ ctx, input }) => {
      assertCan(ctx.user, 'list');
      const service = new CustomersService(ctx.db, ctx.log);
      return service.search(input.query);
    }),

  chains: protectedProcedure
    .query(async ({ ctx }) => {
      assertCan(ctx.user, 'list');
      const service = new CustomersService(ctx.db, ctx.log);
      return service.getChains();
    }),

  create: protectedProcedure
    .input(createInput)
    .mutation(async ({ ctx, input }) => {
      assertCan(ctx.user, 'create');
      const service = new CustomersService(ctx.db, ctx.log);
      return service.create(input, ctx.user.id);
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      data: createInput.partial(),
    }))
    .mutation(async ({ ctx, input }) => {
      assertCan(ctx.user, 'update');
      const service = new CustomersService(ctx.db, ctx.log);
      return service.update(input.id, input.data, ctx.user.id);
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      assertCan(ctx.user, 'delete');
      const service = new CustomersService(ctx.db, ctx.log);
      return service.delete(input.id);
    }),
});

export type CustomersRouter = typeof customersRouter;
```

---

## Oppdater AppRouter

### apps/api/src/trpc/index.ts

```typescript
import { router } from './trpc';
import { healthRouter } from '../modules/health/health.router';
import { authRouter } from '../modules/auth/auth.router';
import { claimsRouter } from '../modules/claims/claims.router';
import { suppliersRouter } from '../modules/suppliers/suppliers.router';
import { productsRouter } from '../modules/products/products.router';
import { customersRouter } from '../modules/customers/customers.router';

export const appRouter = router({
  health: healthRouter,
  auth: authRouter,
  claims: claimsRouter,
  suppliers: suppliersRouter,
  products: productsRouter,
  customers: customersRouter,
});

export type AppRouter = typeof appRouter;
```

---

## Test

```bash
# Start API
pnpm --filter @myhrvold/api dev

# Test endpoints
curl http://localhost:3000/trpc/suppliers.list
curl http://localhost:3000/trpc/products.list
curl http://localhost:3000/trpc/customers.list
curl http://localhost:3000/trpc/customers.chains
```

---

## Sjekkliste

- [ ] Suppliers: policy, repo, service, router
- [ ] Products: policy, repo, service, router
- [ ] Customers: policy, repo, service, router
- [ ] AppRouter oppdatert med alle tre
- [ ] Pagination + søk fungerer
- [ ] Dropdown-endepunkter for selects
- [ ] Soft delete implementert

---

## Neste fase

Gå til **FASE 22: CRM UI** for admin-grensesnitt.
