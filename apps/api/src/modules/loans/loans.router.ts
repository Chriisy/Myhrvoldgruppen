import { z } from 'zod';
import { eq, and, ilike, desc, count, isNull, gte, lte } from 'drizzle-orm';
import { router, protectedProcedure } from '../../trpc/trpc';
import { loanEquipment, loanRecords } from '@myhrvold/db/schema';

// Generate loan number
function generateLoanNumber(): string {
  const year = new Date().getFullYear();
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `LN${year}-${random}`;
}

export const loansRouter = router({
  // === Equipment Management ===

  // List all equipment
  equipmentList: protectedProcedure
    .input(z.object({
      page: z.number().int().positive().default(1),
      limit: z.number().int().positive().max(100).default(20),
      search: z.string().optional(),
      status: z.enum(['available', 'on_loan', 'maintenance', 'retired']).optional(),
      category: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const { page, limit, search, status, category } = input;
      const offset = (page - 1) * limit;

      const conditions = [eq(loanEquipment.isDeleted, false)];

      if (search) {
        conditions.push(ilike(loanEquipment.name, `%${search}%`));
      }

      if (status) {
        conditions.push(eq(loanEquipment.status, status));
      }

      if (category) {
        conditions.push(eq(loanEquipment.category, category));
      }

      const result = await ctx.db.query.loanEquipment.findMany({
        where: and(...conditions),
        orderBy: [desc(loanEquipment.createdAt)],
        limit,
        offset,
      });

      return result;
    }),

  // Get available equipment
  availableEquipment: protectedProcedure
    .query(async ({ ctx }) => {
      const result = await ctx.db.query.loanEquipment.findMany({
        where: and(
          eq(loanEquipment.isDeleted, false),
          eq(loanEquipment.status, 'available')
        ),
        orderBy: [desc(loanEquipment.name)],
      });

      return result;
    }),

  // Get equipment by ID
  equipmentById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const equipment = await ctx.db.query.loanEquipment.findFirst({
        where: and(
          eq(loanEquipment.id, input.id),
          eq(loanEquipment.isDeleted, false)
        ),
        with: {
          loans: {
            limit: 10,
            orderBy: (loans, { desc }) => [desc(loans.loanDate)],
            with: {
              customer: true,
            },
          },
        },
      });

      return equipment;
    }),

  // Create equipment
  createEquipment: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(200),
      description: z.string().optional(),
      category: z.string().optional(),
      brand: z.string().optional(),
      model: z.string().optional(),
      serialNumber: z.string().optional(),
      location: z.string().optional(),
      purchasePrice: z.number().nonnegative().optional(),
      dailyRate: z.number().nonnegative().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const equipmentNumber = `EQ${Date.now().toString(36).toUpperCase()}`;

      const [equipment] = await ctx.db.insert(loanEquipment).values({
        ...input,
        equipmentNumber,
        purchasePrice: input.purchasePrice?.toString(),
        dailyRate: input.dailyRate?.toString(),
        status: 'available',
        condition: 'good',
      }).returning();

      return equipment;
    }),

  // === Loan Management ===

  // List active loans
  loansList: protectedProcedure
    .input(z.object({
      page: z.number().int().positive().default(1),
      limit: z.number().int().positive().max(100).default(20),
      status: z.enum(['active', 'returned', 'overdue']).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const { page, limit, status } = input;
      const offset = (page - 1) * limit;

      const conditions = [eq(loanRecords.isDeleted, false)];

      if (status === 'active') {
        conditions.push(eq(loanRecords.status, 'active'));
        conditions.push(isNull(loanRecords.actualReturnDate));
      } else if (status === 'returned') {
        conditions.push(eq(loanRecords.status, 'returned'));
      }

      const result = await ctx.db.query.loanRecords.findMany({
        where: and(...conditions),
        orderBy: [desc(loanRecords.loanDate)],
        limit,
        offset,
        with: {
          equipment: true,
          customer: true,
        },
      });

      return result;
    }),

  // Get loan by ID
  loanById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const loan = await ctx.db.query.loanRecords.findFirst({
        where: and(
          eq(loanRecords.id, input.id),
          eq(loanRecords.isDeleted, false)
        ),
        with: {
          equipment: true,
          customer: true,
          loanedBy: true,
          returnedTo: true,
        },
      });

      return loan;
    }),

  // Create new loan
  createLoan: protectedProcedure
    .input(z.object({
      equipmentId: z.string().uuid(),
      customerId: z.string().uuid(),
      expectedReturnDate: z.date().optional(),
      conditionAtLoan: z.string().optional(),
      depositAmount: z.number().nonnegative().optional(),
      claimNumber: z.string().optional(),
      visitNumber: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Check if equipment is available
      const equipment = await ctx.db.query.loanEquipment.findFirst({
        where: and(
          eq(loanEquipment.id, input.equipmentId),
          eq(loanEquipment.status, 'available')
        ),
      });

      if (!equipment) {
        throw new Error('Utstyret er ikke tilgjengelig for utlån');
      }

      const loanNumber = generateLoanNumber();

      // Create loan record
      const [loan] = await ctx.db.insert(loanRecords).values({
        loanNumber,
        equipmentId: input.equipmentId,
        customerId: input.customerId,
        loanDate: new Date(),
        expectedReturnDate: input.expectedReturnDate,
        conditionAtLoan: input.conditionAtLoan || equipment.condition,
        depositAmount: input.depositAmount?.toString(),
        claimNumber: input.claimNumber,
        visitNumber: input.visitNumber,
        notes: input.notes,
        loanedById: ctx.user?.id,
        status: 'active',
      }).returning();

      // Update equipment status
      await ctx.db.update(loanEquipment)
        .set({ status: 'on_loan', updatedAt: new Date() })
        .where(eq(loanEquipment.id, input.equipmentId));

      return loan;
    }),

  // Return equipment
  returnLoan: protectedProcedure
    .input(z.object({
      loanId: z.string().uuid(),
      conditionAtReturn: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Get loan record
      const loan = await ctx.db.query.loanRecords.findFirst({
        where: eq(loanRecords.id, input.loanId),
      });

      if (!loan) {
        throw new Error('Utlån ikke funnet');
      }

      // Calculate cost if daily rate exists
      const equipment = await ctx.db.query.loanEquipment.findFirst({
        where: eq(loanEquipment.id, loan.equipmentId),
      });

      let totalCost = null;
      if (equipment?.dailyRate) {
        const days = Math.ceil(
          (Date.now() - new Date(loan.loanDate).getTime()) / (1000 * 60 * 60 * 24)
        );
        totalCost = (parseFloat(equipment.dailyRate) * days).toString();
      }

      // Update loan record
      const [updatedLoan] = await ctx.db.update(loanRecords)
        .set({
          actualReturnDate: new Date(),
          conditionAtReturn: input.conditionAtReturn,
          notes: input.notes ? `${loan.notes || ''}\n${input.notes}` : loan.notes,
          returnedToId: ctx.user?.id,
          status: 'returned',
          totalCost,
          updatedAt: new Date(),
        })
        .where(eq(loanRecords.id, input.loanId))
        .returning();

      // Update equipment status
      await ctx.db.update(loanEquipment)
        .set({
          status: 'available',
          condition: input.conditionAtReturn || equipment?.condition,
          updatedAt: new Date(),
        })
        .where(eq(loanEquipment.id, loan.equipmentId));

      return updatedLoan;
    }),

  // Stats
  stats: protectedProcedure
    .query(async ({ ctx }) => {
      const [totalEquipment] = await ctx.db
        .select({ count: count() })
        .from(loanEquipment)
        .where(eq(loanEquipment.isDeleted, false));

      const [available] = await ctx.db
        .select({ count: count() })
        .from(loanEquipment)
        .where(and(
          eq(loanEquipment.isDeleted, false),
          eq(loanEquipment.status, 'available')
        ));

      const [onLoan] = await ctx.db
        .select({ count: count() })
        .from(loanEquipment)
        .where(and(
          eq(loanEquipment.isDeleted, false),
          eq(loanEquipment.status, 'on_loan')
        ));

      const [activeLoans] = await ctx.db
        .select({ count: count() })
        .from(loanRecords)
        .where(and(
          eq(loanRecords.isDeleted, false),
          eq(loanRecords.status, 'active')
        ));

      return {
        totalEquipment: Number(totalEquipment.count),
        available: Number(available.count),
        onLoan: Number(onLoan.count),
        activeLoans: Number(activeLoans.count),
      };
    }),

  // Equipment categories
  categories: protectedProcedure
    .query(async () => {
      return [
        { id: 'kjoleskap', name: 'Kjøleskap' },
        { id: 'fryser', name: 'Fryser' },
        { id: 'oppvaskmaskin', name: 'Oppvaskmaskin' },
        { id: 'komfyr', name: 'Komfyr/Stekeovn' },
        { id: 'mikrobølge', name: 'Mikrobølgeovn' },
        { id: 'kaffemaskin', name: 'Kaffemaskin' },
        { id: 'varmebord', name: 'Varmebord' },
        { id: 'annet', name: 'Annet utstyr' },
      ];
    }),
});

export type LoansRouter = typeof loansRouter;
