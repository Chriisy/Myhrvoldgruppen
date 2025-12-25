import { z } from 'zod';
import { eq, and, ilike, desc } from 'drizzle-orm';
import { router, protectedProcedure } from '../../trpc/trpc';
import { suppliers } from '@myhrvold/db/schema';

export const suppliersRouter = router({
  list: protectedProcedure
    .input(z.object({
      search: z.string().optional(),
      limit: z.number().int().positive().max(100).default(20),
    }))
    .query(async ({ ctx, input }) => {
      const conditions = [eq(suppliers.isDeleted, false), eq(suppliers.isActive, true)];

      if (input.search) {
        conditions.push(
          ilike(suppliers.name, `%${input.search}%`)
        );
      }

      const result = await ctx.db.query.suppliers.findMany({
        where: and(...conditions),
        orderBy: [desc(suppliers.name)],
        limit: input.limit,
      });

      return result;
    }),

  byId: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const supplier = await ctx.db.query.suppliers.findFirst({
        where: and(eq(suppliers.id, input.id), eq(suppliers.isDeleted, false)),
        with: {
          products: true,
        },
      });

      return supplier;
    }),
});

export type SuppliersRouter = typeof suppliersRouter;
