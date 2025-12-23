# FASE 6: Installations & Transport Damages

> Fase 1-5 må være fullført.
> Estimert tid: ~30 minutter.

## Mål

Opprett tabeller for monteringsprosjekter og transportskader.

---

## Mappestruktur

```
packages/db/src/schema/installations/
├── index.ts
├── enums.ts
├── installations.ts        # ~90 linjer
└── transport-damages.ts    # ~80 linjer
```

---

## packages/db/src/schema/installations/enums.ts

```typescript
import { pgEnum } from 'drizzle-orm/pg-core';

export const installationStatusEnum = pgEnum('installation_status', [
  'planned',       // Planlagt
  'confirmed',     // Bekreftet
  'in_progress',   // Pågår
  'completed',     // Fullført
  'on_hold',       // På vent
  'cancelled',     // Kansellert
]);

export const installationPriorityEnum = pgEnum('installation_priority', [
  'low',
  'normal',
  'high',
  'urgent',
]);

export const installationTypeEnum = pgEnum('installation_type', [
  'new_installation',    // Nyinstallasjon
  'replacement',         // Utskifting
  'relocation',          // Flytting
  'expansion',           // Utvidelse
]);

export const transportDamageTypeEnum = pgEnum('transport_damage_type', [
  'collision',     // Kollisjon
  'scratch',       // Ripe
  'dent',          // Bulk
  'water',         // Vannskade
  'missing_parts', // Manglende deler
  'other',         // Annet
]);

export const transportDamageSeverityEnum = pgEnum('transport_damage_severity', [
  'minor',    // Liten
  'medium',   // Middels
  'major',    // Stor
  'critical', // Kritisk
]);

export const transportDamageStatusEnum = pgEnum('transport_damage_status', [
  'reported',      // Rapportert
  'under_review',  // Under vurdering
  'confirmed',     // Bekreftet
  'rejected',      // Avvist
  'resolved',      // Løst
]);
```

---

## packages/db/src/schema/installations/installations.ts

```typescript
import { pgTable, uuid, varchar, text, decimal, timestamp, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { baseFields } from '../common';
import { installationStatusEnum, installationPriorityEnum, installationTypeEnum } from './enums';
import { customers } from '../crm';
import { users } from '../auth';

export const installations = pgTable('installations', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Identifikasjon
  installationNumber: varchar('installation_number', { length: 50 }).notNull().unique(),
  projectName: varchar('project_name', { length: 255 }),
  
  // Relasjoner
  customerId: uuid('customer_id').references(() => customers.id),
  leadInstallerId: uuid('lead_installer_id').references(() => users.id),
  projectManagerId: uuid('project_manager_id').references(() => users.id),
  createdById: uuid('created_by_id').references(() => users.id),
  
  // Status
  status: installationStatusEnum('status').default('planned').notNull(),
  priority: installationPriorityEnum('priority').default('normal'),
  installationType: installationTypeEnum('installation_type'),
  projectType: varchar('project_type', { length: 100 }),
  
  // Kundeinfo (denormalisert)
  customerName: varchar('customer_name', { length: 255 }),
  customerNumber: varchar('customer_number', { length: 50 }),
  contactPerson: varchar('contact_person', { length: 255 }),
  contactPhone: varchar('contact_phone', { length: 50 }),
  contactEmail: varchar('contact_email', { length: 255 }),
  
  // Leveringsadresse
  deliveryAddress: text('delivery_address'),
  postalCode: varchar('postal_code', { length: 10 }),
  city: varchar('city', { length: 100 }),
  
  // Planlegging
  plannedStartDate: timestamp('planned_start_date', { withTimezone: true }),
  plannedEndDate: timestamp('planned_end_date', { withTimezone: true }),
  actualStartDate: timestamp('actual_start_date', { withTimezone: true }),
  actualEndDate: timestamp('actual_end_date', { withTimezone: true }),
  
  // Estimater
  estimatedHours: decimal('estimated_hours', { precision: 8, scale: 2 }),
  actualHours: decimal('actual_hours', { precision: 8, scale: 2 }),
  estimatedCost: decimal('estimated_cost', { precision: 12, scale: 2 }),
  actualCost: decimal('actual_cost', { precision: 12, scale: 2 }),
  
  // Ordre
  orderNumber: varchar('order_number', { length: 100 }),
  orderValue: decimal('order_value', { precision: 12, scale: 2 }),
  invoiceNumber: varchar('invoice_number', { length: 100 }),
  
  // Notater
  notes: text('notes'),
  internalNotes: text('internal_notes'),
  
  // Signatur
  customerSignature: text('customer_signature'), // Base64
  signedAt: timestamp('signed_at', { withTimezone: true }),
  
  ...baseFields,
}, (table) => ({
  installationNumberIdx: index('idx_installations_number').on(table.installationNumber),
  customerIdx: index('idx_installations_customer').on(table.customerId),
  statusIdx: index('idx_installations_status').on(table.status),
  plannedStartIdx: index('idx_installations_planned_start').on(table.plannedStartDate),
  leadInstallerIdx: index('idx_installations_lead').on(table.leadInstallerId),
}));

export const installationsRelations = relations(installations, ({ one, many }) => ({
  customer: one(customers, {
    fields: [installations.customerId],
    references: [customers.id],
  }),
  leadInstaller: one(users, {
    fields: [installations.leadInstallerId],
    references: [users.id],
    relationName: 'leadInstallerInstallations',
  }),
  projectManager: one(users, {
    fields: [installations.projectManagerId],
    references: [users.id],
    relationName: 'projectManagerInstallations',
  }),
  createdBy: one(users, {
    fields: [installations.createdById],
    references: [users.id],
    relationName: 'createdInstallations',
  }),
  transportDamages: many(transportDamages),
}));

import { transportDamages } from './transport-damages';
```

