import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/myhrvold';

// For query usage
const queryClient = postgres(connectionString);
export const db = drizzle(queryClient, { schema });

// Export types
export type Database = typeof db;
