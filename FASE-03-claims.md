# FASE 3: Claims (Reklamasjoner Database)

> Fase 1-2 må være fullført.
> Estimert tid: ~45 minutter.

## Mål

Opprett reklamasjonstabeller - dette er HOVEDMODULEN i systemet.

---

## Mappestruktur

```
packages/db/src/schema/claims/
├── index.ts
├── enums.ts              # Alle enums samlet
├── claims.ts             # Hovedtabell (~120 linjer)
├── claim-parts.ts        # Deler (~60 linjer)
├── claim-attachments.ts  # Vedlegg (~50 linjer)
└── claim-timeline.ts     # Hendelseslogg (~50 linjer)
```

---

## packages/db/src/schema/claims/enums.ts

```typescript
import { pgEnum } from 'drizzle-orm/pg-core';

export const claimStatusEnum = pgEnum('claim_status', [
  'draft',           // Utkast
  'new',             // Ny
  'in_progress',     // Under behandling
  'pending_supplier', // Venter leverandørsvar
  'resolved',        // Løst
  'closed',          // Lukket
]);

export const claimPriorityEnum = pgEnum('claim_priority', [
  'low',
  'medium',
  'high',
  'urgent',
]);

export const claimCategoryEnum = pgEnum('claim_category', [
  'warranty',        // Garantireklamasjon
  'service',         // Servicereklamasjon
  'transport',       // Transportskade
  'installation',    // Monteringsfeil
  'other',           // Annet
]);

export const defectCategoryEnum = pgEnum('defect_category', [
  'function_error',     // Funksjonsfeil
  'transport_damage',   // Transportskade
  'production_defect',  // Produksjonsfeil
  'wear',               // Slitasje
  'installation_error', // Monteringsfeil
  'missing_parts',      // Manglende deler
  'cosmetic',           // Kosmetisk skade
  'other',              // Annet
]);

export const warrantyStatusEnum = pgEnum('warranty_status', [
  'in_warranty',
  'out_of_warranty',
  'unknown',
]);

export const claimPartStatusEnum = pgEnum('claim_part_status', [
  'requested',
  'approved',
  'rejected',
  'ordered',
  'shipped',
  'received',
]);
```

---

## packages/db/src/schema/claims/claims.ts

