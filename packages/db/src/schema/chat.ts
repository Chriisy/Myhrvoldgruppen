import { pgTable, uuid, varchar, text, boolean, timestamp, index, jsonb } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { baseFields } from './common';
import { users } from './auth';

// Chat channels (group chats)
export const chatChannels = pgTable('chat_channels', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Channel info
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  type: varchar('type', { length: 20 }).notNull().default('group'), // group, direct, announcement

  // Settings
  isPrivate: boolean('is_private').default(false),
  isReadOnly: boolean('is_read_only').default(false),

  // References
  createdById: uuid('created_by_id').references(() => users.id),

  // Last activity
  lastMessageAt: timestamp('last_message_at', { withTimezone: true }),

  ...baseFields,
}, (table) => [
  index('chat_channels_type_idx').on(table.type),
  index('chat_channels_last_message_idx').on(table.lastMessageAt),
]);

// Channel members
export const chatChannelMembers = pgTable('chat_channel_members', {
  id: uuid('id').primaryKey().defaultRandom(),

  channelId: uuid('channel_id').notNull().references(() => chatChannels.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),

  role: varchar('role', { length: 20 }).default('member'), // admin, member

  // Status
  isMuted: boolean('is_muted').default(false),
  lastReadAt: timestamp('last_read_at', { withTimezone: true }),

  joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow(),

  ...baseFields,
}, (table) => [
  index('chat_members_channel_idx').on(table.channelId),
  index('chat_members_user_idx').on(table.userId),
]);

// Chat messages
export const chatMessages = pgTable('chat_messages', {
  id: uuid('id').primaryKey().defaultRandom(),

  channelId: uuid('channel_id').notNull().references(() => chatChannels.id, { onDelete: 'cascade' }),

  // Content
  content: text('content').notNull(),
  messageType: varchar('message_type', { length: 20 }).default('text'), // text, image, file, system

  // Attachments
  attachments: jsonb('attachments').$type<{
    id: string;
    fileName: string;
    fileType: string;
    fileUrl: string;
    fileSize?: number;
  }[]>(),

  // Reply to
  replyToId: uuid('reply_to_id').references((): any => chatMessages.id),

  // Mentions
  mentions: jsonb('mentions').$type<string[]>(),

  // Status
  isEdited: boolean('is_edited').default(false),
  editedAt: timestamp('edited_at', { withTimezone: true }),

  // References
  senderId: uuid('sender_id').notNull().references(() => users.id),

  ...baseFields,
}, (table) => [
  index('chat_messages_channel_idx').on(table.channelId),
  index('chat_messages_sender_idx').on(table.senderId),
  index('chat_messages_created_idx').on(table.createdAt),
]);

// Message reactions
export const chatReactions = pgTable('chat_reactions', {
  id: uuid('id').primaryKey().defaultRandom(),

  messageId: uuid('message_id').notNull().references(() => chatMessages.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),

  emoji: varchar('emoji', { length: 10 }).notNull(),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  index('chat_reactions_message_idx').on(table.messageId),
  index('chat_reactions_user_idx').on(table.userId),
]);

// Relations
export const chatChannelsRelations = relations(chatChannels, ({ one, many }) => ({
  createdBy: one(users, {
    fields: [chatChannels.createdById],
    references: [users.id],
  }),
  members: many(chatChannelMembers),
  messages: many(chatMessages),
}));

export const chatChannelMembersRelations = relations(chatChannelMembers, ({ one }) => ({
  channel: one(chatChannels, {
    fields: [chatChannelMembers.channelId],
    references: [chatChannels.id],
  }),
  user: one(users, {
    fields: [chatChannelMembers.userId],
    references: [users.id],
  }),
}));

export const chatMessagesRelations = relations(chatMessages, ({ one, many }) => ({
  channel: one(chatChannels, {
    fields: [chatMessages.channelId],
    references: [chatChannels.id],
  }),
  sender: one(users, {
    fields: [chatMessages.senderId],
    references: [users.id],
  }),
  replyTo: one(chatMessages, {
    fields: [chatMessages.replyToId],
    references: [chatMessages.id],
  }),
  reactions: many(chatReactions),
}));

export const chatReactionsRelations = relations(chatReactions, ({ one }) => ({
  message: one(chatMessages, {
    fields: [chatReactions.messageId],
    references: [chatMessages.id],
  }),
  user: one(users, {
    fields: [chatReactions.userId],
    references: [users.id],
  }),
}));
