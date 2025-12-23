# FASE 5: Service Visits (Planlagte & Utførte Besøk)

> Fase 1-4 må være fullført.
> Estimert tid: ~30 minutter.

## Mål

Opprett tabeller for planlegging og gjennomføring av servicebesøk.

---

## Nye filer

```
packages/db/src/schema/service/
├── ... (eksisterende)
├── planned-visits.ts     # Planlagte besøk (~80 linjer)
└── service-visits.ts     # Utførte besøk (~90 linjer)
```

---

## Legg til i service/enums.ts

```typescript
// Legg til disse i eksisterende enums.ts:

export const plannedVisitStatusEnum = pgEnum('planned_visit_status', [
  'planned',     // Planlagt
  'confirmed',   // Bekreftet med kunde
  'in_progress', // Pågår
  'completed',   // Fullført
  'cancelled',   // Kansellert
  'rescheduled', // Flyttet
]);

export const serviceVisitStatusEnum = pgEnum('service_visit_status', [
  'draft',       // Under utfylling
  'completed',   // Ferdig
  'approved',    // Godkjent av leder
  'invoiced',    // Fakturert
]);
```

---

## packages/db/src/schema/service/planned-visits.ts

```typescript
import { pgTable, uuid, varchar, text, timestamp, time, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { baseFields } from '../common';
import { plannedVisitStatusEnum } from './enums';
import { customers } from '../crm';
import { users } from '../auth';
import { maintenanceAgreements } from './maintenance-agreements';
import { storkjokkenAgreements } from './storkjokken-agreements';

export const plannedVisits = pgTable('planned_visits', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Identifikasjon
  visitNumber: varchar('visit_number', { length: 50 }).notNull().unique(),
  
  // Relasjoner
  customerId: uuid('customer_id').references(() => customers.id),
  maintenanceAgreementId: uuid('maintenance_agreement_id').references(() => maintenanceAgreements.id),
  storkjokkenAgreementId: uuid('storkjokken_agreement_id').references(() => storkjokkenAgreements.id),
  technicianId: uuid('technician_id').references(() => users.id),
  createdById: uuid('created_by_id').references(() => users.id),
  
  // Status
  status: plannedVisitStatusEnum('status').default('planned').notNull(),
  
  // Planlagt tidspunkt
  scheduledDate: timestamp('scheduled_date', { withTimezone: true }).notNull(),
  scheduledTime: time('scheduled_time'),
  estimatedDuration: varchar('estimated_duration', { length: 20 }), // "2t", "4t"
  
  // Adresse (kan avvike fra avtale)
  visitAddress: text('visit_address'),
  visitPostcode: varchar('visit_postcode', { length: 10 }),
  visitCity: varchar('visit_city', { length: 100 }),
  
  // Kontakt
  contactPerson: varchar('contact_person', { length: 255 }),
  contactPhone: varchar('contact_phone', { length: 50 }),
  
  // Beskrivelse
  description: text('description'),
  internalNotes: text('internal_notes'),
  
  // Ved kansellering/flytting
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  cancelReason: text('cancel_reason'),
  rescheduledTo: uuid('rescheduled_to'), // FK til ny planned_visit
  
  ...baseFields,
}, (table) => ({
  visitNumberIdx: index('idx_planned_visits_number').on(table.visitNumber),
  technicianIdx: index('idx_planned_visits_technician').on(table.technicianId),
  scheduledDateIdx: index('idx_planned_visits_scheduled').on(table.scheduledDate),
  statusIdx: index('idx_planned_visits_status').on(table.status),
  customerIdx: index('idx_planned_visits_customer').on(table.customerId),
}));

export const plannedVisitsRelations = relations(plannedVisits, ({ one }) => ({
  customer: one(customers, {
    fields: [plannedVisits.customerId],
    references: [customers.id],
  }),
  maintenanceAgreement: one(maintenanceAgreements, {
    fields: [plannedVisits.maintenanceAgreementId],
    references: [maintenanceAgreements.id],
  }),
  storkjokkenAgreement: one(storkjokkenAgreements, {
    fields: [plannedVisits.storkjokkenAgreementId],
    references: [storkjokkenAgreements.id],
  }),
  technician: one(users, {
    fields: [plannedVisits.technicianId],
    references: [users.id],
    relationName: 'technicianVisits',
  }),
  createdBy: one(users, {
    fields: [plannedVisits.createdById],
    references: [users.id],
    relationName: 'createdVisits',
  }),
}));
```

---