```typescript
import { pgTable, uuid, varchar, text, boolean, decimal, timestamp, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { baseFields } from '../common';
import { claimStatusEnum, claimPriorityEnum, claimCategoryEnum, defectCategoryEnum, warrantyStatusEnum } from './enums';
import { suppliers, products, customers } from '../crm';
import { users } from '../auth';

export const claims = pgTable('claims', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // ============ IDENTIFIKASJON ============
  claimNumber: varchar('claim_number', { length: 20 }).notNull().unique(),
  // Format: "ELE-2412-0001" (leverandør-YYMM-løpenr)
  
  // ============ RELASJONER ============
  customerId: uuid('customer_id').references(() => customers.id),
  productId: uuid('product_id').references(() => products.id),
  supplierId: uuid('supplier_id').references(() => suppliers.id).notNull(),
  assignedUserId: uuid('assigned_user_id').references(() => users.id),
  createdById: uuid('created_by_id').references(() => users.id).notNull(),
  
  // ============ STATUS ============
  status: claimStatusEnum('status').default('draft').notNull(),
  priority: claimPriorityEnum('priority').default('medium').notNull(),
  category: claimCategoryEnum('category'),
  defectCategory: defectCategoryEnum('defect_category'),
  warrantyStatus: warrantyStatusEnum('warranty_status').default('unknown'),
  
  // ============ DATOER ============
  purchaseDate: timestamp('purchase_date', { withTimezone: true }),
  installationDate: timestamp('installation_date', { withTimezone: true }),
  reportedDate: timestamp('reported_date', { withTimezone: true }),
  warrantyExpires: timestamp('warranty_expires', { withTimezone: true }),
  
  // ============ PRODUKTINFO ============
  productCode: varchar('product_code', { length: 100 }),
  productNameText: varchar('product_name_text', { length: 255 }),
  serialNumber: varchar('serial_number', { length: 100 }),
  batchNumber: varchar('batch_number', { length: 100 }),
  
  // ============ REFERANSER ============
  referenceNumber: varchar('reference_number', { length: 100 }),
  orderReferenceNumber: varchar('order_reference_number', { length: 100 }),
  invoiceNumber: varchar('invoice_number', { length: 100 }),
  invoiceDate: timestamp('invoice_date', { withTimezone: true }),
  
  // ============ KUNDEINFO (denormalisert) ============
  customerContactName: varchar('customer_contact_name', { length: 255 }),
  customerContactPhone: varchar('customer_contact_phone', { length: 50 }),
  customerContactEmail: varchar('customer_contact_email', { length: 255 }),
  customerCompanyName: varchar('customer_company_name', { length: 255 }),
  installationAddress: text('installation_address'),
  
  // ============ LEVERANDØR ============
  supplierNameText: varchar('supplier_name_text', { length: 255 }),
  supplierVerificationCode: varchar('supplier_verification_code', { length: 10 }),
  // 6-tegn kode for leverandørportal URL
  
  // ============ BESKRIVELSER ============
  problemDescription: text('problem_description'),
  diagnosisDescription: text('diagnosis_description'),
  partsDescription: text('parts_description'),
  internalNotes: text('internal_notes'),
  
  // ============ KOSTNADER ============
  estimatedPartsCost: decimal('estimated_parts_cost', { precision: 12, scale: 2 }),
  estimatedLaborCost: decimal('estimated_labor_cost', { precision: 12, scale: 2 }),
  estimatedLaborHours: decimal('estimated_labor_hours', { precision: 6, scale: 2 }),
  
  // ============ LEVERANDØRSVAR ============
  supplierResponse: text('supplier_response'),
  supplierResponseType: varchar('supplier_response_type', { length: 50 }),
  supplierCreditNote: varchar('supplier_credit_note', { length: 100 }),
  supplierResolutionDate: timestamp('supplier_resolution_date', { withTimezone: true }),
  supplierCompensationOffer: decimal('supplier_compensation_offer', { precision: 12, scale: 2 }),
  
  ...baseFields,
}, (table) => ({
  claimNumberIdx: index('idx_claims_claim_number').on(table.claimNumber),
  statusIdx: index('idx_claims_status').on(table.status),
  supplierIdx: index('idx_claims_supplier').on(table.supplierId),
  customerIdx: index('idx_claims_customer').on(table.customerId),
  assignedIdx: index('idx_claims_assigned').on(table.assignedUserId),
  createdAtIdx: index('idx_claims_created_at').on(table.createdAt),
  priorityIdx: index('idx_claims_priority').on(table.priority),
  verificationCodeIdx: index('idx_claims_verification_code').on(table.supplierVerificationCode),
}));

export const claimsRelations = relations(claims, ({ one, many }) => ({
  customer: one(customers, {
    fields: [claims.customerId],
    references: [customers.id],
  }),
  product: one(products, {
    fields: [claims.productId],
    references: [products.id],
  }),
  supplier: one(suppliers, {
    fields: [claims.supplierId],
    references: [suppliers.id],
  }),
  assignedUser: one(users, {
    fields: [claims.assignedUserId],
    references: [users.id],
    relationName: 'assignedClaims',
  }),
  createdBy: one(users, {
    fields: [claims.createdById],
    references: [users.id],
    relationName: 'createdClaims',
  }),
  parts: many(claimParts),
  attachments: many(claimAttachments),
  timeline: many(claimTimeline),
}));

import { claimParts } from './claim-parts';
import { claimAttachments } from './claim-attachments';
import { claimTimeline } from './claim-timeline';
```

---

## packages/db/src/schema/claims/claim-parts.ts

```typescript
import { pgTable, uuid, varchar, text, boolean, integer, decimal, timestamp, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { baseFields } from '../common';
import { claimPartStatusEnum } from './enums';
import { claims } from './claims';

export const claimParts = pgTable('claim_parts', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  claimId: uuid('claim_id').references(() => claims.id).notNull(),
  
  // Delinfo
  partNumber: varchar('part_number', { length: 100 }),
  partName: varchar('part_name', { length: 255 }).notNull(),
  supplierPartNumber: varchar('supplier_part_number', { length: 100 }),
  
  // Mengde & Pris
  quantity: integer('quantity').default(1).notNull(),
  unitPrice: decimal('unit_price', { precision: 12, scale: 2 }),
  totalPrice: decimal('total_price', { precision: 12, scale: 2 }),
  
  // Status
  status: claimPartStatusEnum('status').default('requested').notNull(),
  isWarranty: boolean('is_warranty').default(true),
  
  // Datoer
  orderedAt: timestamp('ordered_at', { withTimezone: true }),
  receivedAt: timestamp('received_at', { withTimezone: true }),
  
  notes: text('notes'),
  
  ...baseFields,
}, (table) => ({
  claimIdx: index('idx_claim_parts_claim').on(table.claimId),
  statusIdx: index('idx_claim_parts_status').on(table.status),
}));

export const claimPartsRelations = relations(claimParts, ({ one }) => ({
  claim: one(claims, {
    fields: [claimParts.claimId],
    references: [claims.id],
  }),
}));
```

---

## packages/db/src/schema/claims/claim-attachments.ts

