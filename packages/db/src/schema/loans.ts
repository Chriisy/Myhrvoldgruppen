import { pgTable, uuid, varchar, text, boolean, timestamp, integer, decimal, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { baseFields } from './common';
import { customers } from './crm';
import { users } from './auth';

// Loan equipment items (available for lending)
export const loanEquipment = pgTable('loan_equipment', {
  id: uuid('id').primaryKey().defaultRandom(),
  equipmentNumber: varchar('equipment_number', { length: 20 }).notNull().unique(),

  // Equipment details
  name: varchar('name', { length: 200 }).notNull(),
  description: text('description'),
  category: varchar('category', { length: 50 }),
  brand: varchar('brand', { length: 100 }),
  model: varchar('model', { length: 100 }),
  serialNumber: varchar('serial_number', { length: 100 }),

  // Status
  status: varchar('status', { length: 30 }).notNull().default('available'),
  condition: varchar('condition', { length: 30 }).default('good'),

  // Location
  location: varchar('location', { length: 200 }),

  // Value
  purchasePrice: decimal('purchase_price', { precision: 12, scale: 2 }),
  dailyRate: decimal('daily_rate', { precision: 10, scale: 2 }),

  // Technical
  lastServiceDate: timestamp('last_service_date', { withTimezone: true }),
  nextServiceDate: timestamp('next_service_date', { withTimezone: true }),

  notes: text('notes'),

  ...baseFields,
}, (table) => [
  index('loan_equipment_number_idx').on(table.equipmentNumber),
  index('loan_equipment_status_idx').on(table.status),
  index('loan_equipment_category_idx').on(table.category),
]);

// Loan records (who borrowed what and when)
export const loanRecords = pgTable('loan_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  loanNumber: varchar('loan_number', { length: 20 }).notNull().unique(),

  // References
  equipmentId: uuid('equipment_id').notNull().references(() => loanEquipment.id),
  customerId: uuid('customer_id').notNull().references(() => customers.id),

  // Loan details
  status: varchar('status', { length: 30 }).notNull().default('active'),

  // Dates
  loanDate: timestamp('loan_date', { withTimezone: true }).notNull().defaultNow(),
  expectedReturnDate: timestamp('expected_return_date', { withTimezone: true }),
  actualReturnDate: timestamp('actual_return_date', { withTimezone: true }),

  // Condition tracking
  conditionAtLoan: varchar('condition_at_loan', { length: 30 }),
  conditionAtReturn: varchar('condition_at_return', { length: 30 }),

  // Handling
  loanedById: uuid('loaned_by_id').references(() => users.id),
  returnedToId: uuid('returned_to_id').references(() => users.id),

  // Financial
  depositAmount: decimal('deposit_amount', { precision: 10, scale: 2 }),
  totalCost: decimal('total_cost', { precision: 12, scale: 2 }),
  invoiced: boolean('invoiced').default(false),

  // Related
  claimNumber: varchar('claim_number', { length: 20 }),
  visitNumber: varchar('visit_number', { length: 20 }),

  notes: text('notes'),

  ...baseFields,
}, (table) => [
  index('loan_records_number_idx').on(table.loanNumber),
  index('loan_records_equipment_idx').on(table.equipmentId),
  index('loan_records_customer_idx').on(table.customerId),
  index('loan_records_status_idx').on(table.status),
]);

// Relations
export const loanEquipmentRelations = relations(loanEquipment, ({ many }) => ({
  loans: many(loanRecords),
}));

export const loanRecordsRelations = relations(loanRecords, ({ one }) => ({
  equipment: one(loanEquipment, {
    fields: [loanRecords.equipmentId],
    references: [loanEquipment.id],
  }),
  customer: one(customers, {
    fields: [loanRecords.customerId],
    references: [customers.id],
  }),
  loanedBy: one(users, {
    fields: [loanRecords.loanedById],
    references: [users.id],
  }),
  returnedTo: one(users, {
    fields: [loanRecords.returnedToId],
    references: [users.id],
  }),
}));