## packages/db/src/schema/service/service-visits.ts

```typescript
import { pgTable, uuid, varchar, text, decimal, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { baseFields } from '../common';
import { serviceVisitStatusEnum } from './enums';
import { users } from '../auth';
import { plannedVisits } from './planned-visits';

export const serviceVisits = pgTable('service_visits', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Kobling til planlagt besøk
  plannedVisitId: uuid('planned_visit_id').references(() => plannedVisits.id),
  technicianId: uuid('technician_id').references(() => users.id).notNull(),
  
  // Status
  status: serviceVisitStatusEnum('status').default('draft').notNull(),
  
  // Tidspunkt
  startTime: timestamp('start_time', { withTimezone: true }),
  endTime: timestamp('end_time', { withTimezone: true }),
  
  // Reise
  travelKm: decimal('travel_km', { precision: 8, scale: 2 }),
  travelTime: varchar('travel_time', { length: 20 }), // "1t 30min"
  
  // Arbeid
  workDescription: text('work_description'),
  workPerformed: text('work_performed'),
  
  // Utstyr sjekket (JSON)
  equipmentChecked: jsonb('equipment_checked').$type<Array<{
    name: string;
    serialNumber?: string;
    status: 'ok' | 'needs_repair' | 'replaced';
    notes?: string;
  }>>(),
  
  // Deler brukt (JSON)
  partsUsed: jsonb('parts_used').$type<Array<{
    partNumber: string;
    partName: string;
    quantity: number;
    isWarranty: boolean;
  }>>(),
  
  // Bilder (JSON)
  photos: jsonb('photos').$type<Array<{
    url: string;
    description?: string;
    uploadedAt: string;
  }>>(),
  
  // Signaturer
  technicianSignature: text('technician_signature'), // Base64
  customerSignature: text('customer_signature'),     // Base64
  customerSignedBy: varchar('customer_signed_by', { length: 255 }),
  signedAt: timestamp('signed_at', { withTimezone: true }),
  
  // Notater
  internalNotes: text('internal_notes'),
  customerFeedback: text('customer_feedback'),
  
  // Godkjenning
  approvedById: uuid('approved_by_id').references(() => users.id),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  
  ...baseFields,
}, (table) => ({
  plannedVisitIdx: index('idx_service_visits_planned').on(table.plannedVisitId),
  technicianIdx: index('idx_service_visits_technician').on(table.technicianId),
  statusIdx: index('idx_service_visits_status').on(table.status),
  startTimeIdx: index('idx_service_visits_start').on(table.startTime),
}));

export const serviceVisitsRelations = relations(serviceVisits, ({ one }) => ({
  plannedVisit: one(plannedVisits, {
    fields: [serviceVisits.plannedVisitId],
    references: [plannedVisits.id],
  }),
  technician: one(users, {
    fields: [serviceVisits.technicianId],
    references: [users.id],
    relationName: 'technicianServiceVisits',
  }),
  approvedBy: one(users, {
    fields: [serviceVisits.approvedById],
    references: [users.id],
    relationName: 'approvedServiceVisits',
  }),
}));
```

---

## Oppdater service/index.ts

```typescript
export * from './enums';
export * from './maintenance-agreements';
export * from './storkjokken-agreements';
export * from './service-partners';
export * from './planned-visits';    // <-- Legg til
export * from './service-visits';    // <-- Legg til
```

---

## Legg til i packages/shared/src/schemas/service.schema.ts