```typescript
import { pgTable, uuid, varchar, text, integer, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { baseFields } from '../common';
import { claims } from './claims';
import { users } from '../auth';

export const claimAttachments = pgTable('claim_attachments', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  claimId: uuid('claim_id').references(() => claims.id).notNull(),
  uploadedById: uuid('uploaded_by_id').references(() => users.id),
  
  // Filinfo
  fileName: varchar('file_name', { length: 255 }).notNull(),
  fileType: varchar('file_type', { length: 100 }),
  fileSize: integer('file_size'), // bytes
  mimeType: varchar('mime_type', { length: 100 }),
  
  // URLs
  fileUrl: varchar('file_url', { length: 500 }).notNull(),
  thumbnailUrl: varchar('thumbnail_url', { length: 500 }),
  
  // Metadata
  description: text('description'),
  category: varchar('category', { length: 50 }), // photo, document, invoice
  
  ...baseFields,
}, (table) => ({
  claimIdx: index('idx_claim_attachments_claim').on(table.claimId),
  categoryIdx: index('idx_claim_attachments_category').on(table.category),
}));

export const claimAttachmentsRelations = relations(claimAttachments, ({ one }) => ({
  claim: one(claims, {
    fields: [claimAttachments.claimId],
    references: [claims.id],
  }),
  uploadedBy: one(users, {
    fields: [claimAttachments.uploadedById],
    references: [users.id],
  }),
}));
```

---

## packages/db/src/schema/claims/claim-timeline.ts

```typescript
import { pgTable, uuid, varchar, text, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { claims } from './claims';
import { users } from '../auth';

export const claimTimeline = pgTable('claim_timeline', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  claimId: uuid('claim_id').references(() => claims.id).notNull(),
  createdById: uuid('created_by_id').references(() => users.id),
  
  // Hendelse
  eventType: varchar('event_type', { length: 50 }).notNull(),
  // created, status_changed, assigned, comment, attachment_added,
  // supplier_response, part_added, closed, portal_viewed, etc.
  
  description: text('description'),
  
  // For status-endringer etc
  oldValue: jsonb('old_value').$type<Record<string, unknown>>(),
  newValue: jsonb('new_value').$type<Record<string, unknown>>(),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  claimIdx: index('idx_claim_timeline_claim').on(table.claimId),
  createdAtIdx: index('idx_claim_timeline_created_at').on(table.createdAt),
  eventTypeIdx: index('idx_claim_timeline_event').on(table.eventType),
}));

export const claimTimelineRelations = relations(claimTimeline, ({ one }) => ({
  claim: one(claims, {
    fields: [claimTimeline.claimId],
    references: [claims.id],
  }),
  createdBy: one(users, {
    fields: [claimTimeline.createdById],
    references: [users.id],
  }),
}));
```

---

## packages/db/src/schema/claims/index.ts

```typescript
export * from './enums';
export * from './claims';
export * from './claim-parts';
export * from './claim-attachments';
export * from './claim-timeline';
```

---

## packages/shared/src/schemas/claims.schema.ts

