import { z } from 'zod';
import { eq, and, ilike, desc, count, gte } from 'drizzle-orm';
import { router, protectedProcedure } from '../../trpc/trpc';
import { transportDamages } from '@myhrvold/db/schema';

function generateDamageNumber(): string {
  const year = new Date().getFullYear();
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `TS${year}-${random}`;
}

export const damagesRouter = router({
  // List transport damages
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

      const conditions = [eq(transportDamages.isDeleted, false)];

      if (search) {
        conditions.push(ilike(transportDamages.productName, `%${search}%`));
      }

      if (status) {
        conditions.push(eq(transportDamages.status, status));
      }

      const result = await ctx.db.query.transportDamages.findMany({
        where: and(...conditions),
        orderBy: [desc(transportDamages.reportedAt)],
        limit,
        offset,
        with: {
          supplier: true,
        },
      });

      return result;
    }),

  // Get by ID
  byId: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const damage = await ctx.db.query.transportDamages.findFirst({
        where: and(
          eq(transportDamages.id, input.id),
          eq(transportDamages.isDeleted, false)
        ),
        with: {
          supplier: true,
          product: true,
          createdBy: true,
        },
      });

      return damage;
    }),

  // Create transport damage report
  create: protectedProcedure
    .input(z.object({
      productName: z.string().min(1),
      productId: z.string().uuid().optional(),
      supplierId: z.string().uuid().optional(),
      serialNumber: z.string().optional(),
      quantity: z.number().int().positive().default(1),
      orderNumber: z.string().optional(),
      deliveryDate: z.date().optional(),
      carrier: z.string().optional(),
      trackingNumber: z.string().optional(),
      damageDescription: z.string(),
      damageType: z.string().optional(),
      severity: z.enum(['minor', 'moderate', 'major', 'total_loss']),
      claimAmount: z.number().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const damageNumber = generateDamageNumber();

      const [damage] = await ctx.db.insert(transportDamages).values({
        damageNumber,
        ...input,
        claimAmount: input.claimAmount?.toString(),
        status: 'reported',
        createdById: ctx.user?.id,
      }).returning();

      return damage;
    }),

  // Update damage
  update: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      status: z.string().optional(),
      resolution: z.string().optional(),
      resolutionType: z.string().optional(),
      settledAmount: z.number().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, settledAmount, ...data } = input;

      const updateData: any = {
        ...data,
        settledAmount: settledAmount?.toString(),
        updatedAt: new Date(),
      };

      if (data.status === 'resolved') {
        updateData.resolvedAt = new Date();
      }

      const [damage] = await ctx.db.update(transportDamages)
        .set(updateData)
        .where(eq(transportDamages.id, id))
        .returning();

      return damage;
    }),

  // Stats
  stats: protectedProcedure
    .query(async ({ ctx }) => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const [open] = await ctx.db
        .select({ count: count() })
        .from(transportDamages)
        .where(and(
          eq(transportDamages.isDeleted, false),
          eq(transportDamages.status, 'reported')
        ));

      const [thisMonth] = await ctx.db
        .select({ count: count() })
        .from(transportDamages)
        .where(and(
          eq(transportDamages.isDeleted, false),
          gte(transportDamages.reportedAt, startOfMonth)
        ));

      const [resolved] = await ctx.db
        .select({ count: count() })
        .from(transportDamages)
        .where(and(
          eq(transportDamages.isDeleted, false),
          eq(transportDamages.status, 'resolved')
        ));

      return {
        open: Number(open.count),
        thisMonth: Number(thisMonth.count),
        resolved: Number(resolved.count),
      };
    }),

  // Damage types
  damageTypes: protectedProcedure
    .query(async () => {
      return [
        { id: 'dent', name: 'Bulk/inntrykk' },
        { id: 'scratch', name: 'Riper' },
        { id: 'broken', name: 'Knust/ødelagt' },
        { id: 'wet', name: 'Vannskade' },
        { id: 'missing_parts', name: 'Manglende deler' },
        { id: 'packaging', name: 'Emballasjeskade' },
        { id: 'other', name: 'Annet' },
      ];
    }),

  // Resolution types
  resolutionTypes: protectedProcedure
    .query(async () => {
      return [
        { id: 'replaced', name: 'Erstattet' },
        { id: 'repaired', name: 'Reparert' },
        { id: 'credited', name: 'Kreditert' },
        { id: 'partial_credit', name: 'Delvis kreditert' },
        { id: 'rejected', name: 'Avslått' },
        { id: 'other', name: 'Annet' },
      ];
    }),
});

export type DamagesRouter = typeof damagesRouter;
