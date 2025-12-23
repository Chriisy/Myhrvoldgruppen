import { router } from './trpc';
import { healthRouter } from '../modules/health/health.router';
import { authRouter } from '../modules/auth/auth.router';
import { claimsRouter } from '../modules/claims/claims.router';
import { suppliersRouter } from '../modules/suppliers/suppliers.router';

export const appRouter = router({
  health: healthRouter,
  auth: authRouter,
  claims: claimsRouter,
  suppliers: suppliersRouter,
});

export type AppRouter = typeof appRouter;
