# FASE 7: Communication (Discussion Issues)

> Fase 1-6 må være fullført.
> Estimert tid: ~20 minutter.

## Mål

Opprett tabeller for saker/diskusjoner (Discussion Issues).

---

## Mappestruktur

```
packages/db/src/schema/communication/
├── index.ts
├── enums.ts
└── discussion-issues.ts    # ~80 linjer
```

---

## packages/db/src/schema/communication/enums.ts

```typescript
import { pgEnum } from 'drizzle-orm/pg-core';

export const discussionTypeEnum = pgEnum('discussion_type', [
  'general',     // Generelt
  'invoice',     // Faktura-sak
  'customer',    // Kundesak
  'internal',    // Internt
  'meeting',     // Møte-notater
  'complaint',   // Klage
  'question',    // Spørsmål
]);

export const discussionStatusEnum = pgEnum('discussion_status', [
  'new',         // Ny
  'in_progress', // Under behandling
  'waiting',     // Venter
  'resolved',    // Løst
  'closed',      // Lukket
]);

export const discussionPriorityEnum = pgEnum('discussion_priority', [
  'low',
  'normal',
  'high',
  'urgent',
]);

export const discussionSourceEnum = pgEnum('discussion_source', [
  'manual',      // Manuelt opprettet
  'email',       // Fra e-post
  'outlook',     // Fra Outlook
  'phone',       // Telefon
  'meeting',     // Fra møte
]);
```

---

## packages/db/src/schema/communication/discussion-issues.ts

```typescript
import { pgTable, uuid, varchar, text, decimal, boolean, timestamp, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { baseFields } from '../common';
import { discussionTypeEnum, discussionStatusEnum, discussionPriorityEnum, discussionSourceEnum } from './enums';
import { customers, suppliers } from '../crm';
import { claims } from '../claims';
import { users } from '../auth';
import { departments } from '../organization';

export const discussionIssues = pgTable('discussion_issues', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Innhold
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  
  // Type & Status
  type: discussionTypeEnum('type').default('general').notNull(),
  status: discussionStatusEnum('status').default('new').notNull(),
  priority: discussionPriorityEnum('priority').default('normal'),
  source: discussionSourceEnum('source').default('manual'),
  
  // Relasjoner
  customerId: uuid('customer_id').references(() => customers.id),
  supplierId: uuid('supplier_id').references(() => suppliers.id),
  claimId: uuid('claim_id').references(() => claims.id),
  departmentId: uuid('department_id').references(() => departments.id),
  
  // Tilordning
  assignedToId: uuid('assigned_to_id').references(() => users.id),
  createdById: uuid('created_by_id').references(() => users.id).notNull(),
  resolvedById: uuid('resolved_by_id').references(() => users.id),
  
  // Faktura
  invoiceNumber: varchar('invoice_number', { length: 100 }),
  invoiceAmount: decimal('invoice_amount', { precision: 12, scale: 2 }),
  invoiceDate: timestamp('invoice_date', { withTimezone: true }),
  
  // Outlook integrasjon
  outlookMessageId: varchar('outlook_message_id', { length: 255 }),
  outlookConversationId: varchar('outlook_conversation_id', { length: 255 }),
  emailFrom: varchar('email_from', { length: 255 }),
  emailSubject: varchar('email_subject', { length: 500 }),
  
  // Møte
  meetingDate: timestamp('meeting_date', { withTimezone: true }),
  scheduledForMeeting: boolean('scheduled_for_meeting').default(false),
  
  // Frister
  dueDate: timestamp('due_date', { withTimezone: true }),
  
  // Løsning
  resolution: text('resolution'),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  
  // Tags (for enkel filtrering)
  tags: text('tags'), // Kommaseparert liste
  
  ...baseFields,
}, (table) => ({
  titleIdx: index('idx_discussion_issues_title').on(table.title),
  statusIdx: index('idx_discussion_issues_status').on(table.status),
  typeIdx: index('idx_discussion_issues_type').on(table.type),
  customerIdx: index('idx_discussion_issues_customer').on(table.customerId),
  assignedToIdx: index('idx_discussion_issues_assigned').on(table.assignedToId),
  createdAtIdx: index('idx_discussion_issues_created_at').on(table.createdAt),
  dueDateIdx: index('idx_discussion_issues_due_date').on(table.dueDate),
}));

export const discussionIssuesRelations = relations(discussionIssues, ({ one }) => ({
  customer: one(customers, {
    fields: [discussionIssues.customerId],
    references: [customers.id],
  }),
  supplier: one(suppliers, {
    fields: [discussionIssues.supplierId],
    references: [suppliers.id],
  }),
  claim: one(claims, {
    fields: [discussionIssues.claimId],
    references: [claims.id],
  }),
  department: one(departments, {
    fields: [discussionIssues.departmentId],
    references: [departments.id],
  }),
  assignedTo: one(users, {
    fields: [discussionIssues.assignedToId],
    references: [users.id],
    relationName: 'assignedIssues',
  }),
  createdBy: one(users, {
    fields: [discussionIssues.createdById],
    references: [users.id],
    relationName: 'createdIssues',
  }),
  resolvedBy: one(users, {
    fields: [discussionIssues.resolvedById],
    references: [users.id],
    relationName: 'resolvedIssues',
  }),
}));
```

---

## packages/db/src/schema/communication/index.ts

```typescript
export * from './enums';
export * from './discussion-issues';
```

---

## packages/shared/src/schemas/communication.schema.ts

