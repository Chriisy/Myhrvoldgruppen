import { z } from 'zod';
import { eq, and, desc, count, gte } from 'drizzle-orm';
import { router, protectedProcedure } from '../../trpc/trpc';
import { safeJobAnalysis, hmsIncidents, hmsChecklists } from '@myhrvold/db/schema';

// Generate numbers
function generateSJANumber(): string {
  const year = new Date().getFullYear();
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `SJA${year}-${random}`;
}

function generateIncidentNumber(): string {
  const year = new Date().getFullYear();
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `HMS${year}-${random}`;
}

function generateChecklistNumber(): string {
  const year = new Date().getFullYear();
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `CL${year}-${random}`;
}

export const hmsRouter = router({
  // === SJA (Safe Job Analysis) ===

  sjaList: protectedProcedure
    .input(z.object({
      page: z.number().int().positive().default(1),
      limit: z.number().int().positive().max(100).default(20),
      status: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const { page, limit, status } = input;
      const offset = (page - 1) * limit;

      const conditions = [eq(safeJobAnalysis.isDeleted, false)];

      if (status) {
        conditions.push(eq(safeJobAnalysis.status, status));
      }

      const result = await ctx.db.query.safeJobAnalysis.findMany({
        where: and(...conditions),
        orderBy: [desc(safeJobAnalysis.plannedDate)],
        limit,
        offset,
        with: {
          customer: true,
          visit: true,
          createdBy: true,
        },
      });

      return result;
    }),

  sjaById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const sja = await ctx.db.query.safeJobAnalysis.findFirst({
        where: and(
          eq(safeJobAnalysis.id, input.id),
          eq(safeJobAnalysis.isDeleted, false)
        ),
        with: {
          customer: true,
          visit: true,
          createdBy: true,
          approvedBy: true,
        },
      });

      return sja;
    }),

  createSJA: protectedProcedure
    .input(z.object({
      visitId: z.string().uuid().optional(),
      customerId: z.string().uuid().optional(),
      jobTitle: z.string().min(1),
      jobDescription: z.string().optional(),
      location: z.string().optional(),
      plannedDate: z.date().optional(),
      hazards: z.array(z.object({
        id: z.string(),
        description: z.string(),
        riskLevel: z.enum(['low', 'medium', 'high']),
        controls: z.array(z.string()),
      })).optional(),
      requiredPPE: z.array(z.string()).optional(),
      safetyMeasures: z.string().optional(),
      emergencyProcedures: z.string().optional(),
      workPermitRequired: z.boolean().optional(),
      hotWorkPermit: z.boolean().optional(),
      confinedSpacePermit: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const sjaNumber = generateSJANumber();

      const [sja] = await ctx.db.insert(safeJobAnalysis).values({
        sjaNumber,
        ...input,
        status: 'draft',
        createdById: ctx.user?.id,
      }).returning();

      return sja;
    }),

  approveSJA: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [sja] = await ctx.db.update(safeJobAnalysis)
        .set({
          status: 'approved',
          approvedById: ctx.user?.id,
          approvedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(safeJobAnalysis.id, input.id))
        .returning();

      return sja;
    }),

  completeSJA: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      completionNotes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [sja] = await ctx.db.update(safeJobAnalysis)
        .set({
          status: 'completed',
          completedAt: new Date(),
          completionNotes: input.completionNotes,
          updatedAt: new Date(),
        })
        .where(eq(safeJobAnalysis.id, input.id))
        .returning();

      return sja;
    }),

  // === HMS Incidents ===

  incidentsList: protectedProcedure
    .input(z.object({
      page: z.number().int().positive().default(1),
      limit: z.number().int().positive().max(100).default(20),
      status: z.string().optional(),
      incidentType: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const { page, limit, status, incidentType } = input;
      const offset = (page - 1) * limit;

      const conditions = [eq(hmsIncidents.isDeleted, false)];

      if (status) {
        conditions.push(eq(hmsIncidents.status, status));
      }

      if (incidentType) {
        conditions.push(eq(hmsIncidents.incidentType, incidentType));
      }

      const result = await ctx.db.query.hmsIncidents.findMany({
        where: and(...conditions),
        orderBy: [desc(hmsIncidents.incidentDate)],
        limit,
        offset,
        with: {
          customer: true,
          createdBy: true,
        },
      });

      return result;
    }),

  incidentById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const incident = await ctx.db.query.hmsIncidents.findFirst({
        where: and(
          eq(hmsIncidents.id, input.id),
          eq(hmsIncidents.isDeleted, false)
        ),
        with: {
          customer: true,
          visit: true,
          createdBy: true,
          closedBy: true,
        },
      });

      return incident;
    }),

  createIncident: protectedProcedure
    .input(z.object({
      incidentType: z.string(),
      severity: z.enum(['minor', 'moderate', 'serious', 'critical']),
      category: z.string().optional(),
      title: z.string().min(1),
      description: z.string(),
      location: z.string().optional(),
      incidentDate: z.date(),
      personInvolved: z.string().optional(),
      witnesses: z.string().optional(),
      injuryOccurred: z.boolean().optional(),
      injuryDescription: z.string().optional(),
      medicalTreatment: z.boolean().optional(),
      sickLeave: z.boolean().optional(),
      sickLeaveDays: z.number().int().optional(),
      customerId: z.string().uuid().optional(),
      visitId: z.string().uuid().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const incidentNumber = generateIncidentNumber();

      const [incident] = await ctx.db.insert(hmsIncidents).values({
        incidentNumber,
        ...input,
        status: 'reported',
        createdById: ctx.user?.id,
      }).returning();

      return incident;
    }),

  updateIncident: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      rootCause: z.string().optional(),
      correctiveActions: z.array(z.object({
        id: z.string(),
        action: z.string(),
        responsible: z.string(),
        deadline: z.string(),
        completed: z.boolean(),
        completedAt: z.string().optional(),
      })).optional(),
      status: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      const updateData: any = { ...data, updatedAt: new Date() };

      if (data.status === 'closed') {
        updateData.closedAt = new Date();
        updateData.closedById = ctx.user?.id;
      }

      const [incident] = await ctx.db.update(hmsIncidents)
        .set(updateData)
        .where(eq(hmsIncidents.id, id))
        .returning();

      return incident;
    }),

  // === Checklists ===

  checklistsList: protectedProcedure
    .input(z.object({
      page: z.number().int().positive().default(1),
      limit: z.number().int().positive().max(100).default(20),
      checklistType: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const { page, limit, checklistType } = input;
      const offset = (page - 1) * limit;

      const conditions = [eq(hmsChecklists.isDeleted, false)];

      if (checklistType) {
        conditions.push(eq(hmsChecklists.checklistType, checklistType));
      }

      const result = await ctx.db.query.hmsChecklists.findMany({
        where: and(...conditions),
        orderBy: [desc(hmsChecklists.createdAt)],
        limit,
        offset,
        with: {
          customer: true,
          visit: true,
        },
      });

      return result;
    }),

  createChecklist: protectedProcedure
    .input(z.object({
      checklistType: z.string(),
      name: z.string(),
      visitId: z.string().uuid().optional(),
      customerId: z.string().uuid().optional(),
      items: z.array(z.object({
        id: z.string(),
        question: z.string(),
        category: z.string().optional(),
        status: z.enum(['ok', 'not_ok', 'na', 'pending']),
        comment: z.string().optional(),
      })).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const checklistNumber = generateChecklistNumber();

      const [checklist] = await ctx.db.insert(hmsChecklists).values({
        checklistNumber,
        ...input,
        status: 'in_progress',
        createdById: ctx.user?.id,
      }).returning();

      return checklist;
    }),

  updateChecklist: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      items: z.array(z.object({
        id: z.string(),
        question: z.string(),
        category: z.string().optional(),
        status: z.enum(['ok', 'not_ok', 'na', 'pending']),
        comment: z.string().optional(),
        photo: z.string().optional(),
      })),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      // Check if all items are answered
      const allAnswered = data.items.every(item => item.status !== 'pending');

      const [checklist] = await ctx.db.update(hmsChecklists)
        .set({
          ...data,
          status: allAnswered ? 'completed' : 'in_progress',
          completedAt: allAnswered ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(eq(hmsChecklists.id, id))
        .returning();

      return checklist;
    }),

  // === Stats ===

  stats: protectedProcedure
    .query(async ({ ctx }) => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const [openIncidents] = await ctx.db
        .select({ count: count() })
        .from(hmsIncidents)
        .where(and(
          eq(hmsIncidents.isDeleted, false),
          eq(hmsIncidents.status, 'reported')
        ));

      const [thisMonthIncidents] = await ctx.db
        .select({ count: count() })
        .from(hmsIncidents)
        .where(and(
          eq(hmsIncidents.isDeleted, false),
          gte(hmsIncidents.incidentDate, startOfMonth)
        ));

      const [pendingSJA] = await ctx.db
        .select({ count: count() })
        .from(safeJobAnalysis)
        .where(and(
          eq(safeJobAnalysis.isDeleted, false),
          eq(safeJobAnalysis.status, 'draft')
        ));

      return {
        openIncidents: Number(openIncidents.count),
        thisMonthIncidents: Number(thisMonthIncidents.count),
        pendingSJA: Number(pendingSJA.count),
      };
    }),

  // Incident types
  incidentTypes: protectedProcedure
    .query(async () => {
      return [
        { id: 'near_miss', name: 'Nestenulykke' },
        { id: 'injury', name: 'Personskade' },
        { id: 'property_damage', name: 'Materiell skade' },
        { id: 'environmental', name: 'Miljøhendelse' },
        { id: 'fire', name: 'Brann/brannfare' },
        { id: 'chemical', name: 'Kjemikaliehendelse' },
        { id: 'other', name: 'Annet' },
      ];
    }),

  // PPE options
  ppeOptions: protectedProcedure
    .query(async () => {
      return [
        { id: 'helmet', name: 'Hjelm' },
        { id: 'safety_glasses', name: 'Vernebriller' },
        { id: 'hearing_protection', name: 'Hørselsvern' },
        { id: 'safety_shoes', name: 'Vernesko' },
        { id: 'gloves', name: 'Hansker' },
        { id: 'high_vis', name: 'Synlighetsklær' },
        { id: 'face_shield', name: 'Visir' },
        { id: 'respirator', name: 'Åndedrettsvern' },
        { id: 'harness', name: 'Fallsikring' },
      ];
    }),
});

export type HMSRouter = typeof hmsRouter;
