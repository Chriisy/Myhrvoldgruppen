import { pgTable, uuid, varchar, text, boolean, timestamp, integer, index, jsonb } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { baseFields } from './common';
import { users } from './auth';
import { customers } from './crm';
import { serviceVisits } from './service';

// SJA - Safe Job Analysis (Sikker Jobb Analyse)
export const safeJobAnalysis = pgTable('safe_job_analysis', {
  id: uuid('id').primaryKey().defaultRandom(),
  sjaNumber: varchar('sja_number', { length: 20 }).notNull().unique(),

  // References
  visitId: uuid('visit_id').references(() => serviceVisits.id),
  customerId: uuid('customer_id').references(() => customers.id),

  // Job details
  jobTitle: varchar('job_title', { length: 200 }).notNull(),
  jobDescription: text('job_description'),
  location: varchar('location', { length: 200 }),
  plannedDate: timestamp('planned_date', { withTimezone: true }),

  // Risk assessment
  hazards: jsonb('hazards').$type<{
    id: string;
    description: string;
    riskLevel: 'low' | 'medium' | 'high';
    controls: string[];
  }[]>(),

  // Safety measures
  requiredPPE: jsonb('required_ppe').$type<string[]>(),
  safetyMeasures: text('safety_measures'),
  emergencyProcedures: text('emergency_procedures'),

  // Work permit
  workPermitRequired: boolean('work_permit_required').default(false),
  hotWorkPermit: boolean('hot_work_permit').default(false),
  confinedSpacePermit: boolean('confined_space_permit').default(false),

  // Team
  teamMembers: jsonb('team_members').$type<{
    id: string;
    name: string;
    role: string;
    acknowledged: boolean;
    acknowledgedAt?: string;
  }[]>(),

  // Approval
  status: varchar('status', { length: 30 }).notNull().default('draft'),
  approvedById: uuid('approved_by_id').references(() => users.id),
  approvedAt: timestamp('approved_at', { withTimezone: true }),

  // Review
  completedAt: timestamp('completed_at', { withTimezone: true }),
  completionNotes: text('completion_notes'),

  notes: text('notes'),
  createdById: uuid('created_by_id').references(() => users.id),

  ...baseFields,
}, (table) => [
  index('sja_number_idx').on(table.sjaNumber),
  index('sja_visit_idx').on(table.visitId),
  index('sja_status_idx').on(table.status),
]);

// HMS Incidents (Avvik/Hendelser)
export const hmsIncidents = pgTable('hms_incidents', {
  id: uuid('id').primaryKey().defaultRandom(),
  incidentNumber: varchar('incident_number', { length: 20 }).notNull().unique(),

  // Type and classification
  incidentType: varchar('incident_type', { length: 50 }).notNull(),
  severity: varchar('severity', { length: 20 }).notNull().default('minor'),
  category: varchar('category', { length: 50 }),

  // Details
  title: varchar('title', { length: 200 }).notNull(),
  description: text('description').notNull(),
  location: varchar('location', { length: 200 }),

  // Timing
  incidentDate: timestamp('incident_date', { withTimezone: true }).notNull(),
  reportedAt: timestamp('reported_at', { withTimezone: true }).defaultNow(),

  // People involved
  personInvolved: varchar('person_involved', { length: 200 }),
  witnesses: text('witnesses'),

  // Injuries
  injuryOccurred: boolean('injury_occurred').default(false),
  injuryDescription: text('injury_description'),
  medicalTreatment: boolean('medical_treatment').default(false),
  sickLeave: boolean('sick_leave').default(false),
  sickLeaveDays: integer('sick_leave_days'),

  // References
  customerId: uuid('customer_id').references(() => customers.id),
  visitId: uuid('visit_id').references(() => serviceVisits.id),

  // Investigation
  rootCause: text('root_cause'),
  correctiveActions: jsonb('corrective_actions').$type<{
    id: string;
    action: string;
    responsible: string;
    deadline: string;
    completed: boolean;
    completedAt?: string;
  }[]>(),

  // Status
  status: varchar('status', { length: 30 }).notNull().default('reported'),
  closedAt: timestamp('closed_at', { withTimezone: true }),
  closedById: uuid('closed_by_id').references(() => users.id),

  notes: text('notes'),
  createdById: uuid('created_by_id').references(() => users.id),

  ...baseFields,
}, (table) => [
  index('hms_incident_number_idx').on(table.incidentNumber),
  index('hms_incident_type_idx').on(table.incidentType),
  index('hms_incident_status_idx').on(table.status),
  index('hms_incident_date_idx').on(table.incidentDate),
]);

// HMS Checklists (Sjekklister)
export const hmsChecklists = pgTable('hms_checklists', {
  id: uuid('id').primaryKey().defaultRandom(),
  checklistNumber: varchar('checklist_number', { length: 20 }).notNull().unique(),

  // Type
  checklistType: varchar('checklist_type', { length: 50 }).notNull(),
  name: varchar('name', { length: 200 }).notNull(),

  // Reference
  visitId: uuid('visit_id').references(() => serviceVisits.id),
  customerId: uuid('customer_id').references(() => customers.id),

  // Items
  items: jsonb('items').$type<{
    id: string;
    question: string;
    category?: string;
    status: 'ok' | 'not_ok' | 'na' | 'pending';
    comment?: string;
    photo?: string;
  }[]>(),

  // Status
  status: varchar('status', { length: 30 }).notNull().default('in_progress'),
  completedAt: timestamp('completed_at', { withTimezone: true }),

  notes: text('notes'),
  createdById: uuid('created_by_id').references(() => users.id),

  ...baseFields,
}, (table) => [
  index('hms_checklist_number_idx').on(table.checklistNumber),
  index('hms_checklist_type_idx').on(table.checklistType),
  index('hms_checklist_status_idx').on(table.status),
]);

// Relations
export const safeJobAnalysisRelations = relations(safeJobAnalysis, ({ one }) => ({
  visit: one(serviceVisits, {
    fields: [safeJobAnalysis.visitId],
    references: [serviceVisits.id],
  }),
  customer: one(customers, {
    fields: [safeJobAnalysis.customerId],
    references: [customers.id],
  }),
  createdBy: one(users, {
    fields: [safeJobAnalysis.createdById],
    references: [users.id],
  }),
  approvedBy: one(users, {
    fields: [safeJobAnalysis.approvedById],
    references: [users.id],
  }),
}));

export const hmsIncidentsRelations = relations(hmsIncidents, ({ one }) => ({
  customer: one(customers, {
    fields: [hmsIncidents.customerId],
    references: [customers.id],
  }),
  visit: one(serviceVisits, {
    fields: [hmsIncidents.visitId],
    references: [serviceVisits.id],
  }),
  createdBy: one(users, {
    fields: [hmsIncidents.createdById],
    references: [users.id],
  }),
  closedBy: one(users, {
    fields: [hmsIncidents.closedById],
    references: [users.id],
  }),
}));

export const hmsChecklistsRelations = relations(hmsChecklists, ({ one }) => ({
  visit: one(serviceVisits, {
    fields: [hmsChecklists.visitId],
    references: [serviceVisits.id],
  }),
  customer: one(customers, {
    fields: [hmsChecklists.customerId],
    references: [customers.id],
  }),
  createdBy: one(users, {
    fields: [hmsChecklists.createdById],
    references: [users.id],
  }),
}));