```typescript
import { z } from 'zod';
import { paginationInput } from './common.schema';

// Status enums
export const DISCUSSION_TYPE = {
  GENERAL: 'general',
  INVOICE: 'invoice',
  CUSTOMER: 'customer',
  INTERNAL: 'internal',
  MEETING: 'meeting',
  COMPLAINT: 'complaint',
  QUESTION: 'question',
} as const;

export const DISCUSSION_STATUS = {
  NEW: 'new',
  IN_PROGRESS: 'in_progress',
  WAITING: 'waiting',
  RESOLVED: 'resolved',
  CLOSED: 'closed',
} as const;

// Norske labels
export const DISCUSSION_TYPE_LABELS: Record<string, string> = {
  general: 'Generelt',
  invoice: 'Faktura-sak',
  customer: 'Kundesak',
  internal: 'Internt',
  meeting: 'Møte-notater',
  complaint: 'Klage',
  question: 'Spørsmål',
};

export const DISCUSSION_STATUS_LABELS: Record<string, string> = {
  new: 'Ny',
  in_progress: 'Under behandling',
  waiting: 'Venter',
  resolved: 'Løst',
  closed: 'Lukket',
};

// Zod schemas
export const discussionTypeEnum = z.enum(['general', 'invoice', 'customer', 'internal', 'meeting', 'complaint', 'question']);
export const discussionStatusEnum = z.enum(['new', 'in_progress', 'waiting', 'resolved', 'closed']);
export const discussionPriorityEnum = z.enum(['low', 'normal', 'high', 'urgent']);

export const discussionIssueOutput = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable(),
  type: discussionTypeEnum,
  status: discussionStatusEnum,
  priority: discussionPriorityEnum,
  customerId: z.string().uuid().nullable(),
  invoiceNumber: z.string().nullable(),
  invoiceAmount: z.number().nullable(),
  dueDate: z.date().nullable(),
  createdAt: z.date(),
  assignedTo: z.object({
    id: z.string().uuid(),
    firstName: z.string().nullable(),
    lastName: z.string().nullable(),
  }).nullable(),
  createdBy: z.object({
    id: z.string().uuid(),
    firstName: z.string().nullable(),
    lastName: z.string().nullable(),
  }),
});

export const discussionIssueListInput = paginationInput.extend({
  search: z.string().optional(),
  type: discussionTypeEnum.optional(),
  status: discussionStatusEnum.optional(),
  priority: discussionPriorityEnum.optional(),
  assignedToId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  hasOverdueDueDate: z.boolean().optional(),
  scheduledForMeeting: z.boolean().optional(),
});

export const createDiscussionIssueInput = z.object({
  title: z.string().min(1, 'Tittel er påkrevd'),
  description: z.string().optional(),
  type: discussionTypeEnum.default('general'),
  priority: discussionPriorityEnum.default('normal'),
  customerId: z.string().uuid().optional(),
  supplierId: z.string().uuid().optional(),
  claimId: z.string().uuid().optional(),
  assignedToId: z.string().uuid().optional(),
  invoiceNumber: z.string().optional(),
  invoiceAmount: z.number().min(0).optional(),
  invoiceDate: z.string().datetime().optional(),
  dueDate: z.string().datetime().optional(),
  tags: z.string().optional(),
});

export const updateDiscussionIssueInput = z.object({
  id: z.string().uuid(),
  title: z.string().optional(),
  description: z.string().optional(),
  status: discussionStatusEnum.optional(),
  priority: discussionPriorityEnum.optional(),
  assignedToId: z.string().uuid().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  resolution: z.string().optional(),
});

// Types
export type DiscussionType = z.infer<typeof discussionTypeEnum>;
export type DiscussionStatus = z.infer<typeof discussionStatusEnum>;
export type DiscussionIssueOutput = z.infer<typeof discussionIssueOutput>;
```

---

## Oppdater indexes

```typescript
// packages/db/src/schema/index.ts - komplett
export * from './common';
export * from './auth';
export * from './organization';
export * from './crm';
export * from './claims';
export * from './service';
export * from './installations';
export * from './communication';  // <-- Legg til

// packages/shared/src/schemas/index.ts - komplett
export * from './common.schema';
export * from './auth.schema';
export * from './crm.schema';
export * from './claims.schema';
export * from './service.schema';
export * from './installations.schema';
export * from './communication.schema';  // <-- Legg til
```

---

## 🎉 Database ferdig!

Etter fase 7 har du:

```
packages/db/src/schema/
├── index.ts
├── common.ts
├── auth/
│   ├── users.ts
│   └── sessions.ts
├── organization/
│   └── departments.ts
├── crm/
│   ├── suppliers.ts
│   ├── products.ts
│   └── customers.ts
├── claims/
│   ├── claims.ts
│   ├── claim-parts.ts
│   ├── claim-attachments.ts
│   └── claim-timeline.ts
├── service/
│   ├── maintenance-agreements.ts
│   ├── storkjokken-agreements.ts
│   ├── service-partners.ts
│   ├── planned-visits.ts
│   └── service-visits.ts
├── installations/
│   ├── installations.ts
│   └── transport-damages.ts
└── communication/
    └── discussion-issues.ts
```

**Totalt: 15+ tabeller, alle under 100 linjer!**

---

## Sjekkliste

- [ ] enums.ts med alle typer
- [ ] discussion-issues.ts ~80 linjer
- [ ] Outlook-integrasjon felter
- [ ] Meeting-felter
- [ ] Tags for filtrering
- [ ] communication.schema.ts med Zod
- [ ] Hovedindex eksporterer alt
- [ ] `pnpm db:generate` OK

---

## Neste fase

Gå til **FASE 8: API Setup** for å sette opp Fastify + tRPC!
