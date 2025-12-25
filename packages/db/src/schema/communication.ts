import { pgTable, uuid, varchar, text, boolean, timestamp, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { baseFields } from './common';
import { users } from './auth';

// Discussion issues / internal forum
export const discussionIssues = pgTable('discussion_issues', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: varchar('title', { length: 300 }).notNull(),
  content: text('content').notNull(),

  // Categorization
  category: varchar('category', { length: 50 }),
  tags: text('tags'),
  priority: varchar('priority', { length: 20 }).default('normal'),

  // Status
  status: varchar('status', { length: 30 }).notNull().default('open'),
  isPinned: boolean('is_pinned').default(false),
  isLocked: boolean('is_locked').default(false),

  // Stats
  viewCount: uuid('view_count'),
  replyCount: uuid('reply_count'),

  // References
  createdById: uuid('created_by_id').notNull().references(() => users.id),
  assignedToId: uuid('assigned_to_id').references(() => users.id),

  // Dates
  lastActivityAt: timestamp('last_activity_at', { withTimezone: true }).defaultNow(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),

  ...baseFields,
}, (table) => [
  index('discussion_issues_category_idx').on(table.category),
  index('discussion_issues_status_idx').on(table.status),
  index('discussion_issues_created_by_idx').on(table.createdById),
  index('discussion_issues_last_activity_idx').on(table.lastActivityAt),
]);

// Discussion replies
export const discussionReplies = pgTable('discussion_replies', {
  id: uuid('id').primaryKey().defaultRandom(),
  issueId: uuid('issue_id').notNull().references(() => discussionIssues.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),

  // Status
  isAcceptedAnswer: boolean('is_accepted_answer').default(false),

  // References
  createdById: uuid('created_by_id').notNull().references(() => users.id),

  ...baseFields,
}, (table) => [
  index('discussion_replies_issue_idx').on(table.issueId),
  index('discussion_replies_created_by_idx').on(table.createdById),
]);

// Discussion attachments
export const discussionAttachments = pgTable('discussion_attachments', {
  id: uuid('id').primaryKey().defaultRandom(),
  issueId: uuid('issue_id').references(() => discussionIssues.id, { onDelete: 'cascade' }),
  replyId: uuid('reply_id').references(() => discussionReplies.id, { onDelete: 'cascade' }),
  fileName: varchar('file_name', { length: 255 }).notNull(),
  fileType: varchar('file_type', { length: 100 }),
  fileUrl: text('file_url').notNull(),
  uploadedById: uuid('uploaded_by_id').references(() => users.id),
  ...baseFields,
}, (table) => [
  index('discussion_attachments_issue_idx').on(table.issueId),
  index('discussion_attachments_reply_idx').on(table.replyId),
]);

// Relations
export const discussionIssuesRelations = relations(discussionIssues, ({ one, many }) => ({
  createdBy: one(users, {
    fields: [discussionIssues.createdById],
    references: [users.id],
  }),
  assignedTo: one(users, {
    fields: [discussionIssues.assignedToId],
    references: [users.id],
  }),
  replies: many(discussionReplies),
  attachments: many(discussionAttachments),
}));

export const discussionRepliesRelations = relations(discussionReplies, ({ one, many }) => ({
  issue: one(discussionIssues, {
    fields: [discussionReplies.issueId],
    references: [discussionIssues.id],
  }),
  createdBy: one(users, {
    fields: [discussionReplies.createdById],
    references: [users.id],
  }),
  attachments: many(discussionAttachments),
}));

export const discussionAttachmentsRelations = relations(discussionAttachments, ({ one }) => ({
  issue: one(discussionIssues, {
    fields: [discussionAttachments.issueId],
    references: [discussionIssues.id],
  }),
  reply: one(discussionReplies, {
    fields: [discussionAttachments.replyId],
    references: [discussionReplies.id],
  }),
  uploadedBy: one(users, {
    fields: [discussionAttachments.uploadedById],
    references: [users.id],
  }),
}));
