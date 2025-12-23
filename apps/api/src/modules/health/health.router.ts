import { router, publicProcedure } from '../../trpc/trpc';

export const healthRouter = router({
  check: publicProcedure.query(() => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '0.0.1',
    };
  }),
});