---

## packages/db/src/schema/installations/transport-damages.ts

```typescript
import { pgTable, uuid, varchar, text, decimal, boolean, timestamp, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { baseFields } from '../common';
import { transportDamageTypeEnum, transportDamageSeverityEnum, transportDamageStatusEnum } from './enums';
import { customers, suppliers, products } from '../crm';
import { users } from '../auth';
import { installations } from './installations';

export const transportDamages = pgTable('transport_damages', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Identifikasjon
  damageNumber: varchar('damage_number', { length: 50 }).notNull().unique(),
  
  // Relasjoner
  reportedById: uuid('reported_by_id').references(() => users.id).notNull(),
  customerId: uuid('customer_id').references(() => customers.id),
  supplierId: uuid('supplier_id').references(() => suppliers.id),
  productId: uuid('product_id').references(() => products.id),
  installationId: uuid('installation_id').references(() => installations.id),
  assignedToId: uuid('assigned_to_id').references(() => users.id),
  resolvedById: uuid('resolved_by_id').references(() => users.id),
  
  // Skadeinfo
  damageType: transportDamageTypeEnum('damage_type').notNull(),
  severity: transportDamageSeverityEnum('severity').default('medium').notNull(),
  description: text('description').notNull(),
  
  // Transport
  carrier: varchar('carrier', { length: 255 }),        // Transportør
  waybillNumber: varchar('waybill_number', { length: 100 }), // Fraktbrev
  trackingNumber: varchar('tracking_number', { length: 100 }),
  loadReference: varchar('load_reference', { length: 100 }),
  driverName: varchar('driver_name', { length: 255 }),
  
  // Ordre
  orderId: varchar('order_id', { length: 100 }),
  deliveryNumber: varchar('delivery_number', { length: 100 }),
  
  // Lokasjon
  location: varchar('location', { length: 255 }),
  address: text('address'),
  latitude: decimal('latitude', { precision: 10, scale: 7 }),
  longitude: decimal('longitude', { precision: 10, scale: 7 }),
  
  // Status
  status: transportDamageStatusEnum('status').default('reported').notNull(),
  resolution: text('resolution'),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  
  // Økonomi
  estimatedCost: decimal('estimated_cost', { precision: 12, scale: 2 }),
  actualCost: decimal('actual_cost', { precision: 12, scale: 2 }),
  insuranceClaim: boolean('insurance_claim').default(false),
  insuranceClaimNumber: varchar('insurance_claim_number', { length: 100 }),
  
  // Dato
  reportedAt: timestamp('reported_at', { withTimezone: true }).defaultNow(),
  
  ...baseFields,
}, (table) => ({
  damageNumberIdx: index('idx_transport_damages_number').on(table.damageNumber),
  statusIdx: index('idx_transport_damages_status').on(table.status),
  reportedByIdx: index('idx_transport_damages_reported_by').on(table.reportedById),
  installationIdx: index('idx_transport_damages_installation').on(table.installationId),
  carrierIdx: index('idx_transport_damages_carrier').on(table.carrier),
}));

export const transportDamagesRelations = relations(transportDamages, ({ one }) => ({
  reportedBy: one(users, {
    fields: [transportDamages.reportedById],
    references: [users.id],
    relationName: 'reportedDamages',
  }),
  customer: one(customers, {
    fields: [transportDamages.customerId],
    references: [customers.id],
  }),
  supplier: one(suppliers, {
    fields: [transportDamages.supplierId],
    references: [suppliers.id],
  }),
  product: one(products, {
    fields: [transportDamages.productId],
    references: [products.id],
  }),
  installation: one(installations, {
    fields: [transportDamages.installationId],
    references: [installations.id],
  }),
  assignedTo: one(users, {
    fields: [transportDamages.assignedToId],
    references: [users.id],
    relationName: 'assignedDamages',
  }),
  resolvedBy: one(users, {
    fields: [transportDamages.resolvedById],
    references: [users.id],
    relationName: 'resolvedDamages',
  }),
}));
```

