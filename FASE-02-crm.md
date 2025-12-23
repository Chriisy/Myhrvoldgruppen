# FASE 2: CRM (Suppliers, Products, Customers)

> Fase 1 må være fullført.
> Estimert tid: ~30 minutter.

## Mål

Opprett CRM-tabeller for leverandører, produkter og kunder med:
- Soft delete på alle tabeller
- Zod schemas i packages/shared
- Indekser på viktige felt

---

## Mappestruktur

```
packages/db/src/schema/crm/
├── index.ts
├── suppliers.ts      # ~80 linjer
├── products.ts       # ~80 linjer
└── customers.ts      # ~70 linjer

packages/shared/src/schemas/
└── crm.schema.ts     # Zod validering
```

---

## packages/db/src/schema/crm/suppliers.ts

```typescript
import { pgTable, uuid, varchar, text, boolean, integer, decimal, timestamp, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { baseFields } from '../common';

export const suppliers = pgTable('suppliers', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Identifikasjon
  supplierCode: varchar('supplier_code', { length: 50 }).notNull().unique(),
  shortCode: varchar('short_code', { length: 10 }).notNull(), // ELE, MIE, RAT, UBE
  name: varchar('name', { length: 255 }).notNull(),
  
  // Kontakt
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 50 }),
  contactPerson: varchar('contact_person', { length: 255 }),
  contactEmail: varchar('contact_email', { length: 255 }),
  website: varchar('website', { length: 500 }),
  
  // Adresse
  address: text('address'),
  postalCode: varchar('postal_code', { length: 10 }),
  city: varchar('city', { length: 100 }),
  country: varchar('country', { length: 100 }).default('Norge'),
  
  // Garanti & SLA
  warrantyDays: integer('warranty_days').default(365),
  warrantyText: text('warranty_text'),
  warrantyType: varchar('warranty_type', { length: 50 }), // parts, full, mixed
  slaResponseDays: integer('sla_response_days').default(14),
  
  // Rabatt
  discountPercent: decimal('discount_percent', { precision: 5, scale: 2 }),
  discountText: text('discount_text'),
  
  // Metadata
  productSegment: varchar('product_segment', { length: 100 }),
  countryOfOrigin: varchar('country_of_origin', { length: 100 }),
  
  // Import
  importedAt: timestamp('imported_at', { withTimezone: true }),
  importSource: varchar('import_source', { length: 100 }),
  
  notes: text('notes'),
  isActive: boolean('is_active').default(true).notNull(),
  
  ...baseFields,
}, (table) => ({
  supplierCodeIdx: index('idx_suppliers_code').on(table.supplierCode),
  shortCodeIdx: index('idx_suppliers_short_code').on(table.shortCode),
  nameIdx: index('idx_suppliers_name').on(table.name),
  activeIdx: index('idx_suppliers_active').on(table.isActive),
}));

export const suppliersRelations = relations(suppliers, ({ many }) => ({
  products: many(products),
}));

import { products } from './products';
```

---

## packages/db/src/schema/crm/products.ts

```typescript
import { pgTable, uuid, varchar, text, boolean, integer, decimal, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { baseFields } from '../common';
import { suppliers } from './suppliers';

export const products = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Identifikasjon
  sku: varchar('sku', { length: 100 }).notNull().unique(),
  externalId: varchar('external_id', { length: 100 }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  
  // Kategori
  category: varchar('category', { length: 100 }),
  categoryId: integer('category_id'),
  
  // Leverandør
  supplierId: uuid('supplier_id').references(() => suppliers.id),
  supplierName: varchar('supplier_name', { length: 255 }), // Denormalisert for søk
  
  // Priser
  purchasePrice: decimal('purchase_price', { precision: 12, scale: 2 }),
  sellingPrice: decimal('selling_price', { precision: 12, scale: 2 }),
  
  // Garanti
  warrantyMonths: integer('warranty_months').default(24),
  
  // Bilder & Dokumenter
  imageUrl: varchar('image_url', { length: 500 }),
  documentationUrl: varchar('documentation_url', { length: 500 }),
  sourceUrl: varchar('source_url', { length: 500 }),
  
  // Spesifikasjoner (JSON)
  specifications: jsonb('specifications').$type<Record<string, unknown>>(),
  
  // Sync
  lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
  
  isActive: boolean('is_active').default(true).notNull(),
  
  ...baseFields,
}, (table) => ({
  skuIdx: index('idx_products_sku').on(table.sku),
  supplierIdx: index('idx_products_supplier').on(table.supplierId),
  categoryIdx: index('idx_products_category').on(table.category),
  nameIdx: index('idx_products_name').on(table.name),
  activeIdx: index('idx_products_active').on(table.isActive),
}));

export const productsRelations = relations(products, ({ one }) => ({
  supplier: one(suppliers, {
    fields: [products.supplierId],
    references: [suppliers.id],
  }),
}));
```

---

## packages/db/src/schema/crm/customers.ts

