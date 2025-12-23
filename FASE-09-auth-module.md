# FASE 9: Auth Module (Modular Monolith)

> Fase 8 må være fullført.
> Estimert tid: ~45 minutter.

## Mål

Implementer auth-modulen med router/service/repo/policy struktur.

---

## Mappestruktur

```
apps/api/src/modules/auth/
├── auth.router.ts      # tRPC endpoints (~60 linjer)
├── auth.service.ts     # Forretningslogikk (~80 linjer)
├── auth.repo.ts        # Database queries (~50 linjer)
└── auth.policy.ts      # RBAC (~30 linjer)
```

---

## auth.policy.ts

```typescript
import type { User } from '../../trpc/context';

export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  LEADER: 'leader',
  TECHNICIAN: 'technician',
  SERVICE: 'service',
  VIEWER: 'viewer',
} as const;

export type Role = typeof ROLES[keyof typeof ROLES];

export function canManageUsers(user: User): boolean {
  return [ROLES.SUPER_ADMIN, ROLES.ADMIN].includes(user.role as Role);
}

export function canAccessAdmin(user: User): boolean {
  return [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.LEADER].includes(user.role as Role);
}

export function canCreateClaims(user: User): boolean {
  return user.role !== ROLES.VIEWER;
}
```

---

## auth.repo.ts

```typescript
import { eq, and, gt } from 'drizzle-orm';
import { users, sessions } from '@myhrvold/db/schema';
import type { Database } from '../../lib/db';

export function createAuthRepo(db: Database) {
  return {
    async findUserByEmail(email: string) {
      return db.query.users.findFirst({
        where: eq(users.email, email),
      });
    },

    async findUserById(id: string) {
      return db.query.users.findFirst({
        where: eq(users.id, id),
      });
    },

    async createSession(data: {
      userId: string;
      token: string;
      expiresAt: Date;
      userAgent?: string;
      ipAddress?: string;
    }) {
      const [session] = await db.insert(sessions).values(data).returning();
      return session;
    },

    async findSessionByToken(token: string) {
      return db.query.sessions.findFirst({
        where: and(
          eq(sessions.token, token),
          gt(sessions.expiresAt, new Date())
        ),
        with: { user: true },
      });
    },

    async deleteSession(token: string) {
      await db.delete(sessions).where(eq(sessions.token, token));
    },

    async updateLastLogin(userId: string) {
      await db.update(users)
        .set({ lastLoginAt: new Date() })
        .where(eq(users.id, userId));
    },
  };
}

export type AuthRepo = ReturnType<typeof createAuthRepo>;
```

---

## auth.service.ts

```typescript
import bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { TRPCError } from '@trpc/server';
import type { AuthRepo } from './auth.repo';
import type { Logger } from 'pino';

export function createAuthService(repo: AuthRepo, log: Logger) {
  return {
    async login(email: string, password: string, meta: { userAgent?: string; ipAddress?: string }) {
      const user = await repo.findUserByEmail(email);
      
      if (!user || !user.password) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Ugyldig e-post eller passord',
        });
      }

      if (!user.isActive) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Kontoen din er deaktivert',
        });
      }

      const valid = await bcrypt.compare(password, user.password);
      if (!valid) {
        log.warn({ email }, 'Failed login attempt');
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Ugyldig e-post eller passord',
        });
      }

      const token = randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 dager

      await repo.createSession({
        userId: user.id,
        token,
        expiresAt,
        userAgent: meta.userAgent,
        ipAddress: meta.ipAddress,
      });

      await repo.updateLastLogin(user.id);

      log.info({ userId: user.id }, 'User logged in');

      return {
        token,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
        },
      };
    },

    async logout(token: string) {
      await repo.deleteSession(token);
    },

    async validateSession(token: string) {
      const session = await repo.findSessionByToken(token);
      if (!session) return null;
      
      return {
        id: session.user.id,
        email: session.user.email,
        firstName: session.user.firstName,
        lastName: session.user.lastName,
        role: session.user.role,
      };
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
```

---

## auth.router.ts

```typescript
import { router, publicProcedure, protectedProcedure } from '../../trpc/trpc';
import { loginInput } from '@myhrvold/shared/schemas';
import { createAuthRepo } from './auth.repo';
import { createAuthService } from './auth.service';

export const authRouter = router({
  login: publicProcedure
    .input(loginInput)
    .mutation(async ({ ctx, input }) => {
      const repo = createAuthRepo(ctx.db);
      const service = createAuthService(repo, ctx.log);
      
      return service.login(input.email, input.password, {
        userAgent: ctx.req.headers['user-agent'],
        ipAddress: ctx.req.ip,
      });
    }),

  logout: protectedProcedure
    .mutation(async ({ ctx }) => {
      const token = ctx.req.headers.authorization?.replace('Bearer ', '');
      if (token) {
        const repo = createAuthRepo(ctx.db);
        const service = createAuthService(repo, ctx.log);
        await service.logout(token);
      }
      return { success: true };
    }),

  me: protectedProcedure
    .query(async ({ ctx }) => {
      return ctx.user;
    }),
});
```

---

## Oppdater context.ts

```typescript
// src/trpc/context.ts - oppdater createContext

import { createAuthRepo } from '../modules/auth/auth.repo';
import { createAuthService } from '../modules/auth/auth.service';

export async function createContext({ 
  req, 
  res 
}: { 
  req: FastifyRequest; 
  res: FastifyReply;
}): Promise<Context> {
  const correlationId = req.correlationId || 'unknown';
  const log = logger.child({ correlationId });

  // Hent user fra session
  let user: User | null = null;
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (token) {
    const repo = createAuthRepo(db);
    const service = createAuthService(repo, log);
    user = await service.validateSession(token);
  }

  return { req, res, db, log, user, correlationId };
}
```

---

## Oppdater root router

```typescript
// src/trpc/index.ts
import { router } from './trpc';
import { healthRouter } from '../modules/health/health.router';
import { authRouter } from '../modules/auth/auth.router';

export const appRouter = router({
  health: healthRouter,
  auth: authRouter,
});

export type AppRouter = typeof appRouter;
```

---

## Test

```bash
# Start API
pnpm --filter @myhrvold/api dev

# Test login (krever testbruker i DB)
curl -X POST http://localhost:3000/trpc/auth.login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

---

## Sjekkliste

- [ ] auth.policy.ts med RBAC
- [ ] auth.repo.ts < 60 linjer
- [ ] auth.service.ts < 100 linjer
- [ ] auth.router.ts < 50 linjer
- [ ] Context henter user fra session
- [ ] Login/logout fungerer
