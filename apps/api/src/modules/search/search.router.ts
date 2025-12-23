import { z } from 'zod';
import { eq, and, ilike, desc, or, sql } from 'drizzle-orm';
import { router, protectedProcedure } from '../../trpc/trpc';
import { claims, customers, suppliers, products, serviceAgreements, serviceVisits, discussionIssues } from '@myhrvold/db/schema';

export const searchRouter = router({
  // Global search across all entities
  global: protectedProcedure
    .input(z.object({
      query: z.string().min(1),
      types: z.array(z.enum([
        'claims', 'customers', 'suppliers', 'products',
        'agreements', 'visits', 'forum'
      ])).optional(),
      limit: z.number().int().positive().max(50).default(20),
    }))
    .query(async ({ ctx, input }) => {
      const { query, types, limit } = input;
      const searchTypes = types || ['claims', 'customers', 'suppliers', 'products', 'agreements', 'visits', 'forum'];
      const results: any[] = [];

      // Search claims
      if (searchTypes.includes('claims')) {
        const claimsResults = await ctx.db.query.claims.findMany({
          where: and(
            eq(claims.isDeleted, false),
            or(
              ilike(claims.claimNumber, `%${query}%`),
              ilike(claims.productName, `%${query}%`),
              ilike(claims.serialNumber, `%${query}%`),
              ilike(claims.issueDescription, `%${query}%`)
            )
          ),
          limit: Math.floor(limit / searchTypes.length) + 1,
          orderBy: [desc(claims.createdAt)],
          with: {
            customer: { columns: { name: true } },
          },
        });

        results.push(...claimsResults.map(c => ({
          type: 'claim',
          id: c.id,
          title: c.claimNumber,
          subtitle: c.productName,
          description: c.issueDescription?.substring(0, 100),
          status: c.status,
          meta: { customer: c.customer?.name },
        })));
      }

      // Search customers
      if (searchTypes.includes('customers')) {
        const customerResults = await ctx.db.query.customers.findMany({
          where: and(
            eq(customers.isDeleted, false),
            or(
              ilike(customers.name, `%${query}%`),
              ilike(customers.orgNumber, `%${query}%`),
              ilike(customers.city, `%${query}%`)
            )
          ),
          limit: Math.floor(limit / searchTypes.length) + 1,
          orderBy: [desc(customers.name)],
        });

        results.push(...customerResults.map(c => ({
          type: 'customer',
          id: c.id,
          title: c.name,
          subtitle: c.city,
          description: c.orgNumber ? `Org: ${c.orgNumber}` : undefined,
          meta: { segment: c.segment },
        })));
      }

      // Search suppliers
      if (searchTypes.includes('suppliers')) {
        const supplierResults = await ctx.db.query.suppliers.findMany({
          where: and(
            eq(suppliers.isDeleted, false),
            or(
              ilike(suppliers.name, `%${query}%`),
              ilike(suppliers.orgNumber, `%${query}%`)
            )
          ),
          limit: Math.floor(limit / searchTypes.length) + 1,
          orderBy: [desc(suppliers.name)],
        });

        results.push(...supplierResults.map(s => ({
          type: 'supplier',
          id: s.id,
          title: s.name,
          subtitle: s.category,
          description: s.orgNumber ? `Org: ${s.orgNumber}` : undefined,
        })));
      }

      // Search products
      if (searchTypes.includes('products')) {
        const productResults = await ctx.db.query.products.findMany({
          where: and(
            eq(products.isDeleted, false),
            or(
              ilike(products.name, `%${query}%`),
              ilike(products.sku, `%${query}%`),
              ilike(products.brand, `%${query}%`)
            )
          ),
          limit: Math.floor(limit / searchTypes.length) + 1,
          orderBy: [desc(products.name)],
        });

        results.push(...productResults.map(p => ({
          type: 'product',
          id: p.id,
          title: p.name,
          subtitle: p.brand,
          description: p.sku ? `SKU: ${p.sku}` : undefined,
        })));
      }

      // Search agreements
      if (searchTypes.includes('agreements')) {
        const agreementResults = await ctx.db.query.serviceAgreements.findMany({
          where: and(
            eq(serviceAgreements.isDeleted, false),
            or(
              ilike(serviceAgreements.agreementNumber, `%${query}%`),
              ilike(serviceAgreements.name, `%${query}%`)
            )
          ),
          limit: Math.floor(limit / searchTypes.length) + 1,
          orderBy: [desc(serviceAgreements.createdAt)],
          with: {
            customer: { columns: { name: true } },
          },
        });

        results.push(...agreementResults.map(a => ({
          type: 'agreement',
          id: a.id,
          title: a.agreementNumber,
          subtitle: a.name,
          status: a.status,
          meta: { customer: a.customer?.name },
        })));
      }

      // Search visits
      if (searchTypes.includes('visits')) {
        const visitResults = await ctx.db.query.serviceVisits.findMany({
          where: and(
            eq(serviceVisits.isDeleted, false),
            ilike(serviceVisits.visitNumber, `%${query}%`)
          ),
          limit: Math.floor(limit / searchTypes.length) + 1,
          orderBy: [desc(serviceVisits.plannedDate)],
          with: {
            customer: { columns: { name: true } },
          },
        });

        results.push(...visitResults.map(v => ({
          type: 'visit',
          id: v.id,
          title: v.visitNumber,
          subtitle: v.customer?.name,
          status: v.status,
        })));
      }

      // Search forum
      if (searchTypes.includes('forum')) {
        const forumResults = await ctx.db.query.discussionIssues.findMany({
          where: and(
            eq(discussionIssues.isDeleted, false),
            or(
              ilike(discussionIssues.title, `%${query}%`),
              ilike(discussionIssues.content, `%${query}%`)
            )
          ),
          limit: Math.floor(limit / searchTypes.length) + 1,
          orderBy: [desc(discussionIssues.lastActivityAt)],
        });

        results.push(...forumResults.map(f => ({
          type: 'forum',
          id: f.id,
          title: f.title,
          subtitle: f.category,
          description: f.content?.substring(0, 100),
          status: f.status,
        })));
      }

      return results.slice(0, limit);
    }),

  // Quick search (for autocomplete)
  quick: protectedProcedure
    .input(z.object({
      query: z.string().min(2),
    }))
    .query(async ({ ctx, input }) => {
      const { query } = input;
      const suggestions: { type: string; value: string; label: string }[] = [];

      // Search claim numbers
      const claimSuggestions = await ctx.db.query.claims.findMany({
        where: and(
          eq(claims.isDeleted, false),
          ilike(claims.claimNumber, `%${query}%`)
        ),
        limit: 3,
        columns: { id: true, claimNumber: true },
      });
      suggestions.push(...claimSuggestions.map(c => ({
        type: 'claim',
        value: c.id,
        label: c.claimNumber,
      })));

      // Search customer names
      const customerSuggestions = await ctx.db.query.customers.findMany({
        where: and(
          eq(customers.isDeleted, false),
          ilike(customers.name, `%${query}%`)
        ),
        limit: 3,
        columns: { id: true, name: true },
      });
      suggestions.push(...customerSuggestions.map(c => ({
        type: 'customer',
        value: c.id,
        label: c.name,
      })));

      return suggestions.slice(0, 8);
    }),

  // Search types metadata
  types: protectedProcedure
    .query(async () => {
      return [
        { id: 'claims', name: 'Reklamasjoner', icon: 'FileText' },
        { id: 'customers', name: 'Kunder', icon: 'Users' },
        { id: 'suppliers', name: 'Leverandører', icon: 'Building' },
        { id: 'products', name: 'Produkter', icon: 'Package' },
        { id: 'agreements', name: 'Avtaler', icon: 'FileCheck' },
        { id: 'visits', name: 'Besøk', icon: 'Calendar' },
        { id: 'forum', name: 'Forum', icon: 'MessageSquare' },
      ];
    }),
});

export type SearchRouter = typeof searchRouter;
