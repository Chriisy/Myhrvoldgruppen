# FASE 9: Claims API (Router/Service/Repo/Policy)

> Fase 1-8 må være fullført.
> Estimert tid: ~45 minutter.

## Mål

Implementer komplett Claims-modul med modular monolith-arkitektur.

---

## Mappestruktur

```
apps/api/src/modules/claims/
├── claims.router.ts      # ~80 linjer - tRPC endpoints
├── claims.service.ts     # ~120 linjer - Business logic
├── claims.repo.ts        # ~100 linjer - Database queries
└── claims.policy.ts      # ~40 linjer - Authorization
```

---

## apps/api/src/modules/claims/claims.policy.ts

```typescript
import { TRPCError } from '@trpc/server';
import type { ContextWithUser } from '../../trpc/context';

const CLAIM_PERMISSIONS = {
  'super_admin': ['create', 'read', 'update', 'delete', 'approve', 'assign'],
  'admin': ['create', 'read', 'update', 'delete', 'approve', 'assign'],
  'leder': ['create', 'read', 'update', 'approve', 'assign'],
  'tekniker': ['create', 'read', 'update'],
  'service': ['create', 'read', 'update'],
  'viewer': ['read'],
} as const;

type Permission = 'create' | 'read' | 'update' | 'delete' | 'approve' | 'assign';

export function canPerform(ctx: ContextWithUser, permission: Permission): boolean {
  const userRole = ctx.user.role as keyof typeof CLAIM_PERMISSIONS;
  const permissions = CLAIM_PERMISSIONS[userRole] || [];
  return permissions.includes(permission);
}

export function assertCan(ctx: ContextWithUser, permission: Permission): void {
  if (!canPerform(ctx, permission)) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: `Du har ikke tilgang til å ${getPermissionLabel(permission)} reklamasjoner`,
    });
  }
}

function getPermissionLabel(permission: Permission): string {
  const labels: Record<Permission, string> = {
    create: 'opprette',
    read: 'se',
    update: 'redigere',
    delete: 'slette',
    approve: 'godkjenne',
    assign: 'tildele',
  };
  return labels[permission];
}
```

---

## apps/api/src/modules/claims/claims.repo.ts

```typescript
import { eq, desc, and, isNull, like, or, sql } from 'drizzle-orm';
import type { Database } from '../../lib/db';
import { claims, claimParts, claimTimeline, claimAttachments } from '@myhrvold/db/schema';
import type { ClaimListInput, CreateClaimInput } from '@myhrvold/shared/schemas';

export class ClaimsRepository {
  constructor(private db: Database) {}

  async findMany(input: ClaimListInput) {
    const { page = 1, limit = 20, status, supplierId, search } = input;
    
    const conditions = [isNull(claims.deletedAt)];
    
    if (status) {
      conditions.push(eq(claims.status, status));
    }
    if (supplierId) {
      conditions.push(eq(claims.supplierId, supplierId));
    }
    if (search) {
      conditions.push(
        or(
          like(claims.claimNumber, `%${search}%`),
          like(claims.productNameText, `%${search}%`),
          like(claims.customerCompanyName, `%${search}%`)
        )
      );
    }
    
    return this.db.query.claims.findMany({
      where: and(...conditions),
      orderBy: desc(claims.createdAt),
      limit,
      offset: (page - 1) * limit,
      with: {
        supplier: true,
        customer: true,
        assignedUser: {
          columns: { id: true, firstName: true, lastName: true },
        },
      },
    });
  }

  async findById(id: string) {
    return this.db.query.claims.findFirst({
      where: and(eq(claims.id, id), isNull(claims.deletedAt)),
      with: {
        supplier: true,
        customer: true,
        product: true,
        createdBy: { columns: { id: true, firstName: true, lastName: true } },
        assignedUser: { columns: { id: true, firstName: true, lastName: true } },
        parts: { where: isNull(claimParts.deletedAt) },
        attachments: { where: isNull(claimAttachments.deletedAt) },
        timeline: { orderBy: desc(claimTimeline.createdAt) },
      },
    });
  }

  async create(data: CreateClaimInput & { claimNumber: string; createdById: string }) {
    const [claim] = await this.db.insert(claims).values(data).returning();
    return claim;
  }

  async update(id: string, data: Partial<typeof claims.$inferInsert>) {
    const [claim] = await this.db
      .update(claims)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(claims.id, id))
      .returning();
    return claim;
  }

  async softDelete(id: string, deletedBy: string) {
    return this.db
      .update(claims)
      .set({ deletedAt: new Date(), deletedBy })
      .where(eq(claims.id, id));
  }

  async generateClaimNumber(supplierId: string): Promise<string> {
    // Hent leverandør shortCode
    const supplier = await this.db.query.suppliers.findFirst({
      where: eq(suppliers.id, supplierId),
      columns: { shortCode: true },
    });
    
    const prefix = supplier?.shortCode || 'XXX';
    const date = new Date();
    const yymm = `${date.getFullYear().toString().slice(-2)}${(date.getMonth() + 1).toString().padStart(2, '0')}`;
    
    // Finn neste løpenummer
    const pattern = `${prefix}-${yymm}-%`;
    const lastClaim = await this.db.query.claims.findFirst({
      where: like(claims.claimNumber, pattern),
      orderBy: desc(claims.claimNumber),
      columns: { claimNumber: true },
    });
    
    let seq = 1;
    if (lastClaim) {
      const lastSeq = parseInt(lastClaim.claimNumber.split('-')[2], 10);
      seq = lastSeq + 1;
    }
    
    return `${prefix}-${yymm}-${seq.toString().padStart(4, '0')}`;
  }

  async addTimelineEntry(claimId: string, eventType: string, description: string, createdById?: string) {
    return this.db.insert(claimTimeline).values({
      claimId,
      eventType,
      description,
      createdById,
    });
  }
}

import { suppliers } from '@myhrvold/db/schema';
```

