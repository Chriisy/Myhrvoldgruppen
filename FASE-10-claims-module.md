# FASE 10: Claims Module (Modular Monolith)

> Fase 9 må være fullført.
> Estimert tid: ~60 minutter.

## Mål

Implementer claims-modulen med router/service/repo/policy struktur.

---

## Mappestruktur

```
apps/api/src/modules/claims/
├── claims.router.ts    # tRPC endpoints (~80 linjer)
├── claims.service.ts   # Forretningslogikk (~150 linjer)
├── claims.repo.ts      # Database queries (~100 linjer)
└── claims.policy.ts    # RBAC (~40 linjer)
```

---

## claims.policy.ts

```typescript
import type { User } from '../../trpc/context';
import { ROLES } from '../auth/auth.policy';

export function canViewClaim(user: User, claim: { assignedUserId?: string | null; createdById: string }): boolean {
  // Alle kan se claims de er assigned til eller har opprettet
  if (claim.assignedUserId === user.id || claim.createdById === user.id) {
    return true;
  }
  // Admin/ledere kan se alle
  return [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.LEADER, ROLES.SERVICE].includes(user.role as any);
}

export function canEditClaim(user: User, claim: { status: string; createdById: string }): boolean {
  // Kun utkast/nye kan redigeres av alle
  if (['draft', 'new'].includes(claim.status)) {
    return true;
  }
  // Ellers kun admin/ledere
  return [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.LEADER].includes(user.role as any);
}

export function canDeleteClaim(user: User, claim: { status: string }): boolean {
  // Kun utkast kan slettes
  if (claim.status !== 'draft') return false;
  return [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.LEADER].includes(user.role as any);
}
```

---

## claims.repo.ts

```typescript
import { eq, and, isNull, desc, like, or, sql } from 'drizzle-orm';
import { claims, claimTimeline, claimParts, claimAttachments, suppliers } from '@myhrvold/db/schema';
import type { Database } from '../../lib/db';
import type { ClaimFiltersInput } from '@myhrvold/shared/schemas';

export function createClaimsRepo(db: Database) {
  return {
    async list(filters: ClaimFiltersInput) {
      const { status, supplierId, search, page, limit } = filters;
      
      const conditions = [isNull(claims.deletedAt)];
      if (status) conditions.push(eq(claims.status, status as any));
      if (supplierId) conditions.push(eq(claims.supplierId, supplierId));
      if (search) {
        conditions.push(
          or(
            like(claims.claimNumber, `%${search}%`),
            like(claims.productNameText, `%${search}%`)
          )!
        );
      }

      return db.query.claims.findMany({
        where: and(...conditions),
        orderBy: desc(claims.createdAt),
        limit,
        offset: (page - 1) * limit,
        with: {
          supplier: true,
          customer: true,
          assignedUser: true,
        },
      });
    },

    async findById(id: string) {
      return db.query.claims.findFirst({
        where: and(eq(claims.id, id), isNull(claims.deletedAt)),
        with: {
          supplier: true,
          customer: true,
          product: true,
          createdBy: true,
          assignedUser: true,
          parts: true,
          attachments: true,
          timeline: { orderBy: desc(claimTimeline.createdAt) },
        },
      });
    },

    async create(data: typeof claims.$inferInsert) {
      const [claim] = await db.insert(claims).values(data).returning();
      return claim;
    },

    async update(id: string, data: Partial<typeof claims.$inferInsert>) {
      const [claim] = await db.update(claims)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(claims.id, id))
        .returning();
      return claim;
    },

    async softDelete(id: string, userId: string) {
      await db.update(claims)
        .set({ deletedAt: new Date(), deletedBy: userId })
        .where(eq(claims.id, id));
    },

    async addTimelineEvent(data: typeof claimTimeline.$inferInsert) {
      const [event] = await db.insert(claimTimeline).values(data).returning();
      return event;
    },

    async getNextClaimNumber(supplierId: string) {
      const supplier = await db.query.suppliers.findFirst({
        where: eq(suppliers.id, supplierId),
      });
      
      const prefix = supplier?.shortCode || 'XXX';
      const date = new Date();
      const yymm = `${date.getFullYear().toString().slice(-2)}${(date.getMonth() + 1).toString().padStart(2, '0')}`;
      const pattern = `${prefix}-${yymm}-%`;

      const result = await db
        .select({ claimNumber: claims.claimNumber })
        .from(claims)
        .where(like(claims.claimNumber, pattern))
        .orderBy(desc(claims.claimNumber))
        .limit(1);

      let seq = 1;
      if (result.length > 0) {
        const lastSeq = parseInt(result[0].claimNumber.split('-')[2], 10);
        seq = lastSeq + 1;
      }

      return `${prefix}-${yymm}-${seq.toString().padStart(4, '0')}`;
    },
  };
}

export type ClaimsRepo = ReturnType<typeof createClaimsRepo>;
```

---

## claims.service.ts

