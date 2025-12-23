import { router } from './trpc';
import { healthRouter } from '../modules/health/health.router';
import { authRouter } from '../modules/auth/auth.router';
import { claimsRouter } from '../modules/claims/claims.router';
import { suppliersRouter } from '../modules/suppliers/suppliers.router';
import { customersRouter } from '../modules/customers/customers.router';
import { portalRouter } from '../modules/portal/portal.router';
import { agreementsRouter } from '../modules/agreements/agreements.router';
import { visitsRouter } from '../modules/visits/visits.router';

export const appRouter = router({
  health: healthRouter,
  auth: authRouter,
  claims: claimsRouter,
  suppliers: suppliersRouter,
  customers: customersRouter,
  portal: portalRouter,
  agreements: agreementsRouter,
  visits: visitsRouter,
});

export type AppRouter = typeof appRouter;
