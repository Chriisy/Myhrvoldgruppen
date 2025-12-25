import { pgTable, uuid, varchar, text, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { baseFields } from './common';

// Departments/Regions table
export const departments = pgTable('departments', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull(),
  code: varchar('code', { length: 10 }).notNull().unique(),
  description: text('description'),
  region: varchar('region', { length: 50 }),
  ...baseFields,
}, (table) => [
  index('departments_code_idx').on(table.code),
]);

// Relations will be added after users is defined
export const departmentsRelations = relations(departments, ({ many }) => ({
  // users relation added in auth.ts
}));
