# FASE 4: Service Core (Avtaler & Partnere)

> Fase 1-3 må være fullført.
> Estimert tid: ~45 minutter.

## Mål

Opprett service-tabeller for vedlikeholdsavtaler og servicepartnere.

---

## Mappestruktur

```
packages/db/src/schema/service/
├── index.ts
├── enums.ts
├── maintenance-agreements.ts    # Dagligvare (~80 linjer)
├── storkjokken-agreements.ts    # Storkjøkken (~100 linjer)
└── service-partners.ts          # Partnere (~70 linjer)
```

---

## packages/db/src/schema/service/enums.ts

```typescript
import { pgEnum } from 'drizzle-orm/pg-core';

export const agreementStatusEnum = pgEnum('agreement_status', [
  'draft',
  'active',
  'expired',
  'cancelled',
]);

export const agreementTypeEnum = pgEnum('agreement_type', [
  'dagligvare',    // Enkel vedlikeholdsavtale
  'storkjokken',   // Komplett storkjøkken-avtale
]);

export const partnerTypeEnum = pgEnum('partner_type', [
  'partner',    // Ekstern partner
  'employee',   // Intern ansatt
]);

export const partnerStatusEnum = pgEnum('partner_status', [
  'active',
  'pause',
  'inactive',
]);

export const tradeAreaEnum = pgEnum('trade_area', [
  'elektriker',
  'kjoletekniker',
  'rorlegger',
  'montor',
  'vaktmester',
  'generalist',
]);

export const serviceTypeEnum = pgEnum('service_type', [
  'storhusholdning',
  'vedlikeholdsavtale',
  'kjoletekniker',
]);
```

---

## packages/db/src/schema/service/maintenance-agreements.ts

```typescript
import { pgTable, uuid, varchar, text, integer, decimal, timestamp, boolean, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { baseFields } from '../common';
import { agreementStatusEnum, agreementTypeEnum, serviceTypeEnum } from './enums';
import { customers } from '../crm';
import { departments } from '../organization';
import { users } from '../auth';

export const maintenanceAgreements = pgTable('maintenance_agreements', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Identifikasjon
  agreementNumber: varchar('agreement_number', { length: 50 }).notNull().unique(),
  title: varchar('title', { length: 255 }),
  
  // Type
  agreementType: agreementTypeEnum('agreement_type').default('dagligvare'),
  
  // Relasjoner
  customerId: uuid('customer_id').references(() => customers.id),
  departmentId: uuid('department_id').references(() => departments.id),
  createdById: uuid('created_by_id').references(() => users.id),
  
  status: agreementStatusEnum('status').default('draft').notNull(),
  
  // Kundeinfo (denormalisert)
  customerName: varchar('customer_name', { length: 255 }),
  customerNumber: varchar('customer_number', { length: 50 }),
  
  // Leveringsadresse
  deliveryAddress: text('delivery_address'),
  deliveryPostcode: varchar('delivery_postcode', { length: 10 }),
  deliveryCity: varchar('delivery_city', { length: 100 }),
  
  // Kontakt
  contactPerson: varchar('contact_person', { length: 255 }),
  contactPhone: varchar('contact_phone', { length: 50 }),
  contactEmail: varchar('contact_email', { length: 255 }),
  
  // Servicetyper (checkboxes)
  hasStorhusholdning: boolean('has_storhusholdning').default(false),
  hasVedlikeholdsavtale: boolean('has_vedlikeholdsavtale').default(false),
  hasKjoletekniker: boolean('has_kjoletekniker').default(false),
  
  // Priser
  visitsPerYear: integer('visits_per_year').default(1),
  pricePerYear: decimal('price_per_year', { precision: 12, scale: 2 }),
  hourlyRate: decimal('hourly_rate', { precision: 10, scale: 2 }),
  
  // Gyldighet
  validFrom: timestamp('valid_from', { withTimezone: true }),
  validTo: timestamp('valid_to', { withTimezone: true }),
  
  // Service-intervall
  lastServiceDate: timestamp('last_service_date', { withTimezone: true }),
  nextServiceDate: timestamp('next_service_date', { withTimezone: true }),
  serviceIntervalMonths: integer('service_interval_months').default(6),
  
  notes: text('notes'),
  
  ...baseFields,
}, (table) => ({
  agreementNumberIdx: index('idx_maint_agreements_number').on(table.agreementNumber),
  customerIdx: index('idx_maint_agreements_customer').on(table.customerId),
  statusIdx: index('idx_maint_agreements_status').on(table.status),
  validToIdx: index('idx_maint_agreements_valid_to').on(table.validTo),
  nextServiceIdx: index('idx_maint_agreements_next_service').on(table.nextServiceDate),
}));

export const maintenanceAgreementsRelations = relations(maintenanceAgreements, ({ one }) => ({
  customer: one(customers, {
    fields: [maintenanceAgreements.customerId],
    references: [customers.id],
  }),
  department: one(departments, {
    fields: [maintenanceAgreements.departmentId],
    references: [departments.id],
  }),
  createdBy: one(users, {
    fields: [maintenanceAgreements.createdById],
    references: [users.id],
  }),
}));
```

