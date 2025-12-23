import { z } from 'zod';
import { eq, and, ilike, desc, gte, lte, count, sql } from 'drizzle-orm';
import { router, protectedProcedure } from '../../trpc/trpc';
import { serviceAgreements } from '@myhrvold/db/schema';

export const agreementsRouter = router({
  list: protectedProcedure
    .input(z.object({
      page: z.number().int().positive().default(1),
      limit: z.number().int().positive().max(100).default(20),
      search: z.string().optional(),
      status: z.enum(['active', 'expired', 'cancelled', 'pending']).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const { page, limit, search, status } = input;
      const offset = (page - 1) * limit;

      const conditions = [eq(serviceAgreements.isDeleted, false)];

      if (status) {
        conditions.push(eq(serviceAgreements.status, status));
      }
      if (search) {
        conditions.push(ilike(serviceAgreements.name, `%${search}%`));
      }

      const result = await ctx.db.query.serviceAgreements.findMany({
        where: and(...conditions),
        with: {
          customer: true,
        },
        orderBy: [desc(serviceAgreements.createdAt)],
        limit,
        offset,
      });

      return result;
    }),

  byId: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const agreement = await ctx.db.query.serviceAgreements.findFirst({
        where: and(
          eq(serviceAgreements.id, input.id),
          eq(serviceAgreements.isDeleted, false)
        ),
        with: {
          customer: true,
          visits: {
            orderBy: [desc(sql`planned_date`)],
            limit: 10,
          },
        },
      });

      return agreement;
    }),

  stats: protectedProcedure
    .query(async ({ ctx }) => {
      const today = new Date();
      const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

      const [total] = await ctx.db
        .select({ count: count() })
        .from(serviceAgreements)
        .where(eq(serviceAgreements.isDeleted, false));

      const [active] = await ctx.db
        .select({ count: count() })
        .from(serviceAgreements)
        .where(and(
          eq(serviceAgreements.isDeleted, false),
          eq(serviceAgreements.status, 'active')
        ));

      const [expiringSoon] = await ctx.db
        .select({ count: count() })
        .from(serviceAgreements)
        .where(and(
          eq(serviceAgreements.isDeleted, false),
          eq(serviceAgreements.status, 'active'),
          lte(serviceAgreements.endDate, thirtyDaysFromNow.toISOString().split('T')[0])
        ));

      return {
        total: Number(total.count),
        active: Number(active.count),
        expiringSoon: Number(expiringSoon.count),
        expired: Number(total.count) - Number(active.count),
      };
    }),

  create: protectedProcedure
    .input(z.object({
      customerId: z.string().uuid(),
      name: z.string().min(1).max(200),
      description: z.string().optional(),
      agreementType: z.string().optional(),
      startDate: z.string(),
      endDate: z.string().optional(),
      annualValue: z.number().positive().optional(),
      visitsPerYear: z.number().int().positive().default(4),
    }))
    .mutation(async ({ ctx, input }) => {
      const agreementNumber = `VA-${Date.now().toString(36).toUpperCase()}`;

      const [agreement] = await ctx.db.insert(serviceAgreements).values({
        agreementNumber,
        customerId: input.customerId,
        name: input.name,
        description: input.description,
        agreementType: input.agreementType,
        startDate: input.startDate,
        endDate: input.endDate,
        annualValue: input.annualValue?.toString(),
        visitsPerYear: input.visitsPerYear,
        status: 'active',
        createdById: ctx.user.id,
      }).returning();

      return agreement;
    }),
});

export type AgreementsRouter = typeof agreementsRouter;
