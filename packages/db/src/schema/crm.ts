import { pgTable, uuid, varchar, text, integer, boolean, decimal, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { baseFields } from './common';

// Suppliers table
export const suppliers = pgTable('suppliers', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 200 }).notNull(),
  shortCode: varchar('short_code', { length: 10 }).notNull().unique(),
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 20 }),
  website: varchar('website', { length: 255 }),
  address: text('address'),
  postalCode: varchar('postal_code', { length: 10 }),
  city: varchar('city', { length: 100 }),
  country: varchar('country', { length: 100 }).default('Norge'),
  contactPerson: varchar('contact_person', { length: 200 }),
  contactEmail: varchar('contact_email', { length: 255 }),
  contactPhone: varchar('contact_phone', { length: 20 }),
  warrantyMonths: integer('warranty_months').default(24),
  claimPortalUrl: varchar('claim_portal_url', { length: 500 }),
  claimPortalUsername: varchar('claim_portal_username', { length: 100 }),
  claimPortalNotes: text('claim_portal_notes'),
  notes: text('notes'),
  isActive: boolean('is_active').notNull().default(true),
  ...baseFields,
}, (table) => [
  index('suppliers_short_code_idx').on(table.shortCode),
  index('suppliers_name_idx').on(table.name),
]);

// Products table
export const products = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  supplierId: uuid('supplier_id').notNull().references(() => suppliers.id),
  name: varchar('name', { length: 300 }).notNull(),
  modelNumber: varchar('model_number', { length: 100 }),
  sku: varchar('sku', { length: 100 }),
  category: varchar('category', { length: 100 }),
  subcategory: varchar('subcategory', { length: 100 }),
  description: text('description'),
  specifications: text('specifications'),
  price: decimal('price', { precision: 12, scale: 2 }),
  currency: varchar('currency', { length: 3 }).default('NOK'),
  warrantyMonths: integer('warranty_months'),
  imageUrl: varchar('image_url', { length: 500 }),
  documentationUrl: varchar('documentation_url', { length: 500 }),
  isActive: boolean('is_active').notNull().default(true),
  ...baseFields,
}, (table) => [
  index('products_supplier_idx').on(table.supplierId),
  index('products_name_idx').on(table.name),
  index('products_sku_idx').on(table.sku),
]);

// Customers table
export const customers = pgTable('customers', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 200 }).notNull(),
  orgNumber: varchar('org_number', { length: 20 }),
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 20 }),
  address: text('address'),
  postalCode: varchar('postal_code', { length: 10 }),
  city: varchar('city', { length: 100 }),
  country: varchar('country', { length: 100 }).default('Norge'),
  contactPerson: varchar('contact_person', { length: 200 }),
  contactEmail: varchar('contact_email', { length: 255 }),
  contactPhone: varchar('contact_phone', { length: 20 }),
  customerType: varchar('customer_type', { length: 50 }).default('business'),
  segment: varchar('segment', { length: 50 }),
  notes: text('notes'),
  isActive: boolean('is_active').notNull().default(true),
  ...baseFields,
}, (table) => [
  index('customers_name_idx').on(table.name),
  index('customers_org_number_idx').on(table.orgNumber),
]);

// Relations
export const suppliersRelations = relations(suppliers, ({ many }) => ({
  products: many(products),
}));

export const productsRelations = relations(products, ({ one }) => ({
  supplier: one(suppliers, {
    fields: [products.supplierId],
    references: [suppliers.id],
  }),
}));

export const customersRelations = relations(customers, ({ many }) => ({
  // claims relation added in claims.ts
}));
