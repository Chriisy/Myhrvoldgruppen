# FASE 8: API Setup (Fastify + tRPC)

> Fase 1-7 (database) må være fullført.
> Estimert tid: ~45 minutter.

## Mål

Sett opp backend API med Fastify og tRPC i modular monolith-arkitektur.

---

## Mappestruktur

```
apps/api/
├── package.json
├── tsconfig.json
├── .env.example
└── src/
    ├── index.ts              # Entry point
    ├── app.ts                # Fastify setup
    ├── lib/
    │   ├── db.ts            # Database connection
    │   ├── logger.ts        # Pino logger med correlation ID
    │   └── env.ts           # Environment variables
    ├── plugins/
    │   └── correlation-id.ts
    ├── trpc/
    │   ├── trpc.ts          # tRPC setup
    │   ├── context.ts       # Request context
    │   └── index.ts         # App router
    └── modules/
        └── health/
            └── health.router.ts
```

---

## apps/api/package.json

```json
{
  "name": "@myhrvold/api",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "lint": "eslint src/",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "fastify": "^5.0.0",
    "@fastify/cors": "^10.0.0",
    "@fastify/cookie": "^11.0.0",
    "@trpc/server": "^11.0.0",
    "@myhrvold/db": "workspace:*",
    "@myhrvold/shared": "workspace:*",
    "zod": "^3.23.0",
    "pino": "^9.0.0",
    "pino-pretty": "^11.0.0",
    "dotenv": "^16.4.0",
    "bcrypt": "^5.1.0",
    "superjson": "^2.2.0"
  },
  "devDependencies": {
    "@types/bcrypt": "^5.0.0",
    "@types/node": "^22.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.6.0"
  }
}
```

---

## apps/api/.env.example

```env
# Server
PORT=3000
HOST=0.0.0.0
NODE_ENV=development

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/myhrvold

# Auth
JWT_SECRET=your-super-secret-jwt-key-change-in-production-min-32-chars
SESSION_SECRET=your-session-secret-change-in-production-min-32-chars

# CORS
CORS_ORIGIN=http://localhost:8081

# Logging
LOG_LEVEL=info
```

---

## apps/api/src/lib/env.ts

```typescript
import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  SESSION_SECRET: z.string().min(32),
  CORS_ORIGIN: z.string().default('http://localhost:8081'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export const env = envSchema.parse(process.env);
export type Env = z.infer<typeof envSchema>;
```

---

## apps/api/src/lib/logger.ts

```typescript
import pino from 'pino';
import { env } from './env';

export const logger = pino({
  level: env.LOG_LEVEL,
  transport: env.NODE_ENV === 'development' 
    ? { 
        target: 'pino-pretty', 
        options: { 
          colorize: true,
          translateTime: 'HH:MM:ss',
          ignore: 'pid,hostname',
        } 
      }
    : undefined,
  base: {
    service: 'myhrvold-api',
    env: env.NODE_ENV,
  },
});

export type Logger = typeof logger;

// Child logger med correlation ID
export function createChildLogger(correlationId: string) {
  return logger.child({ correlationId });
}
```

---

## apps/api/src/lib/db.ts

```typescript
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '@myhrvold/db/schema';
import { env } from './env';
import { logger } from './logger';

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('connect', () => {
  logger.debug('Database pool: new connection');
});

pool.on('error', (err) => {
  logger.error({ err }, 'Database pool error');
});

export const db = drizzle(pool, { schema });
export type Database = typeof db;

// Health check
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}
```

---

## apps/api/src/plugins/correlation-id.ts

```typescript
import { FastifyPluginAsync } from 'fastify';
import { randomUUID } from 'crypto';
import fp from 'fastify-plugin';

declare module 'fastify' {
  interface FastifyRequest {
    correlationId: string;
  }
}

const correlationIdPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onRequest', async (request) => {
    request.correlationId = 
      (request.headers['x-correlation-id'] as string) || randomUUID();
  });

  fastify.addHook('onSend', async (request, reply) => {
    reply.header('x-correlation-id', request.correlationId);
  });
};

export default fp(correlationIdPlugin, { 
  name: 'correlation-id',
});
```

---

## apps/api/src/trpc/trpc.ts

```typescript
import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import type { Context } from './context';

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        correlationId: error.cause?.correlationId,
      },
    };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;
export const middleware = t.middleware;

// Logging middleware
const loggerMiddleware = middleware(async ({ path, type, next, ctx }) => {
  const start = Date.now();
  const result = await next();
  const duration = Date.now() - start;
  
  ctx.log.info({ path, type, duration, success: result.ok }, 'tRPC request');
  
  return result;
});

// Auth middleware
const isAuthed = middleware(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Du må logge inn for å fortsette',
    });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

// Role middleware factory
export function hasRole(...roles: string[]) {
  return middleware(async ({ ctx, next }) => {
    if (!ctx.user) {
      throw new TRPCError({ code: 'UNAUTHORIZED' });
    }
    if (!roles.includes(ctx.user.role)) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Du har ikke tilgang til denne funksjonen',
      });
    }
    return next();
  });
}

// Procedure types
export const loggedProcedure = t.procedure.use(loggerMiddleware);
export const protectedProcedure = loggedProcedure.use(isAuthed);
export const adminProcedure = protectedProcedure.use(hasRole('admin', 'super_admin'));
```

---

## apps/api/src/trpc/context.ts

