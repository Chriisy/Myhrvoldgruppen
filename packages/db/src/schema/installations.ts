import { pgTable, uuid, varchar, text, integer, timestamp, decimal, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { baseFields } from './common';
import { suppliers, products, customers } from './crm';
import { users } from './auth';

// Installations
export const installations = pgTable('installations', {
  id: uuid('id').primaryKey().defaultRandom(),
  installationNumber: varchar('installation_number', { length: 20 }).notNull().unique(),

  // References
  supplierId: uuid('supplier_id').references(() => suppliers.id),
  productId: uuid('product_id').references(() => products.id),
  customerId: uuid('customer_id').notNull().references(() => customers.id),

  // Product details
  productName: varchar('product_name', { length: 300 }),
  serialNumber: varchar('serial_number', { length: 100 }),
  quantity: integer('quantity').default(1),

  // Status
  status: varchar('status', { length: 30 }).notNull().default('planned'),
  priority: varchar('priority', { length: 20 }).default('normal'),

  // Scheduling
  plannedDate: timestamp('planned_date', { withTimezone: true }),
  confirmedDate: timestamp('confirmed_date', { withTimezone: true }),
  completedDate: timestamp('completed_date', { withTimezone: true }),

  // Location
  installationAddress: text('installation_address'),
  installationPostalCode: varchar('installation_postal_code', { length: 10 }),
  installationCity: varchar('installation_city', { length: 100 }),
  floor: varchar('floor', { length: 20 }),
  accessInstructions: text('access_instructions'),

  // Technical requirements
  electricalRequirements: text('electrical_requirements'),
  plumbingRequirements: text('plumbing_requirements'),
  ventilationRequirements: text('ventilation_requirements'),
  otherRequirements: text('other_requirements'),

  // Work details
  workDescription: text('work_description'),
  notes: text('notes'),

  // Costs
  laborCost: decimal('labor_cost', { precision: 12, scale: 2 }),
  materialCost: decimal('material_cost', { precision: 12, scale: 2 }),
  totalCost: decimal('total_cost', { precision: 12, scale: 2 }),

  // References
  technicianId: uuid('technician_id').references(() => users.id),
  createdById: uuid('created_by_id').references(() => users.id),

  ...baseFields,
}, (table) => [
  index('installations_number_idx').on(table.installationNumber),
  index('installations_customer_idx').on(table.customerId),
  index('installations_status_idx').on(table.status),
  index('installations_planned_date_idx').on(table.plannedDate),
]);

// Transport damages
export const transportDamages = pgTable('transport_damages', {
  id: uuid('id').primaryKey().defaultRandom(),
  damageNumber: varchar('damage_number', { length: 20 }).notNull().unique(),

  // References
  supplierId: uuid('supplier_id').references(() => suppliers.id),
  productId: uuid('product_id').references(() => products.id),

  // Product details
  productName: varchar('product_name', { length: 300 }),
  serialNumber: varchar('serial_number', { length: 100 }),
  quantity: integer('quantity').default(1),

  // Shipment info
  orderNumber: varchar('order_number', { length: 50 }),
  deliveryDate: timestamp('delivery_date', { withTimezone: true }),
  carrier: varchar('carrier', { length: 200 }),
  trackingNumber: varchar('tracking_number', { length: 100 }),

  // Damage details
  damageDescription: text('damage_description'),
  damageType: varchar('damage_type', { length: 50 }),
  severity: varchar('severity', { length: 20 }),

  // Status
  status: varchar('status', { length: 30 }).notNull().default('reported'),
  resolution: text('resolution'),
  resolutionType: varchar('resolution_type', { length: 50 }),

  // Costs
  claimAmount: decimal('claim_amount', { precision: 12, scale: 2 }),
  settledAmount: decimal('settled_amount', { precision: 12, scale: 2 }),

  // Dates
  reportedAt: timestamp('reported_at', { withTimezone: true }).defaultNow(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),

  notes: text('notes'),
  createdById: uuid('created_by_id').references(() => users.id),

  ...baseFields,
}, (table) => [
  index('transport_damages_number_idx').on(table.damageNumber),
  index('transport_damages_supplier_idx').on(table.supplierId),
  index('transport_damages_status_idx').on(table.status),
]);

// Relations
export const installationsRelations = relations(installations, ({ one }) => ({
  supplier: one(suppliers, {
    fields: [installations.supplierId],
    references: [suppliers.id],
  }),
  product: one(products, {
    fields: [installations.productId],
    references: [products.id],
  }),
  customer: one(customers, {
    fields: [installations.customerId],
    references: [customers.id],
  }),
  technician: one(users, {
    fields: [installations.technicianId],
    references: [users.id],
  }),
  createdBy: one(users, {
    fields: [installations.createdById],
    references: [users.id],
  }),
}));

export const transportDamagesRelations = relations(transportDamages, ({ one }) => ({
  supplier: one(suppliers, {
    fields: [transportDamages.supplierId],
    references: [suppliers.id],
  }),
  product: one(products, {
    fields: [transportDamages.productId],
    references: [products.id],
  }),
  createdBy: one(users, {
    fields: [transportDamages.createdById],
    references: [users.id],
  }),
}));
