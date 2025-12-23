import { timestamp, boolean } from 'drizzle-orm/pg-core';

// Standard timestamps for all tables
export const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
};

// Soft delete fields
export const softDelete = {
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  isDeleted: boolean('is_deleted').notNull().default(false),
};

// Combined timestamps with soft delete
export const baseFields = {
  ...timestamps,
  ...softDelete,
};
