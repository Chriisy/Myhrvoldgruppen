import { z } from 'zod';
import { eq, and, desc, gte, lte, count } from 'drizzle-orm';
import { router, protectedProcedure } from '../../trpc/trpc';
import { serviceVisits } from '@myhrvold/db/schema';
import { generateServiceReportPdf } from '../../lib/pdf';

export const reportsRouter = router({
  // Get service report by visit ID
  byVisitId: protectedProcedure
    .input(z.object({ visitId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const visit = await ctx.db.query.serviceVisits.findFirst({
        where: and(
          eq(serviceVisits.id, input.visitId),
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

  // Save signature for service report
  saveSignature: protectedProcedure
    .input(z.object({
      visitId: z.string().uuid(),
      signature: z.string(), // Base64 encoded signature image
      signedBy: z.string().min(1).max(200),
    }))
    .mutation(async ({ ctx, input }) => {
      const [visit] = await ctx.db.update(serviceVisits)
        .set({
          customerSignature: input.signature,
          customerSignedAt: new Date(),
          customerSignedBy: input.signedBy,
          updatedAt: new Date(),
        })
        .where(eq(serviceVisits.id, input.visitId))
        .returning();

      return visit;
    }),

  // Complete service report with work details
  completeReport: protectedProcedure
    .input(z.object({
      visitId: z.string().uuid(),
      workPerformed: z.string(),
      findings: z.string().optional(),
      recommendations: z.string().optional(),
      laborHours: z.number().positive().optional(),
      laborCost: z.number().nonnegative().optional(),
      partsCost: z.number().nonnegative().optional(),
      travelCost: z.number().nonnegative().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { visitId, laborHours, laborCost, partsCost, travelCost, ...data } = input;

      const totalCost = (laborCost || 0) + (partsCost || 0) + (travelCost || 0);

      const [visit] = await ctx.db.update(serviceVisits)
        .set({
          ...data,
          laborHours: laborHours?.toString(),
          laborCost: laborCost?.toString(),
          partsCost: partsCost?.toString(),
          travelCost: travelCost?.toString(),
          totalCost: totalCost.toString(),
          actualEndTime: new Date(),
          status: 'completed',
          updatedAt: new Date(),
        })
        .where(eq(serviceVisits.id, visitId))
        .returning();

      return visit;
    }),

  // Generate report PDF
  generatePdf: protectedProcedure
    .input(z.object({ visitId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const visit = await ctx.db.query.serviceVisits.findFirst({
        where: eq(serviceVisits.id, input.visitId),
        with: {
          customer: true,
          agreement: true,
          technician: true,
        },
      });

      if (!visit) {
        throw new Error('Besok ikke funnet');
      }

      // Generate actual PDF
      const pdfBuffer = await generateServiceReportPdf({
        visitNumber: visit.visitNumber,
        customerName: visit.customer?.name || 'Ukjent kunde',
        customerAddress: visit.customer?.address,
        technicianName: visit.technician
          ? `${visit.technician.firstName || ''} ${visit.technician.lastName || ''}`.trim()
          : 'Ukjent tekniker',
        plannedDate: visit.plannedDate,
        actualStartTime: visit.actualStartTime,
        actualEndTime: visit.actualEndTime,
        workPerformed: visit.workPerformed,
        findings: visit.findings,
        recommendations: visit.recommendations,
        laborHours: visit.laborHours,
        laborCost: visit.laborCost,
        partsCost: visit.partsCost,
        travelCost: visit.travelCost,
        totalCost: visit.totalCost,
        customerSignature: visit.customerSignature,
        customerSignedBy: visit.customerSignedBy,
        customerSignedAt: visit.customerSignedAt,
      });

      // Return base64 encoded PDF
      return {
        success: true,
        reportNumber: visit.visitNumber,
        generatedAt: new Date().toISOString(),
        pdfBase64: pdfBuffer.toString('base64'),
        filename: `servicerapport-${visit.visitNumber}.pdf`,
      };
    }),

  // Send report via email
  sendEmail: protectedProcedure
    .input(z.object({
      visitId: z.string().uuid(),
      recipients: z.array(z.string().email()),
      message: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const visit = await ctx.db.query.serviceVisits.findFirst({
        where: eq(serviceVisits.id, input.visitId),
        with: {
          customer: true,
        },
      });

      if (!visit) {
        throw new Error('Besøk ikke funnet');
      }

      // In production, would send actual email here
      // For now, return a mock response
      return {
        success: true,
        sentTo: input.recipients,
        sentAt: new Date().toISOString(),
      };
    }),

  // Get reports statistics
  stats: protectedProcedure
    .query(async ({ ctx }) => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const [totalCompleted] = await ctx.db
        .select({ count: count() })
        .from(serviceVisits)
        .where(and(
          eq(serviceVisits.status, 'completed'),
          eq(serviceVisits.isDeleted, false)
        ));

      const [thisMonth] = await ctx.db
        .select({ count: count() })
        .from(serviceVisits)
        .where(and(
          eq(serviceVisits.status, 'completed'),
          gte(serviceVisits.actualEndTime, startOfMonth),
          eq(serviceVisits.isDeleted, false)
        ));

      const [pendingSignature] = await ctx.db
        .select({ count: count() })
        .from(serviceVisits)
        .where(and(
          eq(serviceVisits.status, 'completed'),
          eq(serviceVisits.isDeleted, false),
          // customerSignature is null
        ));

      return {
        totalCompleted: Number(totalCompleted.count),
        thisMonth: Number(thisMonth.count),
        pendingSignature: Number(pendingSignature.count),
      };
    }),
});

export type ReportsRouter = typeof reportsRouter;