---

## apps/api/src/modules/claims/claims.service.ts

```typescript
import { TRPCError } from '@trpc/server';
import type { Database } from '../../lib/db';
import type { Logger } from 'pino';
import { ClaimsRepository } from './claims.repo';
import type { 
  ClaimListInput, 
  CreateClaimInput, 
  UpdateClaimInput 
} from '@myhrvold/shared/schemas';

export class ClaimsService {
  private repo: ClaimsRepository;

  constructor(
    private db: Database,
    private log: Logger
  ) {
    this.repo = new ClaimsRepository(db);
  }

  async list(input: ClaimListInput) {
    this.log.debug({ input }, 'Listing claims');
    return this.repo.findMany(input);
  }

  async getById(id: string) {
    const claim = await this.repo.findById(id);
    
    if (!claim) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Reklamasjonen ble ikke funnet',
      });
    }
    
    return claim;
  }

  async create(input: CreateClaimInput, createdById: string) {
    // Generer claim number
    const claimNumber = await this.repo.generateClaimNumber(input.supplierId);
    
    this.log.info({ claimNumber, supplierId: input.supplierId }, 'Creating claim');
    
    const claim = await this.repo.create({
      ...input,
      claimNumber,
      createdById,
      status: 'new',
    });
    
    // Logg til timeline
    await this.repo.addTimelineEntry(
      claim.id,
      'created',
      'Reklamasjon opprettet',
      createdById
    );
    
    return claim;
  }

  async update(input: UpdateClaimInput, updatedById: string) {
    const existing = await this.repo.findById(input.id);
    
    if (!existing) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Reklamasjonen ble ikke funnet',
      });
    }
    
    const { id, ...updateData } = input;
    const claim = await this.repo.update(id, updateData);
    
    // Logg status-endring
    if (input.status && input.status !== existing.status) {
      await this.repo.addTimelineEntry(
        id,
        'status_changed',
        `Status endret fra ${existing.status} til ${input.status}`,
        updatedById
      );
    }
    
    return claim;
  }

  async delete(id: string, deletedById: string) {
    const claim = await this.repo.findById(id);
    
    if (!claim) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Reklamasjonen ble ikke funnet',
      });
    }
    
    // Kun nye reklamasjoner kan slettes
    if (claim.status !== 'new') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Kun nye reklamasjoner kan slettes. Bruk "Lukk" for andre statuser.',
      });
    }
    
    await this.repo.softDelete(id, deletedById);
    
    this.log.info({ claimId: id }, 'Claim soft deleted');
    
    return { success: true };
  }

  async assign(claimId: string, assignedUserId: string, assignedById: string) {
    const claim = await this.repo.findById(claimId);
    
    if (!claim) {
      throw new TRPCError({ code: 'NOT_FOUND' });
    }
    
    await this.repo.update(claimId, { assignedUserId });
    
    await this.repo.addTimelineEntry(
      claimId,
      'assigned',
      `Reklamasjon tildelt`,
      assignedById
    );
    
    return { success: true };
  }

  async getStats() {
    // TODO: Implementer statistikk
    return {
      new: 0,
      inProgress: 0,
      pendingSupplier: 0,
      resolved: 0,
    };
  }
}
```