```typescript
import { z } from 'zod';
import { paginationInput } from './common.schema';

// Status enums
export const CLAIM_STATUS = {
  DRAFT: 'draft',
  NEW: 'new',
  IN_PROGRESS: 'in_progress',
  PENDING_SUPPLIER: 'pending_supplier',
  RESOLVED: 'resolved',
  CLOSED: 'closed',
} as const;

export const CLAIM_PRIORITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  URGENT: 'urgent',
} as const;

export const DEFECT_CATEGORY = {
  FUNCTION_ERROR: 'function_error',
  TRANSPORT_DAMAGE: 'transport_damage',
  PRODUCTION_DEFECT: 'production_defect',
  WEAR: 'wear',
  INSTALLATION_ERROR: 'installation_error',
  MISSING_PARTS: 'missing_parts',
  COSMETIC: 'cosmetic',
  OTHER: 'other',
} as const;

// Norske labels
export const CLAIM_STATUS_LABELS: Record<string, string> = {
  draft: 'Utkast',
  new: 'Ny',
  in_progress: 'Under behandling',
  pending_supplier: 'Venter leverandør',
  resolved: 'Løst',
  closed: 'Lukket',
};

export const CLAIM_PRIORITY_LABELS: Record<string, string> = {
  low: 'Lav',
  medium: 'Medium',
  high: 'Høy',
  urgent: 'Haster',
};

export const DEFECT_CATEGORY_LABELS: Record<string, string> = {
  function_error: 'Funksjonsfeil',
  transport_damage: 'Transportskade',
  production_defect: 'Produksjonsfeil',
  wear: 'Slitasje',
  installation_error: 'Monteringsfeil',
  missing_parts: 'Manglende deler',
  cosmetic: 'Kosmetisk skade',
  other: 'Annet',
};

// Zod schemas
export const claimStatusEnum = z.enum(['draft', 'new', 'in_progress', 'pending_supplier', 'resolved', 'closed']);
export const claimPriorityEnum = z.enum(['low', 'medium', 'high', 'urgent']);
export const defectCategoryEnum = z.enum(['function_error', 'transport_damage', 'production_defect', 'wear', 'installation_error', 'missing_parts', 'cosmetic', 'other']);

export const claimOutput = z.object({
  id: z.string().uuid(),
  claimNumber: z.string(),
  status: claimStatusEnum,
  priority: claimPriorityEnum,
  defectCategory: defectCategoryEnum.nullable(),
  supplierId: z.string().uuid(),
  supplierNameText: z.string().nullable(),
  customerId: z.string().uuid().nullable(),
  productNameText: z.string().nullable(),
  problemDescription: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const claimListInput = paginationInput.extend({
  search: z.string().optional(),
  status: claimStatusEnum.optional(),
  priority: claimPriorityEnum.optional(),
  supplierId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  assignedUserId: z.string().uuid().optional(),
});

export const createClaimInput = z.object({
  supplierId: z.string().uuid({ message: 'Velg leverandør' }),
  customerId: z.string().uuid().optional(),
  productId: z.string().uuid().optional(),
  productCode: z.string().optional(),
  productNameText: z.string().optional(),
  serialNumber: z.string().optional(),
  problemDescription: z.string().min(10, 'Beskriv problemet (minst 10 tegn)'),
  defectCategory: defectCategoryEnum,
  priority: claimPriorityEnum.default('medium'),
  purchaseDate: z.string().datetime().optional(),
  installationDate: z.string().datetime().optional(),
  // Kundeinfo
  customerContactName: z.string().optional(),
  customerContactPhone: z.string().optional(),
  customerContactEmail: z.string().email().optional(),
  installationAddress: z.string().optional(),
});

export const updateClaimInput = z.object({
  id: z.string().uuid(),
  status: claimStatusEnum.optional(),
  priority: claimPriorityEnum.optional(),
  assignedUserId: z.string().uuid().nullable().optional(),
  problemDescription: z.string().optional(),
  diagnosisDescription: z.string().optional(),
  internalNotes: z.string().optional(),
});

// Claim parts
export const claimPartOutput = z.object({
  id: z.string().uuid(),
  claimId: z.string().uuid(),
  partNumber: z.string().nullable(),
  partName: z.string(),
  quantity: z.number(),
  unitPrice: z.number().nullable(),
  status: z.string(),
  isWarranty: z.boolean(),
});

export const addClaimPartInput = z.object({
  claimId: z.string().uuid(),
  partNumber: z.string().optional(),
  partName: z.string().min(1, 'Delnavn er påkrevd'),
  quantity: z.number().min(1).default(1),
  unitPrice: z.number().min(0).optional(),
  isWarranty: z.boolean().default(true),
});

// Timeline
export const claimTimelineOutput = z.object({
  id: z.string().uuid(),
  claimId: z.string().uuid(),
  eventType: z.string(),
  description: z.string().nullable(),
  createdAt: z.date(),
  createdBy: z.object({
    id: z.string().uuid(),
    firstName: z.string().nullable(),
    lastName: z.string().nullable(),
  }).nullable(),
});

// Types
export type ClaimStatus = z.infer<typeof claimStatusEnum>;
export type ClaimPriority = z.infer<typeof claimPriorityEnum>;
export type DefectCategory = z.infer<typeof defectCategoryEnum>;
export type ClaimOutput = z.infer<typeof claimOutput>;
export type ClaimListInput = z.infer<typeof claimListInput>;
export type CreateClaimInput = z.infer<typeof createClaimInput>;
export type UpdateClaimInput = z.infer<typeof updateClaimInput>;
```

---

## Oppdater schema index

```typescript
// packages/db/src/schema/index.ts
export * from './common';
export * from './auth';
export * from './organization';
export * from './crm';
export * from './claims';  // <-- Legg til
```

---

## Oppdater shared schemas index

```typescript
// packages/shared/src/schemas/index.ts
export * from './common.schema';
export * from './auth.schema';
export * from './crm.schema';
export * from './claims.schema';  // <-- Legg til
```

---

## Test

```bash
cd packages/db
pnpm db:generate
```

---

## Sjekkliste

- [ ] enums.ts med alle status-typer
- [ ] claims.ts ~120 linjer, 56 felt
- [ ] claim-parts.ts ~60 linjer
- [ ] claim-attachments.ts ~50 linjer
- [ ] claim-timeline.ts ~50 linjer
- [ ] Alle har ...baseFields (unntatt timeline)
- [ ] claims.schema.ts med Zod og norske labels
- [ ] `pnpm db:generate` OK

---

## Neste fase

Gå til **FASE 4: Service Core** for vedlikeholdsavtaler og servicepartnere.
