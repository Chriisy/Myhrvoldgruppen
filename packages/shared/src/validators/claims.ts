import { z } from 'zod';

// Claim status enum
export const claimStatusSchema = z.enum([
  'draft',
  'new',
  'in_progress',
  'pending_supplier',
  'pending_parts',
  'resolved',
  'closed',
  'rejected',
]);

export type ClaimStatus = z.infer<typeof claimStatusSchema>;

// Claim priority enum
export const claimPrioritySchema = z.enum(['low', 'medium', 'high', 'urgent']);
export type ClaimPriority = z.infer<typeof claimPrioritySchema>;

// Claim category enum
export const claimCategorySchema = z.enum([
  'electrical',
  'mechanical',
  'cosmetic',
  'software',
  'transport',
  'installation',
  'other',
]);
export type ClaimCategory = z.infer<typeof claimCategorySchema>;

// Create claim input
export const createClaimSchema = z.object({
  supplierId: z.string().uuid(),
  productId: z.string().uuid().optional(),
  productNameText: z.string().min(1).max(300),
  serialNumber: z.string().max(100).optional(),
  purchaseDate: z.coerce.date().optional(),
  invoiceNumber: z.string().max(50).optional(),

  customerId: z.string().uuid().optional(),
  customerCompanyName: z.string().max(200).optional(),
  customerContactName: z.string().max(200).optional(),
  customerEmail: z.string().email().optional(),
  customerPhone: z.string().max(20).optional(),
  customerAddress: z.string().optional(),
  customerPostalCode: z.string().max(10).optional(),
  customerCity: z.string().max(100).optional(),

  problemDescription: z.string().min(10),
  category: claimCategorySchema.optional(),
  priority: claimPrioritySchema.default('medium'),
});

export type CreateClaimInput = z.infer<typeof createClaimSchema>;

// Update claim input
export const updateClaimSchema = z.object({
  id: z.string().uuid(),
  status: claimStatusSchema.optional(),
  priority: claimPrioritySchema.optional(),
  category: claimCategorySchema.optional(),
  problemDescription: z.string().optional(),
  internalNotes: z.string().optional(),
  resolution: z.string().optional(),
  resolutionType: z.string().optional(),
  supplierClaimNumber: z.string().optional(),
  assignedToId: z.string().uuid().optional(),
});

export type UpdateClaimInput = z.infer<typeof updateClaimSchema>;

// List claims filter
export const listClaimsSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
  search: z.string().optional(),
  status: claimStatusSchema.optional(),
  supplierId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  priority: claimPrioritySchema.optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'claimNumber', 'status']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type ListClaimsInput = z.infer<typeof listClaimsSchema>;