---

## packages/db/src/schema/service/storkjokken-agreements.ts

```typescript
import { pgTable, uuid, varchar, text, integer, decimal, timestamp, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { baseFields } from '../common';
import { agreementStatusEnum } from './enums';
import { customers } from '../crm';
import { departments } from '../organization';
import { users } from '../auth';

export const storkjokkenAgreements = pgTable('storkjokken_agreements', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Identifikasjon
  agreementNumber: varchar('agreement_number', { length: 50 }).notNull().unique(),
  sourceContractId: integer('source_contract_id'), // Fra gammelt system
  
  // Relasjoner
  customerId: uuid('customer_id').references(() => customers.id),
  departmentId: uuid('department_id').references(() => departments.id),
  createdById: uuid('created_by_id').references(() => users.id),
  
  status: agreementStatusEnum('status').default('draft').notNull(),
  
  // Kundeinfo
  customerName: varchar('customer_name', { length: 255 }),
  customerNumber: varchar('customer_number', { length: 50 }),
  
  // Leveringsadresse
  deliveryAddress: text('delivery_address'),
  deliveryPostcode: varchar('delivery_postcode', { length: 10 }),
  deliveryCity: varchar('delivery_city', { length: 100 }),
  
  // Fakturaadresse
  invoiceCustomerNumber: varchar('invoice_customer_number', { length: 50 }),
  invoiceCustomerName: varchar('invoice_customer_name', { length: 255 }),
  invoiceAddress: text('invoice_address'),
  invoicePostcode: varchar('invoice_postcode', { length: 10 }),
  invoiceCity: varchar('invoice_city', { length: 100 }),
  
  // Kontaktpersoner
  contactPerson: varchar('contact_person', { length: 255 }),
  contactPhone: varchar('contact_phone', { length: 50 }),
  contactEmail: varchar('contact_email', { length: 255 }),
  kitchenManagerName: varchar('kitchen_manager_name', { length: 255 }),
  kitchenManagerPhone: varchar('kitchen_manager_phone', { length: 50 }),
  
  // Priser
  visitsPerYear: integer('visits_per_year').default(2),
  pricePerYear: decimal('price_per_year', { precision: 12, scale: 2 }),
  hourlyRate: decimal('hourly_rate', { precision: 10, scale: 2 }),
  hourlyRateCooling: decimal('hourly_rate_cooling', { precision: 10, scale: 2 }),
  zone1Rate: decimal('zone1_rate', { precision: 10, scale: 2 }),
  zone2Rate: decimal('zone2_rate', { precision: 10, scale: 2 }),
  callOutFee: decimal('call_out_fee', { precision: 10, scale: 2 }),
  
  // Gyldighet
  validFrom: timestamp('valid_from', { withTimezone: true }),
  validTo: timestamp('valid_to', { withTimezone: true }),
  signedAt: timestamp('signed_at', { withTimezone: true }),
  signedBy: varchar('signed_by', { length: 255 }),
  
  // Service-intervall
  lastServiceDate: timestamp('last_service_date', { withTimezone: true }),
  nextServiceDate: timestamp('next_service_date', { withTimezone: true }),
  
  // Dokumenter
  documentUrl: varchar('document_url', { length: 500 }),
  
  notes: text('notes'),
  
  ...baseFields,
}, (table) => ({
  agreementNumberIdx: index('idx_stork_agreements_number').on(table.agreementNumber),
  customerIdx: index('idx_stork_agreements_customer').on(table.customerId),
  statusIdx: index('idx_stork_agreements_status').on(table.status),
  validToIdx: index('idx_stork_agreements_valid_to').on(table.validTo),
  nextServiceIdx: index('idx_stork_agreements_next_service').on(table.nextServiceDate),
}));

export const storkjokkenAgreementsRelations = relations(storkjokkenAgreements, ({ one }) => ({
  customer: one(customers, {
    fields: [storkjokkenAgreements.customerId],
    references: [customers.id],
  }),
  department: one(departments, {
    fields: [storkjokkenAgreements.departmentId],
    references: [departments.id],
  }),
  createdBy: one(users, {
    fields: [storkjokkenAgreements.createdById],
    references: [users.id],
  }),
}));
```

