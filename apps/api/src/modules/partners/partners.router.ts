import { z } from 'zod';
import { eq, and, ilike, desc, count } from 'drizzle-orm';
import { router, protectedProcedure, publicProcedure } from '../../trpc/trpc';
import { servicePartners } from '@myhrvold/db/schema';

export const partnersRouter = router({
  // List all active partners
  list: protectedProcedure
    .input(z.object({
      page: z.number().int().positive().default(1),
      limit: z.number().int().positive().max(100).default(50),
      search: z.string().optional(),
      region: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const { page, limit, search, region } = input;
      const offset = (page - 1) * limit;

      const conditions = [
        eq(servicePartners.isDeleted, false),
        eq(servicePartners.isActive, true),
      ];

      if (search) {
        conditions.push(ilike(servicePartners.name, `%${search}%`));
      }

      if (region) {
        conditions.push(eq(servicePartners.region, region));
      }

      const result = await ctx.db.query.servicePartners.findMany({
        where: and(...conditions),
        orderBy: [desc(servicePartners.name)],
        limit,
        offset,
      });

      return result;
    }),

  // Get partner by ID
  byId: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const partner = await ctx.db.query.servicePartners.findFirst({
        where: and(
          eq(servicePartners.id, input.id),
          eq(servicePartners.isDeleted, false)
        ),
        with: {
          visits: {
            limit: 10,
            orderBy: (visits, { desc }) => [desc(visits.plannedDate)],
          },
        },
      });

      return partner;
    }),

  // Get partners for map with location data
  forMap: protectedProcedure
    .input(z.object({
      region: z.string().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const conditions = [
        eq(servicePartners.isDeleted, false),
        eq(servicePartners.isActive, true),
      ];

      if (input?.region) {
        conditions.push(eq(servicePartners.region, input.region));
      }

      const partners = await ctx.db.query.servicePartners.findMany({
        where: and(...conditions),
        columns: {
          id: true,
          name: true,
          address: true,
          postalCode: true,
          city: true,
          region: true,
          phone: true,
          email: true,
          serviceTypes: true,
          rating: true,
        },
      });

      // In production, would geocode addresses or store lat/lng in database
      // For now, returning partners with placeholder coordinates based on region
      return partners.map(partner => ({
        ...partner,
        // Placeholder coordinates (would be real geocoded data in production)
        latitude: getRegionLatitude(partner.region),
        longitude: getRegionLongitude(partner.region),
      }));
    }),

  // Create new partner
  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(200),
      orgNumber: z.string().optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      address: z.string().optional(),
      postalCode: z.string().optional(),
      city: z.string().optional(),
      region: z.string().optional(),
      contactPerson: z.string().optional(),
      contactEmail: z.string().email().optional(),
      contactPhone: z.string().optional(),
      serviceTypes: z.string().optional(),
      certifications: z.string().optional(),
      brands: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [partner] = await ctx.db.insert(servicePartners).values({
        ...input,
        isActive: true,
      }).returning();

      return partner;
    }),

  // Update partner
  update: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      name: z.string().min(1).max(200).optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      address: z.string().optional(),
      postalCode: z.string().optional(),
      city: z.string().optional(),
      region: z.string().optional(),
      contactPerson: z.string().optional(),
      contactEmail: z.string().email().optional(),
      contactPhone: z.string().optional(),
      serviceTypes: z.string().optional(),
      certifications: z.string().optional(),
      brands: z.string().optional(),
      rating: z.number().min(0).max(5).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, rating, ...data } = input;

      const [partner] = await ctx.db.update(servicePartners)
        .set({
          ...data,
          rating: rating?.toString(),
          updatedAt: new Date(),
        })
        .where(eq(servicePartners.id, id))
        .returning();

      return partner;
    }),

  // Get regions list
  regions: protectedProcedure
    .query(async ({ ctx }) => {
      // Norwegian regions for service partners
      return [
        { id: 'oslo', name: 'Oslo/Akershus' },
        { id: 'vestland', name: 'Vestland' },
        { id: 'rogaland', name: 'Rogaland' },
        { id: 'trondelag', name: 'Trøndelag' },
        { id: 'nordland', name: 'Nordland' },
        { id: 'innlandet', name: 'Innlandet' },
        { id: 'viken', name: 'Viken' },
        { id: 'vestfold-telemark', name: 'Vestfold og Telemark' },
        { id: 'agder', name: 'Agder' },
        { id: 'more-romsdal', name: 'Møre og Romsdal' },
      ];
    }),

  // Partner stats
  stats: protectedProcedure
    .query(async ({ ctx }) => {
      const [total] = await ctx.db
        .select({ count: count() })
        .from(servicePartners)
        .where(and(
          eq(servicePartners.isDeleted, false),
          eq(servicePartners.isActive, true)
        ));

      return {
        total: Number(total.count),
      };
    }),
});

// Helper functions for placeholder coordinates
function getRegionLatitude(region: string | null): number {
  const coords: Record<string, number> = {
    'oslo': 59.9139,
    'vestland': 60.3913,
    'rogaland': 58.9700,
    'trondelag': 63.4305,
    'nordland': 67.2804,
    'innlandet': 61.1153,
    'viken': 59.7439,
    'vestfold-telemark': 59.2676,
    'agder': 58.1599,
    'more-romsdal': 62.4722,
  };
  return coords[region || 'oslo'] || 59.9139;
}

function getRegionLongitude(region: string | null): number {
  const coords: Record<string, number> = {
    'oslo': 10.7522,
    'vestland': 5.3221,
    'rogaland': 5.7331,
    'trondelag': 10.3951,
    'nordland': 14.4049,
    'innlandet': 10.4662,
    'viken': 10.2045,
    'vestfold-telemark': 10.4076,
    'agder': 7.9956,
    'more-romsdal': 6.1549,
  };
  return coords[region || 'oslo'] || 10.7522;
}

export type PartnersRouter = typeof partnersRouter;
