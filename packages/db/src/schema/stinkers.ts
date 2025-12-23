import { pgTable, uuid, varchar, text, boolean, timestamp, integer, decimal, index, jsonb } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { baseFields } from './common';
import { suppliers, products, customers } from './crm';
import { users } from './auth';

// Stinkers - Problematic equipment/products with recurring issues
export const stinkers = pgTable('stinkers', {
  id: uuid('id').primaryKey().defaultRandom(),
  stinkerNumber: varchar('stinker_number', { length: 20 }).notNull().unique(),

  // Product identification
  productId: uuid('product_id').references(() => products.id),
  productName: varchar('product_name', { length: 300 }).notNull(),
  brand: varchar('brand', { length: 100 }),
  model: varchar('model', { length: 100 }),
  serialNumber: varchar('serial_number', { length: 100 }),

  // Supplier
  supplierId: uuid('supplier_id').references(() => suppliers.id),

  // Customer where issue occurred
  customerId: uuid('customer_id').references(() => customers.id),

  // Classification
  issueType: varchar('issue_type', { length: 50 }).notNull(),
  severity: varchar('severity', { length: 20 }).notNull().default('medium'),
  frequency: varchar('frequency', { length: 20 }),

  // Description
  issueDescription: text('issue_description').notNull(),
  symptoms: text('symptoms'),
  possibleCauses: text('possible_causes'),

  // History
  firstReportedAt: timestamp('first_reported_at', { withTimezone: true }),
  totalIncidents: integer('total_incidents').default(1),
  relatedClaimNumbers: jsonb('related_claim_numbers').$type<string[]>(),

  // Resolution
  status: varchar('status', { length: 30 }).notNull().default('open'),
  resolution: text('resolution'),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  resolvedById: uuid('resolved_by_id').references(() => users.id),

  // Cost impact
  estimatedCost: decimal('estimated_cost', { precision: 12, scale: 2 }),
  actualCost: decimal('actual_cost', { precision: 12, scale: 2 }),

  // Recommendations
  recommendation: text('recommendation'),
  preventiveMeasures: text('preventive_measures'),

  // Follow-up
  followUpRequired: boolean('follow_up_required').default(false),
  followUpDate: timestamp('follow_up_date', { withTimezone: true }),

  notes: text('notes'),
  createdById: uuid('created_by_id').references(() => users.id),

  ...baseFields,
}, (table) => [
  index('stinkers_number_idx').on(table.stinkerNumber),
  index('stinkers_supplier_idx').on(table.supplierId),
  index('stinkers_product_idx').on(table.productId),
  index('stinkers_status_idx').on(table.status),
]);

// Relations
export const stinkersRelations = relations(stinkers, ({ one }) => ({
  product: one(products, {
    fields: [stinkers.productId],
    references: [products.id],
  }),
  supplier: one(suppliers, {
    fields: [stinkers.supplierId],
    references: [suppliers.id],
  }),
  customer: one(customers, {
    fields: [stinkers.customerId],
    references: [customers.id],
  }),
  resolvedBy: one(users, {
    fields: [stinkers.resolvedById],
    references: [users.id],
  }),
  createdBy: one(users, {
    fields: [stinkers.createdById],
    references: [users.id],
  }),
}));
