import { z } from 'zod';
import { eq, and, gte, lte, desc, count } from 'drizzle-orm';
import { router, protectedProcedure } from '../../trpc/trpc';
import { serviceVisits } from '@myhrvold/db/schema';

export const visitsRouter = router({
  list: protectedProcedure
    .input(z.object({
      page: z.number().int().positive().default(1),
      limit: z.number().int().positive().max(100).default(20),
      status: z.enum(['planned', 'confirmed', 'in_progress', 'completed', 'cancelled']).optional(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
      technicianId: z.string().uuid().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const { page, limit, status, dateFrom, dateTo, technicianId } = input;
      const offset = (page - 1) * limit;

      const conditions = [eq(serviceVisits.isDeleted, false)];

      if (status) {
        conditions.push(eq(serviceVisits.status, status));
      }
      if (technicianId) {
        conditions.push(eq(serviceVisits.technicianId, technicianId));
      }
      if (dateFrom) {
        conditions.push(gte(serviceVisits.plannedDate, new Date(dateFrom)));
      }
      if (dateTo) {
        conditions.push(lte(serviceVisits.plannedDate, new Date(dateTo)));
      }

      const result = await ctx.db.query.serviceVisits.findMany({
        where: and(...conditions),
        with: {
          customer: true,
          agreement: true,
          technician: true,
        },
        orderBy: [desc(serviceVisits.plannedDate)],
        limit,
        offset,
      });

      return result;
    }),

  byId: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const visit = await ctx.db.query.serviceVisits.findFirst({
        where: and(
          eq(serviceVisits.id, input.id),
          eq(serviceVisits.isDeleted, false)
        ),
        with: {
          customer: true,
          agreement: true,
          technician: true,
          partner: true,
        },
      });

      return visit;
    }),

  stats: protectedProcedure
    .query(async ({ ctx }) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const endOfDay = new Date(today);
      endOfDay.setHours(23, 59, 59, 999);

      const thisWeekStart = new Date(today);
      thisWeekStart.setDate(today.getDate() - today.getDay());
      const thisWeekEnd = new Date(thisWeekStart);
      thisWeekEnd.setDate(thisWeekStart.getDate() + 6);

      const [todayCount] = await ctx.db
        .select({ count: count() })
        .from(serviceVisits)
        .where(and(
          eq(serviceVisits.isDeleted, false),
          gte(serviceVisits.plannedDate, today),
          lte(serviceVisits.plannedDate, endOfDay)
        ));

      const [weekCount] = await ctx.db
        .select({ count: count() })
        .from(serviceVisits)
        .where(and(
          eq(serviceVisits.isDeleted, false),
          gte(serviceVisits.plannedDate, thisWeekStart),
          lte(serviceVisits.plannedDate, thisWeekEnd)
        ));

      const [plannedCount] = await ctx.db
        .select({ count: count() })
        .from(serviceVisits)
        .where(and(
          eq(serviceVisits.isDeleted, false),
          eq(serviceVisits.status, 'planned')
        ));

      const [completedCount] = await ctx.db
        .select({ count: count() })
        .from(serviceVisits)
        .where(and(
          eq(serviceVisits.isDeleted, false),
          eq(serviceVisits.status, 'completed')
        ));

      return {
        today: Number(todayCount.count),
        thisWeek: Number(weekCount.count),
        planned: Number(plannedCount.count),
        completed: Number(completedCount.count),
      };
    }),

  create: protectedProcedure
    .input(z.object({
      customerId: z.string().uuid(),
      agreementId: z.string().uuid().optional(),
      visitType: z.enum(['maintenance', 'repair', 'installation', 'inspection']),
      plannedDate: z.string(),
      plannedDuration: z.number().int().positive().optional(),
      workDescription: z.string().optional(),
      priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
    }))
    .mutation(async ({ ctx, input }) => {
      const visitNumber = `SV-${Date.now().toString(36).toUpperCase()}`;

      const [visit] = await ctx.db.insert(serviceVisits).values({
        visitNumber,
        customerId: input.customerId,
        agreementId: input.agreementId,
        visitType: input.visitType,
        plannedDate: new Date(input.plannedDate),
        plannedDuration: input.plannedDuration,
        workDescription: input.workDescription,
        priority: input.priority,
        status: 'planned',
        technicianId: ctx.user.id,
      }).returning();

      return visit;
    }),

  complete: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      workPerformed: z.string(),
      findings: z.string().optional(),
      recommendations: z.string().optional(),
      laborHours: z.number().positive().optional(),
      customerSignature: z.string().optional(),
      customerSignedBy: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      const [visit] = await ctx.db.update(serviceVisits)
        .set({
          ...data,
          status: 'completed',
          actualEndTime: new Date(),
          customerSignedAt: data.customerSignature ? new Date() : undefined,
          updatedAt: new Date(),
        })
        .where(eq(serviceVisits.id, id))
        .returning();

      return visit;
    }),
});

export type VisitsRouter = typeof visitsRouter;