```typescript
// ... eksisterende kode ...

// ============ PLANNED VISITS ============

export const PLANNED_VISIT_STATUS = {
  PLANNED: 'planned',
  CONFIRMED: 'confirmed',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  RESCHEDULED: 'rescheduled',
} as const;

export const SERVICE_VISIT_STATUS = {
  DRAFT: 'draft',
  COMPLETED: 'completed',
  APPROVED: 'approved',
  INVOICED: 'invoiced',
} as const;

export const PLANNED_VISIT_STATUS_LABELS: Record<string, string> = {
  planned: 'Planlagt',
  confirmed: 'Bekreftet',
  in_progress: 'Pågår',
  completed: 'Fullført',
  cancelled: 'Kansellert',
  rescheduled: 'Flyttet',
};

export const SERVICE_VISIT_STATUS_LABELS: Record<string, string> = {
  draft: 'Utkast',
  completed: 'Fullført',
  approved: 'Godkjent',
  invoiced: 'Fakturert',
};

export const plannedVisitStatusEnum = z.enum(['planned', 'confirmed', 'in_progress', 'completed', 'cancelled', 'rescheduled']);
export const serviceVisitStatusEnum = z.enum(['draft', 'completed', 'approved', 'invoiced']);

export const plannedVisitOutput = z.object({
  id: z.string().uuid(),
  visitNumber: z.string(),
  status: plannedVisitStatusEnum,
  scheduledDate: z.date(),
  scheduledTime: z.string().nullable(),
  estimatedDuration: z.string().nullable(),
  visitAddress: z.string().nullable(),
  visitCity: z.string().nullable(),
  contactPerson: z.string().nullable(),
  contactPhone: z.string().nullable(),
  technician: z.object({
    id: z.string().uuid(),
    firstName: z.string().nullable(),
    lastName: z.string().nullable(),
  }).nullable(),
  customer: z.object({
    id: z.string().uuid(),
    name: z.string(),
  }).nullable(),
});

export const plannedVisitListInput = paginationInput.extend({
  technicianId: z.string().uuid().optional(),
  status: plannedVisitStatusEnum.optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  customerId: z.string().uuid().optional(),
});

export const createPlannedVisitInput = z.object({
  customerId: z.string().uuid().optional(),
  maintenanceAgreementId: z.string().uuid().optional(),
  storkjokkenAgreementId: z.string().uuid().optional(),
  technicianId: z.string().uuid().optional(),
  scheduledDate: z.string().datetime(),
  scheduledTime: z.string().optional(),
  estimatedDuration: z.string().optional(),
  visitAddress: z.string().optional(),
  visitPostcode: z.string().optional(),
  visitCity: z.string().optional(),
  contactPerson: z.string().optional(),
  contactPhone: z.string().optional(),
  description: z.string().optional(),
});

// Service Visit (rapport)
export const equipmentCheckSchema = z.object({
  name: z.string(),
  serialNumber: z.string().optional(),
  status: z.enum(['ok', 'needs_repair', 'replaced']),
  notes: z.string().optional(),
});

export const partUsedSchema = z.object({
  partNumber: z.string(),
  partName: z.string(),
  quantity: z.number().min(1),
  isWarranty: z.boolean().default(false),
});

export const serviceVisitOutput = z.object({
  id: z.string().uuid(),
  status: serviceVisitStatusEnum,
  startTime: z.date().nullable(),
  endTime: z.date().nullable(),
  travelKm: z.number().nullable(),
  workDescription: z.string().nullable(),
  workPerformed: z.string().nullable(),
  equipmentChecked: z.array(equipmentCheckSchema).nullable(),
  partsUsed: z.array(partUsedSchema).nullable(),
  hasCustomerSignature: z.boolean(),
  hasTechnicianSignature: z.boolean(),
  approvedAt: z.date().nullable(),
});

export const createServiceVisitInput = z.object({
  plannedVisitId: z.string().uuid().optional(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime().optional(),
  travelKm: z.number().min(0).optional(),
  travelTime: z.string().optional(),
  workDescription: z.string().optional(),
  workPerformed: z.string().min(10, 'Beskriv utført arbeid'),
  equipmentChecked: z.array(equipmentCheckSchema).optional(),
  partsUsed: z.array(partUsedSchema).optional(),
  internalNotes: z.string().optional(),
  customerFeedback: z.string().optional(),
});

export const signServiceVisitInput = z.object({
  id: z.string().uuid(),
  technicianSignature: z.string().min(1, 'Signatur er påkrevd'),
  customerSignature: z.string().optional(),
  customerSignedBy: z.string().optional(),
});

// Types
export type PlannedVisitStatus = z.infer<typeof plannedVisitStatusEnum>;
export type ServiceVisitStatus = z.infer<typeof serviceVisitStatusEnum>;
export type PlannedVisitOutput = z.infer<typeof plannedVisitOutput>;
export type ServiceVisitOutput = z.infer<typeof serviceVisitOutput>;
```

---

## Test

```bash
cd packages/db
pnpm db:generate
```

---

## Sjekkliste

- [ ] Nye enums lagt til i enums.ts
- [ ] planned-visits.ts ~80 linjer
- [ ] service-visits.ts ~90 linjer
- [ ] JSONB-felter har riktig TypeScript type
- [ ] Signatur-felt for PDF-generering
- [ ] service.schema.ts oppdatert med visit schemas
- [ ] `pnpm db:generate` OK

---

## Neste fase

Gå til **FASE 6: Installations** for monteringsprosjekter og transportskader.
