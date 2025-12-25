import { z } from 'zod';
import { eq, and, ilike, desc, count, gte, lte } from 'drizzle-orm';
import { router, protectedProcedure } from '../../trpc/trpc';
import { installations } from '@myhrvold/db/schema';

// Generate installation number
function generateInstallationNumber(): string {
  const year = new Date().getFullYear();
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `IN${year}-${random}`;
}

export const installationsRouter = router({
  // List installations
  list: protectedProcedure
    .input(z.object({
      page: z.number().int().positive().default(1),
      limit: z.number().int().positive().max(100).default(20),
      search: z.string().optional(),
      status: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const { page, limit, search, status } = input;
      const offset = (page - 1) * limit;

      const conditions = [eq(installations.isDeleted, false)];

      if (search) {
        conditions.push(ilike(installations.productName, `%${search}%`));
      }

      if (status) {
        conditions.push(eq(installations.status, status));
      }

      const result = await ctx.db.query.installations.findMany({
        where: and(...conditions),
        orderBy: [desc(installations.plannedDate)],
        limit,
        offset,
        with: {
          customer: true,
          supplier: true,
          technician: true,
        },
      });

      return result;
    }),

  // Get by ID
  byId: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const installation = await ctx.db.query.installations.findFirst({
        where: and(
          eq(installations.id, input.id),
          eq(installations.isDeleted, false)
        ),
        with: {
          customer: true,
          supplier: true,
          product: true,
          technician: true,
          createdBy: true,
        },
      });

      return installation;
    }),

  // Create installation
  create: protectedProcedure
    .input(z.object({
      customerId: z.string().uuid(),
      supplierId: z.string().uuid().optional(),
      productId: z.string().uuid().optional(),
      productName: z.string(),
      serialNumber: z.string().optional(),
      quantity: z.number().int().positive().default(1),
      plannedDate: z.date().optional(),
      installationAddress: z.string().optional(),
      installationPostalCode: z.string().optional(),
      installationCity: z.string().optional(),
      floor: z.string().optional(),
      accessInstructions: z.string().optional(),
      electricalRequirements: z.string().optional(),
      plumbingRequirements: z.string().optional(),
      ventilationRequirements: z.string().optional(),
      otherRequirements: z.string().optional(),
      workDescription: z.string().optional(),
      notes: z.string().optional(),
      technicianId: z.string().uuid().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const installationNumber = generateInstallationNumber();

      const [installation] = await ctx.db.insert(installations).values({
        installationNumber,
        ...input,
        status: 'planned',
        priority: 'normal',
        createdById: ctx.user?.id,
      }).returning();

      return installation;
    }),

  // Update installation
  update: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      status: z.string().optional(),
      priority: z.string().optional(),
      plannedDate: z.date().optional(),
      confirmedDate: z.date().optional(),
      technicianId: z.string().uuid().optional(),
      installationAddress: z.string().optional(),
      workDescription: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      const [installation] = await ctx.db.update(installations)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(installations.id, id))
        .returning();

      return installation;
    }),

  // Complete installation
  complete: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      workDescription: z.string(),
      laborCost: z.number().nonnegative().optional(),
      materialCost: z.number().nonnegative().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, laborCost, materialCost, ...data } = input;

      const totalCost = (laborCost || 0) + (materialCost || 0);

      const [installation] = await ctx.db.update(installations)
        .set({
          ...data,
          laborCost: laborCost?.toString(),
          materialCost: materialCost?.toString(),
          totalCost: totalCost.toString(),
          status: 'completed',
          completedDate: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(installations.id, id))
        .returning();

      return installation;
    }),

  // Stats
  stats: protectedProcedure
    .query(async ({ ctx }) => {
      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());

      const [planned] = await ctx.db
        .select({ count: count() })
        .from(installations)
        .where(and(
          eq(installations.isDeleted, false),
          eq(installations.status, 'planned')
        ));

      const [thisWeek] = await ctx.db
        .select({ count: count() })
        .from(installations)
        .where(and(
          eq(installations.isDeleted, false),
          gte(installations.plannedDate, startOfWeek)
        ));

      const [completed] = await ctx.db
        .select({ count: count() })
        .from(installations)
        .where(and(
          eq(installations.isDeleted, false),
          eq(installations.status, 'completed')
        ));

      return {
        planned: Number(planned.count),
        thisWeek: Number(thisWeek.count),
        completed: Number(completed.count),
      };
    }),
});

export type InstallationsRouter = typeof installationsRouter;