---

## apps/api/src/modules/claims/claims.router.ts

```typescript
import { z } from 'zod';
import { router, protectedProcedure } from '../../trpc/trpc';
import { ClaimsService } from './claims.service';
import { assertCan } from './claims.policy';
import { 
  claimListInput, 
  createClaimInput, 
  updateClaimInput 
} from '@myhrvold/shared/schemas';
import type { ContextWithUser } from '../../trpc/context';

export const claimsRouter = router({
  // Liste reklamasjoner
  list: protectedProcedure
    .input(claimListInput)
    .query(async ({ ctx, input }) => {
      assertCan(ctx as ContextWithUser, 'read');
      const service = new ClaimsService(ctx.db, ctx.log);
      return service.list(input);
    }),

  // Hent én reklamasjon
  byId: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      assertCan(ctx as ContextWithUser, 'read');
      const service = new ClaimsService(ctx.db, ctx.log);
      return service.getById(input.id);
    }),

  // Opprett reklamasjon
  create: protectedProcedure
    .input(createClaimInput)
    .mutation(async ({ ctx, input }) => {
      assertCan(ctx as ContextWithUser, 'create');
      const service = new ClaimsService(ctx.db, ctx.log);
      return service.create(input, ctx.user!.id);
    }),

  // Oppdater reklamasjon
  update: protectedProcedure
    .input(updateClaimInput)
    .mutation(async ({ ctx, input }) => {
      assertCan(ctx as ContextWithUser, 'update');
      const service = new ClaimsService(ctx.db, ctx.log);
      return service.update(input, ctx.user!.id);
    }),

  // Slett reklamasjon (soft delete)
  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      assertCan(ctx as ContextWithUser, 'delete');
      const service = new ClaimsService(ctx.db, ctx.log);
      return service.delete(input.id, ctx.user!.id);
    }),

  // Tildel reklamasjon
  assign: protectedProcedure
    .input(z.object({ 
      claimId: z.string().uuid(),
      assignedUserId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      assertCan(ctx as ContextWithUser, 'assign');
      const service = new ClaimsService(ctx.db, ctx.log);
      return service.assign(input.claimId, input.assignedUserId, ctx.user!.id);
    }),

  // Statistikk
  stats: protectedProcedure
    .query(async ({ ctx }) => {
      assertCan(ctx as ContextWithUser, 'read');
      const service = new ClaimsService(ctx.db, ctx.log);
      return service.getStats();
    }),
});

export type ClaimsRouter = typeof claimsRouter;
```

---

## Oppdater trpc/index.ts

```typescript
import { router } from './trpc';
import { healthRouter } from '../modules/health/health.router';
import { claimsRouter } from '../modules/claims/claims.router';

export const appRouter = router({
  health: healthRouter,
  claims: claimsRouter,  // <-- Legg til
});

export type AppRouter = typeof appRouter;
```

---

## Test

```bash
# Start API
pnpm --filter @myhrvold/api dev

# Test claims list (krever auth - vil feile med UNAUTHORIZED)
curl http://localhost:3000/trpc/claims.list
```

---

## Sjekkliste

- [ ] claims.policy.ts med RBAC
- [ ] claims.repo.ts med database queries
- [ ] claims.service.ts med business logic
- [ ] claims.router.ts med tRPC endpoints
- [ ] Soft delete implementert
- [ ] Timeline-logging ved opprettelse/endring
- [ ] Claim number generering (ELE-2412-0001)
- [ ] AppRouter oppdatert

---

## Neste fase

Gå til **FASE 10: Expo Setup** for frontend.
