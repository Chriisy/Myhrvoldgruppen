import { pgTable, uuid, varchar, text, boolean, timestamp, decimal, date, index, jsonb } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { baseFields } from './common';
import { customers, suppliers, products } from './crm';
import { users } from './auth';

// Sales Leads (Potensielle kunder)
export const leads = pgTable('leads', {
  id: uuid('id').primaryKey().defaultRandom(),
  leadNumber: varchar('lead_number', { length: 20 }).notNull().unique(),

  // Company info
  companyName: varchar('company_name', { length: 200 }).notNull(),
  orgNumber: varchar('org_number', { length: 20 }),
  industry: varchar('industry', { length: 100 }),
  employeeCount: varchar('employee_count', { length: 20 }),

  // Contact info
  contactName: varchar('contact_name', { length: 200 }),
  contactTitle: varchar('contact_title', { length: 100 }),
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 20 }),

  // Address
  address: text('address'),
  postalCode: varchar('postal_code', { length: 10 }),
  city: varchar('city', { length: 100 }),

  // Lead details
  source: varchar('source', { length: 50 }),
  sourceDetail: varchar('source_detail', { length: 200 }),
  interests: jsonb('interests').$type<string[]>(),
  estimatedValue: decimal('estimated_value', { precision: 12, scale: 2 }),

  // Status
  status: varchar('status', { length: 30 }).notNull().default('new'),
  priority: varchar('priority', { length: 20 }).default('medium'),
  temperature: varchar('temperature', { length: 20 }).default('warm'),

  // Assignment
  assignedToId: uuid('assigned_to_id').references(() => users.id),

  // Conversion
  convertedToCustomerId: uuid('converted_to_customer_id').references(() => customers.id),
  convertedAt: timestamp('converted_at', { withTimezone: true }),

  notes: text('notes'),
  createdById: uuid('created_by_id').references(() => users.id),

  ...baseFields,
}, (table) => [
  index('leads_number_idx').on(table.leadNumber),
  index('leads_status_idx').on(table.status),
  index('leads_assigned_idx').on(table.assignedToId),
]);

// Sales Opportunities (Salgsmuligheter)
export const opportunities = pgTable('opportunities', {
  id: uuid('id').primaryKey().defaultRandom(),
  opportunityNumber: varchar('opportunity_number', { length: 20 }).notNull().unique(),

  // Reference
  customerId: uuid('customer_id').references(() => customers.id),
  leadId: uuid('lead_id').references(() => leads.id),

  // Opportunity details
  name: varchar('name', { length: 200 }).notNull(),
  description: text('description'),

  // Value
  value: decimal('value', { precision: 12, scale: 2 }),
  probability: decimal('probability', { precision: 5, scale: 2 }),
  weightedValue: decimal('weighted_value', { precision: 12, scale: 2 }),

  // Timeline
  expectedCloseDate: date('expected_close_date'),
  stage: varchar('stage', { length: 50 }).notNull().default('qualification'),

  // Products
  products: jsonb('products').$type<{
    productId?: string;
    name: string;
    quantity: number;
    unitPrice: number;
  }[]>(),

  // Competition
  competitor: varchar('competitor', { length: 200 }),
  competitorStrength: text('competitor_strength'),

  // Status
  status: varchar('status', { length: 30 }).notNull().default('open'),
  lostReason: text('lost_reason'),
  wonReason: text('won_reason'),

  // Assignment
  assignedToId: uuid('assigned_to_id').references(() => users.id),

  notes: text('notes'),
  createdById: uuid('created_by_id').references(() => users.id),

  ...baseFields,
}, (table) => [
  index('opportunities_number_idx').on(table.opportunityNumber),
  index('opportunities_customer_idx').on(table.customerId),
  index('opportunities_status_idx').on(table.status),
  index('opportunities_stage_idx').on(table.stage),
  index('opportunities_assigned_idx').on(table.assignedToId),
]);

// Sales Activities (Aktiviteter)
export const salesActivities = pgTable('sales_activities', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Reference (one of these)
  leadId: uuid('lead_id').references(() => leads.id),
  opportunityId: uuid('opportunity_id').references(() => opportunities.id),
  customerId: uuid('customer_id').references(() => customers.id),

  // Activity details
  activityType: varchar('activity_type', { length: 50 }).notNull(),
  subject: varchar('subject', { length: 200 }).notNull(),
  description: text('description'),

  // Timing
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  duration: varchar('duration', { length: 20 }),

  // Status
  status: varchar('status', { length: 30 }).notNull().default('planned'),
  outcome: text('outcome'),
  nextSteps: text('next_steps'),

  // Assignment
  assignedToId: uuid('assigned_to_id').references(() => users.id),

  createdById: uuid('created_by_id').references(() => users.id),

  ...baseFields,
}, (table) => [
  index('sales_activities_lead_idx').on(table.leadId),
  index('sales_activities_opportunity_idx').on(table.opportunityId),
  index('sales_activities_customer_idx').on(table.customerId),
  index('sales_activities_scheduled_idx').on(table.scheduledAt),
]);

