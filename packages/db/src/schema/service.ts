import { pgTable, uuid, varchar, text, integer, boolean, timestamp, decimal, date, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { baseFields } from './common';
import { customers } from './crm';
import { users } from './auth';

// Service agreements (vedlikeholdsavtaler)
export const serviceAgreements = pgTable('service_agreements', {
  id: uuid('id').primaryKey().defaultRandom(),
  agreementNumber: varchar('agreement_number', { length: 20 }).notNull().unique(),
  customerId: uuid('customer_id').notNull().references(() => customers.id),

  // Agreement details
  name: varchar('name', { length: 200 }).notNull(),
  description: text('description'),
  agreementType: varchar('agreement_type', { length: 50 }).default('standard'),

  // Dates
  startDate: date('start_date').notNull(),
  endDate: date('end_date'),
  renewalDate: date('renewal_date'),

  // Pricing
  annualValue: decimal('annual_value', { precision: 12, scale: 2 }),
  currency: varchar('currency', { length: 3 }).default('NOK'),
  billingFrequency: varchar('billing_frequency', { length: 20 }).default('monthly'),

  // Service schedule
  visitsPerYear: integer('visits_per_year').default(4),
  preferredMonth: integer('preferred_month'),

  // Status
  status: varchar('status', { length: 30 }).notNull().default('active'),
  notes: text('notes'),

  // References
  createdById: uuid('created_by_id').references(() => users.id),
  assignedToId: uuid('assigned_to_id').references(() => users.id),

  ...baseFields,
}, (table) => [
  index('service_agreements_number_idx').on(table.agreementNumber),
  index('service_agreements_customer_idx').on(table.customerId),
  index('service_agreements_status_idx').on(table.status),
]);

// Service partners (external technicians)
export const servicePartners = pgTable('service_partners', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 200 }).notNull(),
  orgNumber: varchar('org_number', { length: 20 }),
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 20 }),
  address: text('address'),
  postalCode: varchar('postal_code', { length: 10 }),
  city: varchar('city', { length: 100 }),
  region: varchar('region', { length: 50 }),

  // Contact
  contactPerson: varchar('contact_person', { length: 200 }),
  contactEmail: varchar('contact_email', { length: 255 }),
  contactPhone: varchar('contact_phone', { length: 20 }),

  // Capabilities
  serviceTypes: text('service_types'),
  certifications: text('certifications'),
  brands: text('brands'),

  // Rating
  rating: decimal('rating', { precision: 3, scale: 2 }),

  // Status
  isActive: boolean('is_active').notNull().default(true),
  notes: text('notes'),

  ...baseFields,
}, (table) => [
  index('service_partners_name_idx').on(table.name),
  index('service_partners_region_idx').on(table.region),
]);

// Service visits (planned and completed)
export const serviceVisits = pgTable('service_visits', {
  id: uuid('id').primaryKey().defaultRandom(),
  visitNumber: varchar('visit_number', { length: 20 }).notNull().unique(),

  // References
  agreementId: uuid('agreement_id').references(() => serviceAgreements.id),
  customerId: uuid('customer_id').notNull().references(() => customers.id),
  partnerId: uuid('partner_id').references(() => servicePartners.id),
  technicianId: uuid('technician_id').references(() => users.id),

  // Visit details
  visitType: varchar('visit_type', { length: 50 }).notNull().default('maintenance'),
  status: varchar('status', { length: 30 }).notNull().default('planned'),
  priority: varchar('priority', { length: 20 }).default('normal'),

  // Scheduling
  plannedDate: timestamp('planned_date', { withTimezone: true }),
  plannedDuration: integer('planned_duration'),
  actualStartTime: timestamp('actual_start_time', { withTimezone: true }),
  actualEndTime: timestamp('actual_end_time', { withTimezone: true }),

  // Work details
  workDescription: text('work_description'),
  workPerformed: text('work_performed'),
  findings: text('findings'),
  recommendations: text('recommendations'),

  // Customer signature
  customerSignature: text('customer_signature'),
  customerSignedAt: timestamp('customer_signed_at', { withTimezone: true }),
  customerSignedBy: varchar('customer_signed_by', { length: 200 }),

  // Billing
  laborHours: decimal('labor_hours', { precision: 5, scale: 2 }),
  laborCost: decimal('labor_cost', { precision: 12, scale: 2 }),
  partsCost: decimal('parts_cost', { precision: 12, scale: 2 }),
  travelCost: decimal('travel_cost', { precision: 12, scale: 2 }),
  totalCost: decimal('total_cost', { precision: 12, scale: 2 }),
  isBillable: boolean('is_billable').default(true),
  invoiceNumber: varchar('invoice_number', { length: 50 }),

  notes: text('notes'),

  ...baseFields,
}, (table) => [
  index('service_visits_number_idx').on(table.visitNumber),
  index('service_visits_agreement_idx').on(table.agreementId),
  index('service_visits_customer_idx').on(table.customerId),
  index('service_visits_status_idx').on(table.status),
  index('service_visits_planned_date_idx').on(table.plannedDate),
]);

// Relations
export const serviceAgreementsRelations = relations(serviceAgreements, ({ one, many }) => ({
  customer: one(customers, {
    fields: [serviceAgreements.customerId],
    references: [customers.id],
  }),
  createdBy: one(users, {
    fields: [serviceAgreements.createdById],
    references: [users.id],
  }),
  assignedTo: one(users, {
    fields: [serviceAgreements.assignedToId],
    references: [users.id],
  }),
  visits: many(serviceVisits),
}));

export const servicePartnersRelations = relations(servicePartners, ({ many }) => ({
  visits: many(serviceVisits),
}));

export const serviceVisitsRelations = relations(serviceVisits, ({ one }) => ({
  agreement: one(serviceAgreements, {
    fields: [serviceVisits.agreementId],
    references: [serviceAgreements.id],
  }),
  customer: one(customers, {
    fields: [serviceVisits.customerId],
    references: [customers.id],
  }),
  partner: one(servicePartners, {
    fields: [serviceVisits.partnerId],
    references: [servicePartners.id],
  }),
  technician: one(users, {
    fields: [serviceVisits.technicianId],
    references: [users.id],
  }),
}));
