import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import type { Context, ContextWithUser } from './context';

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof Error ? error.cause.message : null,
      },
    };
  },
});

// Base router and procedure
export const router = t.router;
export const publicProcedure = t.procedure;

// Auth middleware
const isAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Du må være innlogget' });
  }
  return next({
    ctx: ctx as ContextWithUser,
  });
});

export const protectedProcedure = t.procedure.use(isAuthed);

// Admin middleware
const isAdmin = t.middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Du må være innlogget' });
  }
  if (ctx.user.role !== 'admin' && ctx.user.role !== 'manager') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Ingen tilgang' });
  }
  return next({
    ctx: ctx as ContextWithUser,
  });
});

export const adminProcedure = t.procedure.use(isAdmin);