---

## packages/db/src/schema/installations/index.ts

```typescript
export * from './enums';
export * from './installations';
export * from './transport-damages';
```

---

## packages/shared/src/schemas/installations.schema.ts

```typescript
import { z } from 'zod';
import { paginationInput } from './common.schema';

// Status enums
export const INSTALLATION_STATUS = {
  PLANNED: 'planned',
  CONFIRMED: 'confirmed',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  ON_HOLD: 'on_hold',
  CANCELLED: 'cancelled',
} as const;

export const TRANSPORT_DAMAGE_STATUS = {
  REPORTED: 'reported',
  UNDER_REVIEW: 'under_review',
  CONFIRMED: 'confirmed',
  REJECTED: 'rejected',
  RESOLVED: 'resolved',
} as const;

export const TRANSPORT_DAMAGE_SEVERITY = {
  MINOR: 'minor',
  MEDIUM: 'medium',
  MAJOR: 'major',
  CRITICAL: 'critical',
} as const;

// Norske labels
export const INSTALLATION_STATUS_LABELS: Record<string, string> = {
  planned: 'Planlagt',
  confirmed: 'Bekreftet',
  in_progress: 'Pågår',
  completed: 'Fullført',
  on_hold: 'På vent',
  cancelled: 'Kansellert',
};

export const TRANSPORT_DAMAGE_STATUS_LABELS: Record<string, string> = {
  reported: 'Rapportert',
  under_review: 'Under vurdering',
  confirmed: 'Bekreftet',
  rejected: 'Avvist',
  resolved: 'Løst',
};

export const TRANSPORT_DAMAGE_SEVERITY_LABELS: Record<string, string> = {
  minor: 'Liten',
  medium: 'Middels',
  major: 'Stor',
  critical: 'Kritisk',
};

// Zod schemas
export const installationStatusEnum = z.enum(['planned', 'confirmed', 'in_progress', 'completed', 'on_hold', 'cancelled']);
export const transportDamageStatusEnum = z.enum(['reported', 'under_review', 'confirmed', 'rejected', 'resolved']);
export const transportDamageSeverityEnum = z.enum(['minor', 'medium', 'major', 'critical']);
export const transportDamageTypeEnum = z.enum(['collision', 'scratch', 'dent', 'water', 'missing_parts', 'other']);

// Installation
export const installationOutput = z.object({
  id: z.string().uuid(),
  installationNumber: z.string(),
  projectName: z.string().nullable(),
  status: installationStatusEnum,
  customerName: z.string().nullable(),
  city: z.string().nullable(),
  plannedStartDate: z.date().nullable(),
  plannedEndDate: z.date().nullable(),
  estimatedHours: z.number().nullable(),
  leadInstaller: z.object({
    id: z.string().uuid(),
    firstName: z.string().nullable(),
    lastName: z.string().nullable(),
  }).nullable(),
});

export const installationListInput = paginationInput.extend({
  search: z.string().optional(),
  status: installationStatusEnum.optional(),
  leadInstallerId: z.string().uuid().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
});

export const createInstallationInput = z.object({
  projectName: z.string().min(1, 'Prosjektnavn er påkrevd'),
  customerId: z.string().uuid().optional(),
  customerName: z.string().optional(),
  leadInstallerId: z.string().uuid().optional(),
  projectManagerId: z.string().uuid().optional(),
  installationType: z.enum(['new_installation', 'replacement', 'relocation', 'expansion']).optional(),
  deliveryAddress: z.string().optional(),
  postalCode: z.string().optional(),
  city: z.string().optional(),
  contactPerson: z.string().optional(),
  contactPhone: z.string().optional(),
  plannedStartDate: z.string().datetime(),
  plannedEndDate: z.string().datetime().optional(),
  estimatedHours: z.number().min(0).optional(),
  orderNumber: z.string().optional(),
});

// Transport Damage
export const transportDamageOutput = z.object({
  id: z.string().uuid(),
  damageNumber: z.string(),
  damageType: transportDamageTypeEnum,
  severity: transportDamageSeverityEnum,
  status: transportDamageStatusEnum,
  description: z.string(),
  carrier: z.string().nullable(),
  estimatedCost: z.number().nullable(),
  reportedAt: z.date(),
  reportedBy: z.object({
    id: z.string().uuid(),
    firstName: z.string().nullable(),
    lastName: z.string().nullable(),
  }),
});

export const transportDamageListInput = paginationInput.extend({
  status: transportDamageStatusEnum.optional(),
  severity: transportDamageSeverityEnum.optional(),
  installationId: z.string().uuid().optional(),
  carrier: z.string().optional(),
});

export const createTransportDamageInput = z.object({
  installationId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  supplierId: z.string().uuid().optional(),
  productId: z.string().uuid().optional(),
  damageType: transportDamageTypeEnum,
  severity: transportDamageSeverityEnum.default('medium'),
  description: z.string().min(10, 'Beskriv skaden (minst 10 tegn)'),
  carrier: z.string().optional(),
  waybillNumber: z.string().optional(),
  trackingNumber: z.string().optional(),
  location: z.string().optional(),
  estimatedCost: z.number().min(0).optional(),
});

// Types
export type InstallationStatus = z.infer<typeof installationStatusEnum>;
export type TransportDamageStatus = z.infer<typeof transportDamageStatusEnum>;
export type InstallationOutput = z.infer<typeof installationOutput>;
export type TransportDamageOutput = z.infer<typeof transportDamageOutput>;
```

---

## Oppdater indexes

```typescript
// packages/db/src/schema/index.ts
export * from './installations';  // <-- Legg til

// packages/shared/src/schemas/index.ts
export * from './installations.schema';  // <-- Legg til
```

---

## Sjekkliste

- [ ] enums.ts med installation/damage enums
- [ ] installations.ts ~90 linjer
- [ ] transport-damages.ts ~80 linjer
- [ ] Geo-koordinater med riktig presisjon
- [ ] installations.schema.ts med Zod og norske labels
- [ ] `pnpm db:generate` OK

---

## Neste fase

Gå til **FASE 7: Communication** for diskusjons-saker.
