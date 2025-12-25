import { z } from 'zod';
import { eq, and, ilike, desc, count } from 'drizzle-orm';
import { router, protectedProcedure } from '../../trpc/trpc';
import { customers } from '@myhrvold/db/schema';

export const customersRouter = router({
  list: protectedProcedure
    .input(z.object({
      page: z.number().int().positive().default(1),
      limit: z.number().int().positive().max(100).default(20),
      search: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const { page, limit, search } = input;
      const offset = (page - 1) * limit;

      const conditions = [eq(customers.isDeleted, false), eq(customers.isActive, true)];

      if (search) {
        conditions.push(ilike(customers.name, `%${search}%`));
      }

      const result = await ctx.db.query.customers.findMany({
        where: and(...conditions),
        orderBy: [desc(customers.name)],
        limit,
        offset,
      });

      return result;
    }),

  byId: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const customer = await ctx.db.query.customers.findFirst({
        where: and(eq(customers.id, input.id), eq(customers.isDeleted, false)),
      });

      return customer;
    }),

  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(200),
      orgNumber: z.string().optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      address: z.string().optional(),
      postalCode: z.string().optional(),
      city: z.string().optional(),
      contactPerson: z.string().optional(),
      contactEmail: z.string().email().optional(),
      contactPhone: z.string().optional(),
      segment: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [customer] = await ctx.db.insert(customers).values({
        ...input,
        isActive: true,
      }).returning();

      return customer;
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      name: z.string().min(1).max(200).optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      address: z.string().optional(),
      postalCode: z.string().optional(),
      city: z.string().optional(),
      contactPerson: z.string().optional(),
      contactEmail: z.string().email().optional(),
      contactPhone: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      const [customer] = await ctx.db.update(customers)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(customers.id, id))
        .returning();

      return customer;
    }),

  stats: protectedProcedure
    .query(async ({ ctx }) => {
      const [total] = await ctx.db
        .select({ count: count() })
        .from(customers)
        .where(and(eq(customers.isDeleted, false), eq(customers.isActive, true)));

      return {
        total: Number(total.count),
      };
    }),
});

export type CustomersRouter = typeof customersRouter;