---

## packages/db/src/schema/service/service-partners.ts

```typescript
import { pgTable, uuid, varchar, text, integer, decimal, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { baseFields } from '../common';
import { partnerTypeEnum, partnerStatusEnum, tradeAreaEnum } from './enums';
import { users } from '../auth';

export const servicePartners = pgTable('service_partners', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Firmainfo
  companyName: varchar('company_name', { length: 255 }).notNull(),
  organizationNumber: varchar('organization_number', { length: 20 }),
  contactPerson: varchar('contact_person', { length: 255 }),
  
  // Type & Status
  type: partnerTypeEnum('type').default('partner').notNull(),
  status: partnerStatusEnum('status').default('active').notNull(),
  tradeArea: tradeAreaEnum('trade_area'),
  
  // Kontakt
  phone: varchar('phone', { length: 50 }),
  email: varchar('email', { length: 255 }),
  
  // Adresse
  address: text('address'),
  postalCode: varchar('postal_code', { length: 10 }),
  city: varchar('city', { length: 100 }),
  county: varchar('county', { length: 100 }), // Fylke
  
  // Dekningsområde
  serviceArea: text('service_area'),
  workRadius: integer('work_radius'), // km
  
  // Koordinater for kart
  latitude: decimal('latitude', { precision: 10, scale: 7 }),
  longitude: decimal('longitude', { precision: 10, scale: 7 }),
  
  // Tilknytning
  serviceCoordinatorId: uuid('service_coordinator_id').references(() => users.id),
  createdById: uuid('created_by_id').references(() => users.id),
  
  notes: text('notes'),
  
  ...baseFields,
}, (table) => ({
  companyNameIdx: index('idx_service_partners_company').on(table.companyName),
  statusIdx: index('idx_service_partners_status').on(table.status),
  tradeAreaIdx: index('idx_service_partners_trade').on(table.tradeArea),
  countyIdx: index('idx_service_partners_county').on(table.county),
  locationIdx: index('idx_service_partners_location').on(table.latitude, table.longitude),
}));

export const servicePartnersRelations = relations(servicePartners, ({ one }) => ({
  serviceCoordinator: one(users, {
    fields: [servicePartners.serviceCoordinatorId],
    references: [users.id],
    relationName: 'coordinatorPartners',
  }),
  createdBy: one(users, {
    fields: [servicePartners.createdById],
    references: [users.id],
    relationName: 'createdPartners',
  }),
}));
```

---

## packages/db/src/schema/service/index.ts

```typescript
export * from './enums';
export * from './maintenance-agreements';
export * from './storkjokken-agreements';
export * from './service-partners';
// Fase 5:
// export * from './planned-visits';
// export * from './service-visits';
```

---

## packages/shared/src/schemas/service.schema.ts

