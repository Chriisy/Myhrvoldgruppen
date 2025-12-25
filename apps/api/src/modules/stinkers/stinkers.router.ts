import { z } from 'zod';
import { eq, and, ilike, desc, count, gte } from 'drizzle-orm';
import { router, protectedProcedure } from '../../trpc/trpc';
import { stinkers } from '@myhrvold/db/schema';

function generateStinkerNumber(): string {
  const year = new Date().getFullYear();
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `ST${year}-${random}`;
}

export const stinkersRouter = router({
  // List stinkers
  list: protectedProcedure
    .input(z.object({
      page: z.number().int().positive().default(1),
      limit: z.number().int().positive().max(100).default(20),
      search: z.string().optional(),
      status: z.string().optional(),
      severity: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const { page, limit, search, status, severity } = input;
      const offset = (page - 1) * limit;

      const conditions = [eq(stinkers.isDeleted, false)];

      if (search) {
        conditions.push(ilike(stinkers.productName, `%${search}%`));
      }

      if (status) {
        conditions.push(eq(stinkers.status, status));
      }

      if (severity) {
        conditions.push(eq(stinkers.severity, severity));
      }

      const result = await ctx.db.query.stinkers.findMany({
        where: and(...conditions),
        orderBy: [desc(stinkers.createdAt)],
        limit,
        offset,
        with: {
          supplier: true,
          customer: true,
        },
      });

      return result;
    }),

  // Get by ID
  byId: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const stinker = await ctx.db.query.stinkers.findFirst({
        where: and(
          eq(stinkers.id, input.id),
          eq(stinkers.isDeleted, false)
        ),
        with: {
          supplier: true,
          product: true,
          customer: true,
          resolvedBy: true,
          createdBy: true,
        },
      });

      return stinker;
    }),

  // Create stinker
  create: protectedProcedure
    .input(z.object({
      productName: z.string().min(1),
      brand: z.string().optional(),
      model: z.string().optional(),
      serialNumber: z.string().optional(),
      productId: z.string().uuid().optional(),
      supplierId: z.string().uuid().optional(),
      customerId: z.string().uuid().optional(),
      issueType: z.string(),
      severity: z.enum(['low', 'medium', 'high', 'critical']),
      frequency: z.string().optional(),
      issueDescription: z.string(),
      symptoms: z.string().optional(),
      possibleCauses: z.string().optional(),
      relatedClaimNumbers: z.array(z.string()).optional(),
      estimatedCost: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const stinkerNumber = generateStinkerNumber();

      const [stinker] = await ctx.db.insert(stinkers).values({
        stinkerNumber,
        ...input,
        estimatedCost: input.estimatedCost?.toString(),
        firstReportedAt: new Date(),
        totalIncidents: 1,
        status: 'open',
        createdById: ctx.user?.id,
      }).returning();

      return stinker;
    }),

  // Update stinker
  update: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      status: z.string().optional(),
      severity: z.string().optional(),
      resolution: z.string().optional(),
      recommendation: z.string().optional(),
      preventiveMeasures: z.string().optional(),
      followUpRequired: z.boolean().optional(),
      followUpDate: z.date().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      const updateData: any = { ...data, updatedAt: new Date() };

      if (data.status === 'resolved') {
        updateData.resolvedAt = new Date();
        updateData.resolvedById = ctx.user?.id;
      }

      const [stinker] = await ctx.db.update(stinkers)
        .set(updateData)
        .where(eq(stinkers.id, id))
        .returning();

      return stinker;
    }),

  // Increment incident count
  addIncident: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      claimNumber: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.stinkers.findFirst({
        where: eq(stinkers.id, input.id),
      });

      if (!existing) {
        throw new Error('Stinker ikke funnet');
      }

      const relatedClaims = (existing.relatedClaimNumbers as string[]) || [];
      if (input.claimNumber && !relatedClaims.includes(input.claimNumber)) {
        relatedClaims.push(input.claimNumber);
      }

      const [stinker] = await ctx.db.update(stinkers)
        .set({
          totalIncidents: (existing.totalIncidents || 1) + 1,
          relatedClaimNumbers: relatedClaims,
          updatedAt: new Date(),
        })
        .where(eq(stinkers.id, input.id))
        .returning();

      return stinker;
    }),

  // Stats
  stats: protectedProcedure
    .query(async ({ ctx }) => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const [open] = await ctx.db
        .select({ count: count() })
        .from(stinkers)
        .where(and(
          eq(stinkers.isDeleted, false),
          eq(stinkers.status, 'open')
        ));

      const [critical] = await ctx.db
        .select({ count: count() })
        .from(stinkers)
        .where(and(
          eq(stinkers.isDeleted, false),
          eq(stinkers.status, 'open'),
          eq(stinkers.severity, 'critical')
        ));

      const [thisMonth] = await ctx.db
        .select({ count: count() })
        .from(stinkers)
        .where(and(
          eq(stinkers.isDeleted, false),
          gte(stinkers.createdAt, startOfMonth)
        ));

      return {
        open: Number(open.count),
        critical: Number(critical.count),
        thisMonth: Number(thisMonth.count),
      };
    }),

  // Issue types
  issueTypes: protectedProcedure
    .query(async () => {
      return [
        { id: 'manufacturing_defect', name: 'Produksjonsfeil' },
        { id: 'design_flaw', name: 'Designfeil' },
        { id: 'component_failure', name: 'Komponentsvikt' },
        { id: 'software_bug', name: 'Programvarefeil' },
        { id: 'compatibility', name: 'Kompatibilitetsproblem' },
        { id: 'wear_and_tear', name: 'Slitasje' },
        { id: 'installation', name: 'Installasjonsproblem' },
        { id: 'other', name: 'Annet' },
      ];
    }),
});

export type StinkersRouter = typeof stinkersRouter;
