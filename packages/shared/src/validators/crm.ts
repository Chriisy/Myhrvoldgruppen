import { z } from 'zod';

// Customer segment
export const CUSTOMER_SEGMENT = {
  RESTAURANT: 'restaurant',
  HOTEL: 'hotel',
  CATERING: 'catering',
  INSTITUTION: 'institution',
  RETAIL: 'retail',
  OTHER: 'other',
} as const;

export const customerSegmentEnum = z.enum([
  CUSTOMER_SEGMENT.RESTAURANT,
  CUSTOMER_SEGMENT.HOTEL,
  CUSTOMER_SEGMENT.CATERING,
  CUSTOMER_SEGMENT.INSTITUTION,
  CUSTOMER_SEGMENT.RETAIL,
  CUSTOMER_SEGMENT.OTHER,
]);

// Supplier category
export const SUPPLIER_CATEGORY = {
  REFRIGERATION: 'refrigeration',
  COOKING: 'cooking',
  DISHWASHING: 'dishwashing',
  VENTILATION: 'ventilation',
  FURNITURE: 'furniture',
  SMALLWARE: 'smallware',
  OTHER: 'other',
} as const;

export const supplierCategoryEnum = z.enum([
  SUPPLIER_CATEGORY.REFRIGERATION,
  SUPPLIER_CATEGORY.COOKING,
  SUPPLIER_CATEGORY.DISHWASHING,
  SUPPLIER_CATEGORY.VENTILATION,
  SUPPLIER_CATEGORY.FURNITURE,
  SUPPLIER_CATEGORY.SMALLWARE,
  SUPPLIER_CATEGORY.OTHER,
]);

// Create customer input
export const createCustomerInput = z.object({
  name: z.string().min(1).max(200),
  orgNumber: z.string().regex(/^\d{9}$/).optional(),
  segment: customerSegmentEnum.optional(),
  address: z.string().max(200).optional(),
  postalCode: z.string().max(10).optional(),
  city: z.string().max(100).optional(),
  phone: z.string().max(50).optional(),
  email: z.string().email().optional(),
  website: z.string().url().optional(),
  notes: z.string().optional(),
  primaryContactId: z.string().uuid().optional(),
});

// Update customer input
export const updateCustomerInput = createCustomerInput.partial().extend({
  id: z.string().uuid(),
});

// Create supplier input
export const createSupplierInput = z.object({
  name: z.string().min(1).max(200),
  orgNumber: z.string().regex(/^\d{9}$/).optional(),
  category: supplierCategoryEnum.optional(),
  address: z.string().max(200).optional(),
  postalCode: z.string().max(10).optional(),
  city: z.string().max(100).optional(),
  country: z.string().max(100).default('Norge'),
  phone: z.string().max(50).optional(),
  email: z.string().email().optional(),
  website: z.string().url().optional(),
  claimEmail: z.string().email().optional(),
  claimPhone: z.string().max(50).optional(),
  warrantyMonths: z.number().int().positive().optional(),
  notes: z.string().optional(),
});

// Update supplier input
export const updateSupplierInput = createSupplierInput.partial().extend({
  id: z.string().uuid(),
});

// Product category
export const PRODUCT_CATEGORY = {
  REFRIGERATOR: 'refrigerator',
  FREEZER: 'freezer',
  OVEN: 'oven',
  STOVE: 'stove',
  DISHWASHER: 'dishwasher',
  HOOD: 'hood',
  ICE_MACHINE: 'ice_machine',
  COFFEE_MACHINE: 'coffee_machine',
  OTHER: 'other',
} as const;

export const productCategoryEnum = z.enum([
  PRODUCT_CATEGORY.REFRIGERATOR,
  PRODUCT_CATEGORY.FREEZER,
  PRODUCT_CATEGORY.OVEN,
  PRODUCT_CATEGORY.STOVE,
  PRODUCT_CATEGORY.DISHWASHER,
  PRODUCT_CATEGORY.HOOD,
  PRODUCT_CATEGORY.ICE_MACHINE,
  PRODUCT_CATEGORY.COFFEE_MACHINE,
  PRODUCT_CATEGORY.OTHER,
]);

// Create product input
export const createProductInput = z.object({
  supplierId: z.string().uuid(),
  name: z.string().min(1).max(200),
  sku: z.string().max(50).optional(),
  brand: z.string().max(100).optional(),
  model: z.string().max(100).optional(),
  category: productCategoryEnum.optional(),
  description: z.string().optional(),
  warrantyMonths: z.number().int().positive().optional(),
  listPrice: z.number().nonnegative().optional(),
});

// Types
export type CustomerSegment = z.infer<typeof customerSegmentEnum>;
export type SupplierCategory = z.infer<typeof supplierCategoryEnum>;
export type ProductCategory = z.infer<typeof productCategoryEnum>;
export type CreateCustomerInput = z.infer<typeof createCustomerInput>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerInput>;
export type CreateSupplierInput = z.infer<typeof createSupplierInput>;
export type UpdateSupplierInput = z.infer<typeof updateSupplierInput>;
export type CreateProductInput = z.infer<typeof createProductInput>;