```typescript
import { z } from 'zod';
import { paginationInput } from './common.schema';

// Status enums
export const AGREEMENT_STATUS = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
} as const;

export const PARTNER_STATUS = {
  ACTIVE: 'active',
  PAUSE: 'pause',
  INACTIVE: 'inactive',
} as const;

export const TRADE_AREA = {
  ELEKTRIKER: 'elektriker',
  KJOLETEKNIKER: 'kjoletekniker',
  RORLEGGER: 'rorlegger',
  MONTOR: 'montor',
  VAKTMESTER: 'vaktmester',
  GENERALIST: 'generalist',
} as const;

// Norske labels
export const AGREEMENT_STATUS_LABELS: Record<string, string> = {
  draft: 'Utkast',
  active: 'Aktiv',
  expired: 'Utløpt',
  cancelled: 'Kansellert',
};

export const PARTNER_STATUS_LABELS: Record<string, string> = {
  active: 'Aktiv',
  pause: 'Pause',
  inactive: 'Inaktiv',
};

export const TRADE_AREA_LABELS: Record<string, string> = {
  elektriker: 'Elektriker',
  kjoletekniker: 'Kjøletekniker',
  rorlegger: 'Rørlegger',
  montor: 'Montør',
  vaktmester: 'Vaktmester',
  generalist: 'Generalist',
};

// Zod schemas
export const agreementStatusEnum = z.enum(['draft', 'active', 'expired', 'cancelled']);
export const partnerStatusEnum = z.enum(['active', 'pause', 'inactive']);
export const tradeAreaEnum = z.enum(['elektriker', 'kjoletekniker', 'rorlegger', 'montor', 'vaktmester', 'generalist']);

// Maintenance Agreement
export const agreementOutput = z.object({
  id: z.string().uuid(),
  agreementNumber: z.string(),
  title: z.string().nullable(),
  status: agreementStatusEnum,
  customerName: z.string().nullable(),
  customerNumber: z.string().nullable(),
  deliveryCity: z.string().nullable(),
  visitsPerYear: z.number().nullable(),
  pricePerYear: z.number().nullable(),
  validFrom: z.date().nullable(),
  validTo: z.date().nullable(),
  nextServiceDate: z.date().nullable(),
  hasStorhusholdning: z.boolean(),
  hasVedlikeholdsavtale: z.boolean(),
  hasKjoletekniker: z.boolean(),
});

export const agreementListInput = paginationInput.extend({
  search: z.string().optional(),
  status: agreementStatusEnum.optional(),
  hasExpiringSoon: z.boolean().optional(), // Utløper innen 30 dager
  needsService: z.boolean().optional(), // Neste service forfalt
});

export const createAgreementInput = z.object({
  title: z.string().min(1, 'Tittel er påkrevd'),
  customerId: z.string().uuid().optional(),
  customerName: z.string().optional(),
  customerNumber: z.string().optional(),
  deliveryAddress: z.string().optional(),
  deliveryPostcode: z.string().optional(),
  deliveryCity: z.string().optional(),
  contactPerson: z.string().optional(),
  contactPhone: z.string().optional(),
  contactEmail: z.string().email().optional(),
  hasStorhusholdning: z.boolean().default(false),
  hasVedlikeholdsavtale: z.boolean().default(false),
  hasKjoletekniker: z.boolean().default(false),
  visitsPerYear: z.number().min(1).default(1),
  pricePerYear: z.number().min(0).optional(),
  validFrom: z.string().datetime(),
  validTo: z.string().datetime(),
  serviceIntervalMonths: z.number().min(1).max(24).default(6),
});

// Service Partner
export const partnerOutput = z.object({
  id: z.string().uuid(),
  companyName: z.string(),
  contactPerson: z.string().nullable(),
  type: z.enum(['partner', 'employee']),
  status: partnerStatusEnum,
  tradeArea: tradeAreaEnum.nullable(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  city: z.string().nullable(),
  county: z.string().nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  workRadius: z.number().nullable(),
});

export const partnerListInput = paginationInput.extend({
  search: z.string().optional(),
  status: partnerStatusEnum.optional(),
  tradeArea: tradeAreaEnum.optional(),
  county: z.string().optional(),
});

export const createPartnerInput = z.object({
  companyName: z.string().min(1, 'Firmanavn er påkrevd'),
  organizationNumber: z.string().optional(),
  contactPerson: z.string().optional(),
  type: z.enum(['partner', 'employee']).default('partner'),
  tradeArea: tradeAreaEnum.optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
  postalCode: z.string().optional(),
  city: z.string().optional(),
  county: z.string().optional(),
  workRadius: z.number().min(1).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

// Types
export type AgreementStatus = z.infer<typeof agreementStatusEnum>;
export type PartnerStatus = z.infer<typeof partnerStatusEnum>;
export type TradeArea = z.infer<typeof tradeAreaEnum>;
export type AgreementOutput = z.infer<typeof agreementOutput>;
export type PartnerOutput = z.infer<typeof partnerOutput>;
```

---

## Oppdater indexes

```typescript
// packages/db/src/schema/index.ts
export * from './common';
export * from './auth';
export * from './organization';
export * from './crm';
export * from './claims';
export * from './service';  // <-- Legg til

// packages/shared/src/schemas/index.ts
export * from './common.schema';
export * from './auth.schema';
export * from './crm.schema';
export * from './claims.schema';
export * from './service.schema';  // <-- Legg til
```

---

## Sjekkliste

- [ ] enums.ts med agreement/partner enums
- [ ] maintenance-agreements.ts ~80 linjer
- [ ] storkjokken-agreements.ts ~100 linjer
- [ ] service-partners.ts ~70 linjer
- [ ] Alle har ...baseFields
- [ ] Geo-koordinater med riktig presisjon
- [ ] service.schema.ts med Zod og norske labels
- [ ] `pnpm db:generate` OK

---

## Neste fase

Gå til **FASE 5: Service Visits** for planlagte og utførte besøk.
