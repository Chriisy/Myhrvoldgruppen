import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { router, publicProcedure } from '../../trpc/trpc';
import { claims, claimTimeline } from '@myhrvold/db/schema';
import { TRPCError } from '@trpc/server';

// Response types
const supplierResponseSchema = z.enum(['approved', 'rejected', 'needs_info']);

export const portalRouter = router({
  // Get claim by portal code (public - no auth required)
  getByCode: publicProcedure
    .input(z.object({ code: z.string().length(6) }))
    .query(async ({ ctx, input }) => {
      const claim = await ctx.db.query.claims.findFirst({
        where: and(
          eq(claims.supplierPortalCode, input.code.toUpperCase()),
          eq(claims.isDeleted, false)
        ),
        with: {
          supplier: true,
          attachments: true,
        },
      });

      if (!claim) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Ugyldig kode. Sjekk at du har tastet riktig.',
        });
      }

      // Don't expose internal fields
      return {
        id: claim.id,
        claimNumber: claim.claimNumber,
        status: claim.status,
        productNameText: claim.productNameText,
        serialNumber: claim.serialNumber,
        purchaseDate: claim.purchaseDate,
        problemDescription: claim.problemDescription,
        category: claim.category,
        priority: claim.priority,
        customerCompanyName: claim.customerCompanyName,
        customerCity: claim.customerCity,
        createdAt: claim.createdAt,
        supplierName: claim.supplier?.name,
        attachments: claim.attachments?.map(a => ({
          id: a.id,
          fileName: a.fileName,
          fileUrl: a.fileUrl,
          fileType: a.fileType,
        })),
        hasResponded: !!claim.supplierRespondedAt,
      };
    }),

  // Submit supplier response (public)
  respond: publicProcedure
    .input(z.object({
      code: z.string().length(6),
      response: supplierResponseSchema,
      message: z.string().min(1).max(2000),
      creditAmount: z.number().positive().optional(),
      creditReference: z.string().optional(),
      replacementInfo: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const claim = await ctx.db.query.claims.findFirst({
        where: and(
          eq(claims.supplierPortalCode, input.code.toUpperCase()),
          eq(claims.isDeleted, false)
        ),
      });

      if (!claim) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Ugyldig kode',
        });
      }

      if (claim.supplierRespondedAt) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Denne reklamasjonen er allerede besvart',
        });
      }

      // Determine new status based on response
      let newStatus = claim.status;
      let resolutionType = null;

      switch (input.response) {
        case 'approved':
          newStatus = 'resolved';
          resolutionType = input.creditAmount ? 'credit' : 'replacement';
          break;
        case 'rejected':
          newStatus = 'closed';
          resolutionType = 'rejected';
          break;
        case 'needs_info':
          newStatus = 'in_progress';
          break;
      }

      // Update claim
      await ctx.db.update(claims)
        .set({
          status: newStatus,
          resolution: input.message,
          resolutionType,
          creditAmount: input.creditAmount?.toString(),
          creditReference: input.creditReference,
          supplierRespondedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(claims.id, claim.id));

      // Add timeline entry
      const responseLabel = {
        approved: 'Godkjent',
        rejected: 'Avvist',
        needs_info: 'Trenger mer informasjon',
      }[input.response];

      await ctx.db.insert(claimTimeline).values({
        claimId: claim.id,
        eventType: 'supplier_response',
        description: `Leverandør svarte: ${responseLabel}. ${input.message}`,
      });

      ctx.log.info({ claimId: claim.id, response: input.response }, 'Supplier responded');

      return { success: true };
    }),
});

export type PortalRouter = typeof portalRouter;
