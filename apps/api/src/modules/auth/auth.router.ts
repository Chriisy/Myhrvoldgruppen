import { z } from 'zod';
import { router, publicProcedure, protectedProcedure } from '../../trpc/trpc';
import { AuthService } from './auth.service';
import { loginSchema } from '@myhrvold/shared/validators';

export const authRouter = router({
  login: publicProcedure
    .input(loginSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new AuthService(ctx.db, ctx.log);
      return service.login(input.email, input.password, {
        userAgent: ctx.req.headers['user-agent'],
        ipAddress: ctx.req.ip,
      });
    }),

  logout: protectedProcedure
    .mutation(async ({ ctx }) => {
      const token = ctx.req.headers.authorization?.replace('Bearer ', '');
      if (token) {
        const service = new AuthService(ctx.db, ctx.log);
        await service.logout(token);
      }
      return { success: true };
    }),

  me: protectedProcedure
    .query(async ({ ctx }) => {
      return ctx.user;
    }),
});

export type AuthRouter = typeof authRouter;
