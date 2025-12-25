import { pgTable, uuid, varchar, text, integer, boolean, timestamp, decimal, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { baseFields } from './common';
import { suppliers, products, customers } from './crm';
import { users } from './auth';

// Claims table - main warranty claims
export const claims = pgTable('claims', {
  id: uuid('id').primaryKey().defaultRandom(),
  claimNumber: varchar('claim_number', { length: 20 }).notNull().unique(),

  // Status & Priority
  status: varchar('status', { length: 30 }).notNull().default('new'),
  priority: varchar('priority', { length: 20 }).notNull().default('medium'),
  category: varchar('category', { length: 50 }),

  // Supplier reference
  supplierId: uuid('supplier_id').notNull().references(() => suppliers.id),
  supplierClaimNumber: varchar('supplier_claim_number', { length: 50 }),
  supplierPortalCode: varchar('supplier_portal_code', { length: 10 }),

  // Product info
  productId: uuid('product_id').references(() => products.id),
  productNameText: varchar('product_name_text', { length: 300 }),
  serialNumber: varchar('serial_number', { length: 100 }),
  purchaseDate: timestamp('purchase_date', { withTimezone: true }),
  invoiceNumber: varchar('invoice_number', { length: 50 }),
  warrantyEndDate: timestamp('warranty_end_date', { withTimezone: true }),

  // Customer info
  customerId: uuid('customer_id').references(() => customers.id),
  customerCompanyName: varchar('customer_company_name', { length: 200 }),
  customerContactName: varchar('customer_contact_name', { length: 200 }),
  customerEmail: varchar('customer_email', { length: 255 }),
  customerPhone: varchar('customer_phone', { length: 20 }),
  customerAddress: text('customer_address'),
  customerPostalCode: varchar('customer_postal_code', { length: 10 }),
  customerCity: varchar('customer_city', { length: 100 }),

  // Problem description
  problemDescription: text('problem_description'),
  internalNotes: text('internal_notes'),

  // Resolution
  resolution: text('resolution'),
  resolutionType: varchar('resolution_type', { length: 50 }),
  creditAmount: decimal('credit_amount', { precision: 12, scale: 2 }),
  creditCurrency: varchar('credit_currency', { length: 3 }).default('NOK'),
  creditReference: varchar('credit_reference', { length: 100 }),

  // Dates
  submittedAt: timestamp('submitted_at', { withTimezone: true }),
  supplierRespondedAt: timestamp('supplier_responded_at', { withTimezone: true }),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  closedAt: timestamp('closed_at', { withTimezone: true }),

  // User references
  createdById: uuid('created_by_id').references(() => users.id),
  assignedToId: uuid('assigned_to_id').references(() => users.id),

  ...baseFields,
}, (table) => [
  index('claims_claim_number_idx').on(table.claimNumber),
  index('claims_status_idx').on(table.status),
  index('claims_supplier_idx').on(table.supplierId),
  index('claims_customer_idx').on(table.customerId),
  index('claims_created_at_idx').on(table.createdAt),
]);

// Claim attachments
export const claimAttachments = pgTable('claim_attachments', {
  id: uuid('id').primaryKey().defaultRandom(),
  claimId: uuid('claim_id').notNull().references(() => claims.id, { onDelete: 'cascade' }),
  fileName: varchar('file_name', { length: 255 }).notNull(),
  fileType: varchar('file_type', { length: 100 }),
  fileSize: integer('file_size'),
  fileUrl: text('file_url').notNull(),
  thumbnailUrl: text('thumbnail_url'),
  uploadedById: uuid('uploaded_by_id').references(() => users.id),
  ...baseFields,
}, (table) => [
  index('claim_attachments_claim_idx').on(table.claimId),
]);

// Claim timeline/history
export const claimTimeline = pgTable('claim_timeline', {
  id: uuid('id').primaryKey().defaultRandom(),
  claimId: uuid('claim_id').notNull().references(() => claims.id, { onDelete: 'cascade' }),
  eventType: varchar('event_type', { length: 50 }).notNull(),
  description: text('description').notNull(),
  metadata: text('metadata'),
  createdById: uuid('created_by_id').references(() => users.id),
  ...baseFields,
}, (table) => [
  index('claim_timeline_claim_idx').on(table.claimId),
  index('claim_timeline_created_at_idx').on(table.createdAt),
]);

// Claim parts (replacement parts)
export const claimParts = pgTable('claim_parts', {
  id: uuid('id').primaryKey().defaultRandom(),
  claimId: uuid('claim_id').notNull().references(() => claims.id, { onDelete: 'cascade' }),
  partNumber: varchar('part_number', { length: 100 }),
  partName: varchar('part_name', { length: 200 }).notNull(),
  quantity: integer('quantity').notNull().default(1),
  unitPrice: decimal('unit_price', { precision: 12, scale: 2 }),
  status: varchar('status', { length: 30 }).default('pending'),
  ...baseFields,
}, (table) => [
  index('claim_parts_claim_idx').on(table.claimId),
]);

// Relations
export const claimsRelations = relations(claims, ({ one, many }) => ({
  supplier: one(suppliers, {
    fields: [claims.supplierId],
    references: [suppliers.id],
  }),
  product: one(products, {
    fields: [claims.productId],
    references: [products.id],
  }),
  customer: one(customers, {
    fields: [claims.customerId],
    references: [customers.id],
  }),
  createdBy: one(users, {
    fields: [claims.createdById],
    references: [users.id],
    relationName: 'createdBy',
  }),
  assignedTo: one(users, {
    fields: [claims.assignedToId],
    references: [users.id],
    relationName: 'assignedTo',
  }),
  attachments: many(claimAttachments),
  timeline: many(claimTimeline),
  parts: many(claimParts),
}));

export const claimAttachmentsRelations = relations(claimAttachments, ({ one }) => ({
  claim: one(claims, {
    fields: [claimAttachments.claimId],
    references: [claims.id],
  }),
  uploadedBy: one(users, {
    fields: [claimAttachments.uploadedById],
    references: [users.id],
  }),
}));

export const claimTimelineRelations = relations(claimTimeline, ({ one }) => ({
  claim: one(claims, {
    fields: [claimTimeline.claimId],
    references: [claims.id],
  }),
  createdBy: one(users, {
    fields: [claimTimeline.createdById],
    references: [users.id],
  }),
}));

export const claimPartsRelations = relations(claimParts, ({ one }) => ({
  claim: one(claims, {
    fields: [claimParts.claimId],
    references: [claims.id],
  }),
}));