// Quotations (Tilbud)
export const quotations = pgTable('quotations', {
  id: uuid('id').primaryKey().defaultRandom(),
  quotationNumber: varchar('quotation_number', { length: 20 }).notNull().unique(),

  // Reference
  customerId: uuid('customer_id').references(() => customers.id),
  opportunityId: uuid('opportunity_id').references(() => opportunities.id),

  // Details
  title: varchar('title', { length: 200 }).notNull(),
  description: text('description'),

  // Lines
  lines: jsonb('lines').$type<{
    id: string;
    productId?: string;
    description: string;
    quantity: number;
    unitPrice: number;
    discount?: number;
    total: number;
  }[]>(),

  // Totals
  subtotal: decimal('subtotal', { precision: 12, scale: 2 }),
  discount: decimal('discount', { precision: 12, scale: 2 }),
  tax: decimal('tax', { precision: 12, scale: 2 }),
  total: decimal('total', { precision: 12, scale: 2 }),

  // Validity
  validFrom: date('valid_from'),
  validUntil: date('valid_until'),

  // Terms
  paymentTerms: text('payment_terms'),
  deliveryTerms: text('delivery_terms'),
  otherTerms: text('other_terms'),

  // Status
  status: varchar('status', { length: 30 }).notNull().default('draft'),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  rejectedAt: timestamp('rejected_at', { withTimezone: true }),
  rejectionReason: text('rejection_reason'),

  // Assignment
  assignedToId: uuid('assigned_to_id').references(() => users.id),

  notes: text('notes'),
  createdById: uuid('created_by_id').references(() => users.id),

  ...baseFields,
}, (table) => [
  index('quotations_number_idx').on(table.quotationNumber),
  index('quotations_customer_idx').on(table.customerId),
  index('quotations_status_idx').on(table.status),
]);

// Relations
export const leadsRelations = relations(leads, ({ one, many }) => ({
  assignedTo: one(users, {
    fields: [leads.assignedToId],
    references: [users.id],
  }),
  convertedToCustomer: one(customers, {
    fields: [leads.convertedToCustomerId],
    references: [customers.id],
  }),
  createdBy: one(users, {
    fields: [leads.createdById],
    references: [users.id],
  }),
  opportunities: many(opportunities),
  activities: many(salesActivities),
}));

export const opportunitiesRelations = relations(opportunities, ({ one, many }) => ({
  customer: one(customers, {
    fields: [opportunities.customerId],
    references: [customers.id],
  }),
  lead: one(leads, {
    fields: [opportunities.leadId],
    references: [leads.id],
  }),
  assignedTo: one(users, {
    fields: [opportunities.assignedToId],
    references: [users.id],
  }),
  createdBy: one(users, {
    fields: [opportunities.createdById],
    references: [users.id],
  }),
  activities: many(salesActivities),
  quotations: many(quotations),
}));

export const salesActivitiesRelations = relations(salesActivities, ({ one }) => ({
  lead: one(leads, {
    fields: [salesActivities.leadId],
    references: [leads.id],
  }),
  opportunity: one(opportunities, {
    fields: [salesActivities.opportunityId],
    references: [opportunities.id],
  }),
  customer: one(customers, {
    fields: [salesActivities.customerId],
    references: [customers.id],
  }),
  assignedTo: one(users, {
    fields: [salesActivities.assignedToId],
    references: [users.id],
  }),
  createdBy: one(users, {
    fields: [salesActivities.createdById],
    references: [users.id],
  }),
}));

export const quotationsRelations = relations(quotations, ({ one }) => ({
  customer: one(customers, {
    fields: [quotations.customerId],
    references: [customers.id],
  }),
  opportunity: one(opportunities, {
    fields: [quotations.opportunityId],
    references: [opportunities.id],
  }),
  assignedTo: one(users, {
    fields: [quotations.assignedToId],
    references: [users.id],
  }),
  createdBy: one(users, {
    fields: [quotations.createdById],
    references: [users.id],
  }),
}));