```typescript
import { pgTable, uuid, varchar, text, boolean, index } from 'drizzle-orm/pg-core';
import { baseFields } from '../common';

export const customers = pgTable('customers', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Identifikasjon
  customerNumber: varchar('customer_number', { length: 50 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  orgNumber: varchar('org_number', { length: 20 }),
  
  // Kontakt
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 50 }),
  contactPerson: varchar('contact_person', { length: 255 }),
  
  // Adresse
  address: text('address'),
  postalCode: varchar('postal_code', { length: 10 }),
  city: varchar('city', { length: 100 }),
  country: varchar('country', { length: 100 }).default('Norge'),
  
  // Segmentering (fra Visma)
  category: varchar('category', { length: 100 }),
  customerSegment: varchar('customer_segment', { length: 100 }),
  customerGroup: varchar('customer_group', { length: 100 }),
  customerChain: varchar('customer_chain', { length: 100 }), // Spar, Meny, Coop, etc.
  department: varchar('department', { length: 100 }),
  
  // Import
  dataSource: varchar('data_source', { length: 50 }), // manual, import, api
  externalId: varchar('external_id', { length: 100 }),
  
  notes: text('notes'),
  isActive: boolean('is_active').default(true).notNull(),
  
  ...baseFields,
}, (table) => ({
  customerNumberIdx: index('idx_customers_number').on(table.customerNumber),
  nameIdx: index('idx_customers_name').on(table.name),
  chainIdx: index('idx_customers_chain').on(table.customerChain),
  cityIdx: index('idx_customers_city').on(table.city),
  activeIdx: index('idx_customers_active').on(table.isActive),
}));
```

---

## packages/db/src/schema/crm/index.ts

```typescript
export * from './suppliers';
export * from './products';
export * from './customers';
```

---

## packages/shared/src/schemas/crm.schema.ts

```typescript
import { z } from 'zod';
import { paginationInput } from './common.schema';

// ============ SUPPLIERS ============

export const supplierOutput = z.object({
  id: z.string().uuid(),
  supplierCode: z.string(),
  shortCode: z.string(),
  name: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  contactPerson: z.string().nullable(),
  warrantyDays: z.number().nullable(),
  warrantyType: z.string().nullable(),
  slaResponseDays: z.number().nullable(),
  isActive: z.boolean(),
  createdAt: z.date(),
});

export const supplierListInput = paginationInput.extend({
  search: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const createSupplierInput = z.object({
  supplierCode: z.string().min(1, 'Leverandørkode er påkrevd'),
  shortCode: z.string().min(1).max(10, 'Kortkode maks 10 tegn'),
  name: z.string().min(1, 'Navn er påkrevd'),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  contactPerson: z.string().optional(),
  warrantyDays: z.number().min(0).optional(),
  warrantyType: z.enum(['parts', 'full', 'mixed']).optional(),
  slaResponseDays: z.number().min(1).optional(),
});

// ============ PRODUCTS ============

export const productOutput = z.object({
  id: z.string().uuid(),
  sku: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  category: z.string().nullable(),
  supplierId: z.string().uuid().nullable(),
  supplierName: z.string().nullable(),
  warrantyMonths: z.number().nullable(),
  imageUrl: z.string().nullable(),
  isActive: z.boolean(),
});

export const productListInput = paginationInput.extend({
  search: z.string().optional(),
  supplierId: z.string().uuid().optional(),
  category: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const createProductInput = z.object({
  sku: z.string().min(1, 'SKU er påkrevd'),
  name: z.string().min(1, 'Navn er påkrevd'),
  description: z.string().optional(),
  category: z.string().optional(),
  supplierId: z.string().uuid().optional(),
  warrantyMonths: z.number().min(0).optional(),
});

// ============ CUSTOMERS ============

export const customerOutput = z.object({
  id: z.string().uuid(),
  customerNumber: z.string(),
  name: z.string(),
  orgNumber: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  contactPerson: z.string().nullable(),
  city: z.string().nullable(),
  customerChain: z.string().nullable(),
  isActive: z.boolean(),
});

export const customerListInput = paginationInput.extend({
  search: z.string().optional(),
  customerChain: z.string().optional(),
  city: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const createCustomerInput = z.object({
  customerNumber: z.string().min(1, 'Kundenummer er påkrevd'),
  name: z.string().min(1, 'Navn er påkrevd'),
  orgNumber: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  contactPerson: z.string().optional(),
  address: z.string().optional(),
  postalCode: z.string().optional(),
  city: z.string().optional(),
  customerChain: z.string().optional(),
});

// Types
export type SupplierOutput = z.infer<typeof supplierOutput>;
export type SupplierListInput = z.infer<typeof supplierListInput>;
export type CreateSupplierInput = z.infer<typeof createSupplierInput>;

export type ProductOutput = z.infer<typeof productOutput>;
export type ProductListInput = z.infer<typeof productListInput>;
export type CreateProductInput = z.infer<typeof createProductInput>;

export type CustomerOutput = z.infer<typeof customerOutput>;
export type CustomerListInput = z.infer<typeof customerListInput>;
export type CreateCustomerInput = z.infer<typeof createCustomerInput>;
```

---

## Oppdater schema index

### packages/db/src/schema/index.ts

```typescript
export * from './common';
export * from './auth';
export * from './organization';
export * from './crm';  // <-- Legg til
```

---

## Oppdater shared schemas index

### packages/shared/src/schemas/index.ts

```typescript
export * from './common.schema';
export * from './auth.schema';
export * from './crm.schema';  // <-- Legg til
```

---

## Test

```bash
cd packages/db
pnpm db:generate
```

---

## Sjekkliste

- [ ] suppliers.ts < 100 linjer, ~24 felt
- [ ] products.ts < 100 linjer, ~21 felt
- [ ] customers.ts < 80 linjer, ~20 felt
- [ ] Alle har ...baseFields (soft delete)
- [ ] Indekser på viktige felt
- [ ] crm.schema.ts i packages/shared
- [ ] Zod validering med norske feilmeldinger
- [ ] `pnpm db:generate` OK

---

## Neste fase

Gå til **FASE 3: Claims** for reklamasjonstabeller.
