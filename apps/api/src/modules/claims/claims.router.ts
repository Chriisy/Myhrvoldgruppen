import { z } from 'zod';
import { router, protectedProcedure } from '../../trpc/trpc';
import { ClaimsService } from './claims.service';
import { createClaimSchema, updateClaimSchema, listClaimsSchema } from '@myhrvold/shared/validators';

export const claimsRouter = router({
  create: protectedProcedure
    .input(createClaimSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new ClaimsService(ctx.db, ctx.log);
      return service.create(input, ctx.user.id);
    }),

  list: protectedProcedure
    .input(listClaimsSchema)
    .query(async ({ ctx, input }) => {
      const service = new ClaimsService(ctx.db, ctx.log);
      return service.list(input);
    }),

  byId: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new ClaimsService(ctx.db, ctx.log);
      return service.getById(input.id);
    }),

  update: protectedProcedure
    .input(updateClaimSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new ClaimsService(ctx.db, ctx.log);
      return service.update(input, ctx.user.id);
    }),

  stats: protectedProcedure
    .query(async ({ ctx }) => {
      const service = new ClaimsService(ctx.db, ctx.log);
      return service.getStats();
    }),
});

export type ClaimsRouter = typeof claimsRouter;