```typescript
import type { FastifyRequest, FastifyReply } from 'fastify';
import type { Database } from '../lib/db';
import type { Logger } from 'pino';
import { db } from '../lib/db';
import { createChildLogger } from '../lib/logger';

export interface User {
  id: string;
  email: string;
  role: string;
  firstName?: string | null;
  lastName?: string | null;
  departmentId?: string | null;
}

export interface Context {
  req: FastifyRequest;
  res: FastifyReply;
  db: Database;
  log: Logger;
  user: User | null;
  correlationId: string;
}

export async function createContext({ 
  req, 
  res 
}: { 
  req: FastifyRequest; 
  res: FastifyReply;
}): Promise<Context> {
  const correlationId = req.correlationId || 'unknown';
  const log = createChildLogger(correlationId);

  // TODO: Implementer auth i fase 11
  // Parse token fra Authorization header
  const user: User | null = null;

  return {
    req,
    res,
    db,
    log,
    user,
    correlationId,
  };
}

export type ContextWithUser = Omit<Context, 'user'> & { user: User };
```

---

## apps/api/src/modules/health/health.router.ts

```typescript
import { router, publicProcedure } from '../../trpc/trpc';
import { checkDatabaseConnection } from '../../lib/db';
import { z } from 'zod';

export const healthRouter = router({
  ping: publicProcedure
    .query(() => {
      return { 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        service: 'myhrvold-api',
      };
    }),

  check: publicProcedure
    .query(async ({ ctx }) => {
      const dbConnected = await checkDatabaseConnection();
      
      return {
        status: dbConnected ? 'healthy' : 'unhealthy',
        checks: {
          database: dbConnected ? 'connected' : 'disconnected',
        },
        timestamp: new Date().toISOString(),
      };
    }),

  // Echo for testing
  echo: publicProcedure
    .input(z.object({ message: z.string() }))
    .query(({ input }) => {
      return { echo: input.message };
    }),
});

export type HealthRouter = typeof healthRouter;
```

---

## apps/api/src/trpc/index.ts

```typescript
import { router } from './trpc';
import { healthRouter } from '../modules/health/health.router';

// Import flere routers etterhvert:
// import { authRouter } from '../modules/auth/auth.router';
// import { claimsRouter } from '../modules/claims/claims.router';

export const appRouter = router({
  health: healthRouter,
  // auth: authRouter,
  // claims: claimsRouter,
});

export type AppRouter = typeof appRouter;
```

---

## apps/api/src/app.ts

```typescript
import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';
import { appRouter } from './trpc';
import { createContext } from './trpc/context';
import correlationIdPlugin from './plugins/correlation-id';
import { env } from './lib/env';
import { logger } from './lib/logger';

export async function buildApp() {
  const app = Fastify({
    logger: false, // Vi bruker vår egen logger
  });

  // Plugins
  await app.register(correlationIdPlugin);
  
  await app.register(cors, {
    origin: env.CORS_ORIGIN.split(','),
    credentials: true,
  });

  await app.register(cookie, {
    secret: env.SESSION_SECRET,
  });

  // tRPC
  await app.register(fastifyTRPCPlugin, {
    prefix: '/trpc',
    trpcOptions: {
      router: appRouter,
      createContext,
      onError({ error, path, ctx }) {
        logger.error({
          error: error.message,
          code: error.code,
          path,
          correlationId: ctx?.correlationId,
        }, 'tRPC error');
      },
    },
  });

  // Health endpoint (utenom tRPC for load balancers)
  app.get('/health', async () => {
    return { status: 'ok' };
  });

  // Ready endpoint
  app.get('/ready', async () => {
    return { ready: true };
  });

  return app;
}
```

---

## apps/api/src/index.ts

```typescript
import { buildApp } from './app';
import { env } from './lib/env';
import { logger } from './lib/logger';

async function main() {
  const app = await buildApp();

  try {
    await app.listen({ 
      port: env.PORT, 
      host: env.HOST,
    });
    
    logger.info(`🚀 API kjører på http://${env.HOST}:${env.PORT}`);
    logger.info(`📡 tRPC endpoint: http://${env.HOST}:${env.PORT}/trpc`);
    logger.info(`💚 Health: http://${env.HOST}:${env.PORT}/health`);
  } catch (err) {
    logger.error(err, 'Failed to start server');
    process.exit(1);
  }
}

main();
```

---

## apps/api/tsconfig.json

```json
{
  "extends": "../../tooling/typescript/base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "target": "ES2022",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

---

## Test

```bash
# Installer dependencies
pnpm install

# Kopier .env
cp apps/api/.env.example apps/api/.env
# Rediger DATABASE_URL til din database

# Start API
pnpm --filter @myhrvold/api dev
```

Forventet output:
```
🚀 API kjører på http://0.0.0.0:3000
📡 tRPC endpoint: http://0.0.0.0:3000/trpc
💚 Health: http://0.0.0.0:3000/health
```

Test endpoints:
```bash
# Health check (for load balancers)
curl http://localhost:3000/health

# tRPC ping
curl http://localhost:3000/trpc/health.ping

# tRPC health check
curl http://localhost:3000/trpc/health.check

# tRPC echo
curl "http://localhost:3000/trpc/health.echo?input=%7B%22message%22%3A%22hei%22%7D"
```

---

## Sjekkliste

- [ ] package.json med alle dependencies
- [ ] Environment variables oppsett med Zod
- [ ] Pino logger med correlation ID
- [ ] Database connection med pool
- [ ] tRPC setup med context
- [ ] Health router fungerer
- [ ] CORS konfigurert
- [ ] Server starter uten feil
- [ ] `/health` returnerer OK
- [ ] `/trpc/health.ping` returnerer OK

---

## Neste fase

Gå til **FASE 9: API Routers** for claims, suppliers, customers.