```typescript
import { TRPCError } from '@trpc/server';
import { nanoid } from 'nanoid';
import type { ClaimsRepo } from './claims.repo';
import type { Logger } from 'pino';
import type { User } from '../../trpc/context';
import type { CreateClaimInput } from '@myhrvold/shared/schemas';
import { canEditClaim, canDeleteClaim } from './claims.policy';

export function createClaimsService(repo: ClaimsRepo, log: Logger) {
  return {
    async list(filters: any) {
      return repo.list(filters);
    },

    async getById(id: string, user: User) {
      const claim = await repo.findById(id);
      if (!claim) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Reklamasjonen ble ikke funnet',
        });
      }
      return claim;
    },

    async create(input: CreateClaimInput, user: User) {
      const claimNumber = await repo.getNextClaimNumber(input.supplierId);
      const verificationCode = nanoid(6).toUpperCase();

      const claim = await repo.create({
        ...input,
        claimNumber,
        supplierVerificationCode: verificationCode,
        createdById: user.id,
        status: 'draft',
        purchaseDate: input.purchaseDate ? new Date(input.purchaseDate) : null,
        installationDate: input.installationDate ? new Date(input.installationDate) : null,
      });

      await repo.addTimelineEvent({
        claimId: claim.id,
        eventType: 'created',
        description: 'Reklamasjon opprettet',
        createdById: user.id,
      });

      log.info({ claimId: claim.id, claimNumber }, 'Claim created');
      return claim;
    },

    async update(id: string, input: Partial<CreateClaimInput>, user: User) {
      const existing = await repo.findById(id);
      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      if (!canEditClaim(user, existing)) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Du har ikke tilgang til å redigere denne reklamasjonen',
        });
      }

      const claim = await repo.update(id, input);

      await repo.addTimelineEvent({
        claimId: id,
        eventType: 'updated',
        description: 'Reklamasjon oppdatert',
        createdById: user.id,
        oldValue: existing,
        newValue: claim,
      });

      return claim;
    },

    async updateStatus(id: string, status: string, user: User) {
      const existing = await repo.findById(id);
      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      const claim = await repo.update(id, { status: status as any });

      await repo.addTimelineEvent({
        claimId: id,
        eventType: 'status_changed',
        description: `Status endret til ${status}`,
        createdById: user.id,
        oldValue: { status: existing.status },
        newValue: { status },
      });

      log.info({ claimId: id, status }, 'Claim status updated');
      return claim;
    },

    async delete(id: string, user: User) {
      const existing = await repo.findById(id);
      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      if (!canDeleteClaim(user, existing)) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Kun utkast kan slettes',
        });
      }

      await repo.softDelete(id, user.id);
      log.info({ claimId: id }, 'Claim deleted');
      return { success: true };
    },
  };
}

export type ClaimsService = ReturnType<typeof createClaimsService>;
```

---

## claims.router.ts

```typescript
import { router, protectedProcedure } from '../../trpc/trpc';
import { z } from 'zod';
import { createClaimInput, claimFiltersInput } from '@myhrvold/shared/schemas';
import { createClaimsRepo } from './claims.repo';
import { createClaimsService } from './claims.service';

export const claimsRouter = router({
  list: protectedProcedure
    .input(claimFiltersInput)
    .query(async ({ ctx, input }) => {
      const repo = createClaimsRepo(ctx.db);
      const service = createClaimsService(repo, ctx.log);
      return service.list(input);
    }),

  byId: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const repo = createClaimsRepo(ctx.db);
      const service = createClaimsService(repo, ctx.log);
      return service.getById(input.id, ctx.user!);
    }),

  create: protectedProcedure
    .input(createClaimInput)
    .mutation(async ({ ctx, input }) => {
      const repo = createClaimsRepo(ctx.db);
      const service = createClaimsService(repo, ctx.log);
      return service.create(input, ctx.user!);
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      data: createClaimInput.partial(),
    }))
    .mutation(async ({ ctx, input }) => {
      const repo = createClaimsRepo(ctx.db);
      const service = createClaimsService(repo, ctx.log);
      return service.update(input.id, input.data, ctx.user!);
    }),

  updateStatus: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      status: z.enum(['draft', 'new', 'in_progress', 'pending_supplier', 'resolved', 'closed']),
    }))
    .mutation(async ({ ctx, input }) => {
      const repo = createClaimsRepo(ctx.db);
      const service = createClaimsService(repo, ctx.log);
      return service.updateStatus(input.id, input.status, ctx.user!);
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const repo = createClaimsRepo(ctx.db);
      const service = createClaimsService(repo, ctx.log);
      return service.delete(input.id, ctx.user!);
    }),
});
```

---

## Oppdater root router

```typescript
// src/trpc/index.ts
import { router } from './trpc';
import { healthRouter } from '../modules/health/health.router';
import { authRouter } from '../modules/auth/auth.router';
import { claimsRouter } from '../modules/claims/claims.router';

export const appRouter = router({
  health: healthRouter,
  auth: authRouter,
  claims: claimsRouter,
});

export type AppRouter = typeof appRouter;
```

---

## Test

```bash
# Test list
curl http://localhost:3000/trpc/claims.list \
  -H "Authorization: Bearer <token>"
```

---

## Sjekkliste

- [ ] claims.policy.ts < 50 linjer
- [ ] claims.repo.ts < 120 linjer
- [ ] claims.service.ts < 150 linjer
- [ ] claims.router.ts < 80 linjer
- [ ] Timeline logging fungerer
- [ ] ClaimNumber genereres riktig
- [ ] Soft delete fungerer
