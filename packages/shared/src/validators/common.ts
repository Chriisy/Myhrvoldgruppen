import { z } from 'zod';

// Pagination
export const paginationInput = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
});

export const paginatedOutput = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    items: z.array(itemSchema),
    total: z.number(),
    page: z.number(),
    limit: z.number(),
    totalPages: z.number(),
  });

// ID validation
export const idInput = z.object({
  id: z.string().uuid(),
});

// Timestamp output
export const timestampsOutput = z.object({
  createdAt: z.date(),
  updatedAt: z.date(),
  deletedAt: z.date().nullable(),
});

// Date range input
export const dateRangeInput = z.object({
  startDate: z.date().optional(),
  endDate: z.date().optional(),
});

// Sort input
export const sortInput = z.object({
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// Search input
export const searchInput = z.object({
  query: z.string().min(1).max(200),
});

// File upload
export const fileInput = z.object({
  filename: z.string().min(1).max(255),
  mimeType: z.string(),
  size: z.number().positive(),
  base64: z.string(),
});

// Address
export const addressSchema = z.object({
  street: z.string().max(200).optional(),
  postalCode: z.string().max(10).optional(),
  city: z.string().max(100).optional(),
  country: z.string().max(100).default('Norge'),
});

// Contact info
export const contactSchema = z.object({
  name: z.string().max(200).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(50).optional(),
  role: z.string().max(100).optional(),
});

// Norwegian specific
export const orgNumberSchema = z.string().regex(/^\d{9}$/, 'Organisasjonsnummer ma vare 9 siffer');
export const phoneNumberSchema = z.string().regex(/^(\+47)?[\d\s]{8,}$/, 'Ugyldig telefonnummer');

// Types
export type PaginationInput = z.infer<typeof paginationInput>;
export type IdInput = z.infer<typeof idInput>;
export type DateRangeInput = z.infer<typeof dateRangeInput>;
export type SortInput = z.infer<typeof sortInput>;
export type SearchInput = z.infer<typeof searchInput>;
export type FileInput = z.infer<typeof fileInput>;
export type AddressSchema = z.infer<typeof addressSchema>;
export type ContactSchema = z.infer<typeof contactSchema>;
