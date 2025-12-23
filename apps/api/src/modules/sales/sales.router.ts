import { z } from 'zod';
import { eq, and, ilike, desc, count, gte, sql } from 'drizzle-orm';
import { router, protectedProcedure } from '../../trpc/trpc';
import { leads, opportunities, salesActivities, quotations } from '@myhrvold/db/schema';

// Generate numbers
function generateLeadNumber(): string {
  const year = new Date().getFullYear();
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `LD${year}-${random}`;
}

function generateOpportunityNumber(): string {
  const year = new Date().getFullYear();
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `OP${year}-${random}`;
}

function generateQuotationNumber(): string {
  const year = new Date().getFullYear();
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `QT${year}-${random}`;
}

export const salesRouter = router({
  // === Leads ===

  leadsList: protectedProcedure
    .input(z.object({
      page: z.number().int().positive().default(1),
      limit: z.number().int().positive().max(100).default(20),
      search: z.string().optional(),
      status: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const { page, limit, search, status } = input;
      const offset = (page - 1) * limit;

      const conditions = [eq(leads.isDeleted, false)];

      if (search) {
        conditions.push(ilike(leads.companyName, `%${search}%`));
      }

      if (status) {
        conditions.push(eq(leads.status, status));
      }

      const result = await ctx.db.query.leads.findMany({
        where: and(...conditions),
        orderBy: [desc(leads.createdAt)],
        limit,
        offset,
        with: {
          assignedTo: true,
        },
      });

      return result;
    }),

  leadById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const lead = await ctx.db.query.leads.findFirst({
        where: and(
          eq(leads.id, input.id),
          eq(leads.isDeleted, false)
        ),
        with: {
          assignedTo: true,
          createdBy: true,
          opportunities: true,
          activities: {
            limit: 10,
            orderBy: (activities, { desc }) => [desc(activities.scheduledAt)],
          },
        },
      });

      return lead;
    }),

  createLead: protectedProcedure
    .input(z.object({
      companyName: z.string().min(1),
      orgNumber: z.string().optional(),
      industry: z.string().optional(),
      contactName: z.string().optional(),
      contactTitle: z.string().optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      address: z.string().optional(),
      postalCode: z.string().optional(),
      city: z.string().optional(),
      source: z.string().optional(),
      sourceDetail: z.string().optional(),
      interests: z.array(z.string()).optional(),
      estimatedValue: z.number().optional(),
      priority: z.string().optional(),
      temperature: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const leadNumber = generateLeadNumber();

      const [lead] = await ctx.db.insert(leads).values({
        leadNumber,
        ...input,
        estimatedValue: input.estimatedValue?.toString(),
        status: 'new',
        assignedToId: ctx.user?.id,
        createdById: ctx.user?.id,
      }).returning();

      return lead;
    }),

  updateLead: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      status: z.string().optional(),
      priority: z.string().optional(),
      temperature: z.string().optional(),
      assignedToId: z.string().uuid().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      const [lead] = await ctx.db.update(leads)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(leads.id, id))
        .returning();

      return lead;
    }),

  // === Opportunities ===

  opportunitiesList: protectedProcedure
    .input(z.object({
      page: z.number().int().positive().default(1),
      limit: z.number().int().positive().max(100).default(20),
      status: z.string().optional(),
      stage: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const { page, limit, status, stage } = input;
      const offset = (page - 1) * limit;

      const conditions = [eq(opportunities.isDeleted, false)];

      if (status) {
        conditions.push(eq(opportunities.status, status));
      }

      if (stage) {
        conditions.push(eq(opportunities.stage, stage));
      }

      const result = await ctx.db.query.opportunities.findMany({
        where: and(...conditions),
        orderBy: [desc(opportunities.createdAt)],
        limit,
        offset,
        with: {
          customer: true,
          assignedTo: true,
        },
      });

      return result;
    }),

  opportunityById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const opportunity = await ctx.db.query.opportunities.findFirst({
        where: and(
          eq(opportunities.id, input.id),
          eq(opportunities.isDeleted, false)
        ),
        with: {
          customer: true,
          lead: true,
          assignedTo: true,
          createdBy: true,
          activities: {
            limit: 10,
            orderBy: (activities, { desc }) => [desc(activities.scheduledAt)],
          },
          quotations: true,
        },
      });

      return opportunity;
    }),

  createOpportunity: protectedProcedure
    .input(z.object({
      customerId: z.string().uuid().optional(),
      leadId: z.string().uuid().optional(),
      name: z.string().min(1),
      description: z.string().optional(),
      value: z.number().optional(),
      probability: z.number().min(0).max(100).optional(),
      expectedCloseDate: z.date().optional(),
      stage: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const opportunityNumber = generateOpportunityNumber();

      const weightedValue = input.value && input.probability
        ? input.value * (input.probability / 100)
        : null;

      const [opportunity] = await ctx.db.insert(opportunities).values({
        opportunityNumber,
        ...input,
        value: input.value?.toString(),
        probability: input.probability?.toString(),
        weightedValue: weightedValue?.toString(),
        status: 'open',
        stage: input.stage || 'qualification',
        assignedToId: ctx.user?.id,
        createdById: ctx.user?.id,
      }).returning();

      return opportunity;
    }),

  updateOpportunity: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      stage: z.string().optional(),
      status: z.string().optional(),
      value: z.number().optional(),
      probability: z.number().optional(),
      expectedCloseDate: z.date().optional(),
      lostReason: z.string().optional(),
      wonReason: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, value, probability, ...data } = input;

      const updateData: any = { ...data, updatedAt: new Date() };

      if (value !== undefined) updateData.value = value.toString();
      if (probability !== undefined) updateData.probability = probability.toString();

      if (value && probability) {
        updateData.weightedValue = (value * (probability / 100)).toString();
      }

      const [opportunity] = await ctx.db.update(opportunities)
        .set(updateData)
        .where(eq(opportunities.id, id))
        .returning();

      return opportunity;
    }),

  // === Quotations ===

  quotationsList: protectedProcedure
    .input(z.object({
      page: z.number().int().positive().default(1),
      limit: z.number().int().positive().max(100).default(20),
      status: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const { page, limit, status } = input;
      const offset = (page - 1) * limit;

      const conditions = [eq(quotations.isDeleted, false)];

      if (status) {
        conditions.push(eq(quotations.status, status));
      }

      const result = await ctx.db.query.quotations.findMany({
        where: and(...conditions),
        orderBy: [desc(quotations.createdAt)],
        limit,
        offset,
        with: {
          customer: true,
          opportunity: true,
        },
      });

      return result;
    }),

  createQuotation: protectedProcedure
    .input(z.object({
      customerId: z.string().uuid().optional(),
      opportunityId: z.string().uuid().optional(),
      title: z.string(),
      description: z.string().optional(),
      lines: z.array(z.object({
        id: z.string(),
        productId: z.string().uuid().optional(),
        description: z.string(),
        quantity: z.number(),
        unitPrice: z.number(),
        discount: z.number().optional(),
        total: z.number(),
      })).optional(),
      validFrom: z.date().optional(),
      validUntil: z.date().optional(),
      paymentTerms: z.string().optional(),
      deliveryTerms: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const quotationNumber = generateQuotationNumber();

      const subtotal = input.lines?.reduce((sum, line) => sum + line.total, 0) || 0;
      const tax = subtotal * 0.25; // 25% MVA
      const total = subtotal + tax;

      const [quotation] = await ctx.db.insert(quotations).values({
        quotationNumber,
        ...input,
        subtotal: subtotal.toString(),
        tax: tax.toString(),
        total: total.toString(),
        status: 'draft',
        assignedToId: ctx.user?.id,
        createdById: ctx.user?.id,
      }).returning();

      return quotation;
    }),

  // === Stats ===

  stats: protectedProcedure
    .query(async ({ ctx }) => {
      const [openLeads] = await ctx.db
        .select({ count: count() })
        .from(leads)
        .where(and(
          eq(leads.isDeleted, false),
          eq(leads.status, 'new')
        ));

      const [openOpportunities] = await ctx.db
        .select({ count: count() })
        .from(opportunities)
        .where(and(
          eq(opportunities.isDeleted, false),
          eq(opportunities.status, 'open')
        ));

      const [pendingQuotations] = await ctx.db
        .select({ count: count() })
        .from(quotations)
        .where(and(
          eq(quotations.isDeleted, false),
          eq(quotations.status, 'sent')
        ));

      // Pipeline value
      const pipeline = await ctx.db
        .select({ total: sql<string>`SUM(CAST(${opportunities.value} AS DECIMAL))` })
        .from(opportunities)
        .where(and(
          eq(opportunities.isDeleted, false),
          eq(opportunities.status, 'open')
        ));

      return {
        openLeads: Number(openLeads.count),
        openOpportunities: Number(openOpportunities.count),
        pendingQuotations: Number(pendingQuotations.count),
        pipelineValue: pipeline[0]?.total ? parseFloat(pipeline[0].total) : 0,
      };
    }),

  // Stages
  stages: protectedProcedure
    .query(async () => {
      return [
        { id: 'qualification', name: 'Kvalifisering', probability: 10 },
        { id: 'needs_analysis', name: 'Behovsanalyse', probability: 25 },
        { id: 'proposal', name: 'Tilbud', probability: 50 },
        { id: 'negotiation', name: 'Forhandling', probability: 75 },
        { id: 'closed_won', name: 'Vunnet', probability: 100 },
        { id: 'closed_lost', name: 'Tapt', probability: 0 },
      ];
    }),

  // Lead sources
  leadSources: protectedProcedure
    .query(async () => {
      return [
        { id: 'website', name: 'Nettside' },
        { id: 'referral', name: 'Anbefaling' },
        { id: 'cold_call', name: 'Kaldring' },
        { id: 'trade_show', name: 'Messe' },
        { id: 'email_campaign', name: 'E-postkampanje' },
        { id: 'social_media', name: 'Sosiale medier' },
        { id: 'partner', name: 'Partner' },
        { id: 'other', name: 'Annet' },
      ];
    }),
});

export type SalesRouter = typeof salesRouter;
