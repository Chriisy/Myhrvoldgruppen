import { router } from './trpc';
import { healthRouter } from '../modules/health/health.router';
import { authRouter } from '../modules/auth/auth.router';
import { claimsRouter } from '../modules/claims/claims.router';
import { suppliersRouter } from '../modules/suppliers/suppliers.router';
import { customersRouter } from '../modules/customers/customers.router';
import { portalRouter } from '../modules/portal/portal.router';
import { agreementsRouter } from '../modules/agreements/agreements.router';
import { visitsRouter } from '../modules/visits/visits.router';
import { reportsRouter } from '../modules/reports/reports.router';
import { partnersRouter } from '../modules/partners/partners.router';
import { loansRouter } from '../modules/loans/loans.router';
import { installationsRouter } from '../modules/installations/installations.router';
import { hmsRouter } from '../modules/hms/hms.router';
import { stinkersRouter } from '../modules/stinkers/stinkers.router';
import { salesRouter } from '../modules/sales/sales.router';
import { damagesRouter } from '../modules/damages/damages.router';
import { chatRouter } from '../modules/chat/chat.router';
import { forumRouter } from '../modules/forum/forum.router';

export const appRouter = router({
  health: healthRouter,
  auth: authRouter,
  claims: claimsRouter,
  suppliers: suppliersRouter,
  customers: customersRouter,
  portal: portalRouter,
  agreements: agreementsRouter,
  visits: visitsRouter,
  reports: reportsRouter,
  partners: partnersRouter,
  loans: loansRouter,
  installations: installationsRouter,
  hms: hmsRouter,
  stinkers: stinkersRouter,
  sales: salesRouter,
  damages: damagesRouter,
  chat: chatRouter,
  forum: forumRouter,
});

export type AppRouter = typeof appRouter;
