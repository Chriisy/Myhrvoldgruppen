import { z } from 'zod';
import { eq, and, desc, count, inArray } from 'drizzle-orm';
import { router, protectedProcedure } from '../../trpc/trpc';
import { chatChannels, chatChannelMembers, chatMessages, chatReactions } from '@myhrvold/db/schema';

export const chatRouter = router({
  // === Channels ===

  // List channels user is member of
  myChannels: protectedProcedure
    .query(async ({ ctx }) => {
      const memberships = await ctx.db.query.chatChannelMembers.findMany({
        where: and(
          eq(chatChannelMembers.userId, ctx.user!.id),
          eq(chatChannelMembers.isDeleted, false)
        ),
        with: {
          channel: {
            with: {
              members: {
                limit: 5,
                with: {
                  user: {
                    columns: { id: true, firstName: true, lastName: true },
                  },
                },
              },
            },
          },
        },
        orderBy: [desc(chatChannelMembers.createdAt)],
      });

      return memberships.map(m => ({
        ...m.channel,
        membership: {
          role: m.role,
          isMuted: m.isMuted,
          lastReadAt: m.lastReadAt,
        },
      }));
    }),

  // Get channel by ID
  channelById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const channel = await ctx.db.query.chatChannels.findFirst({
        where: and(
          eq(chatChannels.id, input.id),
          eq(chatChannels.isDeleted, false)
        ),
        with: {
          members: {
            with: {
              user: {
                columns: { id: true, firstName: true, lastName: true, email: true },
              },
            },
          },
          createdBy: {
            columns: { id: true, firstName: true, lastName: true },
          },
        },
      });

      return channel;
    }),

  // Create channel
  createChannel: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(100),
      description: z.string().optional(),
      type: z.enum(['group', 'direct', 'announcement']).default('group'),
      isPrivate: z.boolean().optional(),
      memberIds: z.array(z.string().uuid()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { memberIds, ...channelData } = input;

      // Create channel
      const [channel] = await ctx.db.insert(chatChannels).values({
        ...channelData,
        createdById: ctx.user?.id,
      }).returning();

      // Add creator as admin
      await ctx.db.insert(chatChannelMembers).values({
        channelId: channel.id,
        userId: ctx.user!.id,
        role: 'admin',
      });

      // Add other members
      if (memberIds && memberIds.length > 0) {
        await ctx.db.insert(chatChannelMembers).values(
          memberIds.map(userId => ({
            channelId: channel.id,
            userId,
            role: 'member',
          }))
        );
      }

      return channel;
    }),

  // Add member to channel
  addMember: protectedProcedure
    .input(z.object({
      channelId: z.string().uuid(),
      userId: z.string().uuid(),
      role: z.enum(['admin', 'member']).default('member'),
    }))
    .mutation(async ({ ctx, input }) => {
      const [member] = await ctx.db.insert(chatChannelMembers).values({
        channelId: input.channelId,
        userId: input.userId,
        role: input.role,
      }).returning();

      return member;
    }),

  // Leave channel
  leaveChannel: protectedProcedure
    .input(z.object({ channelId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.update(chatChannelMembers)
        .set({ isDeleted: true, deletedAt: new Date() })
        .where(and(
          eq(chatChannelMembers.channelId, input.channelId),
          eq(chatChannelMembers.userId, ctx.user!.id)
        ));

      return { success: true };
    }),

  // === Messages ===

  // Get messages for channel
  messages: protectedProcedure
    .input(z.object({
      channelId: z.string().uuid(),
      limit: z.number().int().positive().max(100).default(50),
      before: z.string().uuid().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const conditions = [
        eq(chatMessages.channelId, input.channelId),
        eq(chatMessages.isDeleted, false),
      ];

      const messages = await ctx.db.query.chatMessages.findMany({
        where: and(...conditions),
        orderBy: [desc(chatMessages.createdAt)],
        limit: input.limit,
        with: {
          sender: {
            columns: { id: true, firstName: true, lastName: true },
          },
          replyTo: {
            with: {
              sender: {
                columns: { id: true, firstName: true, lastName: true },
              },
            },
          },
          reactions: {
            with: {
              user: {
                columns: { id: true, firstName: true, lastName: true },
              },
            },
          },
        },
      });

      return messages.reverse(); // Return oldest first
    }),

  // Send message
  sendMessage: protectedProcedure
    .input(z.object({
      channelId: z.string().uuid(),
      content: z.string().min(1),
      replyToId: z.string().uuid().optional(),
      mentions: z.array(z.string().uuid()).optional(),
      attachments: z.array(z.object({
        id: z.string(),
        fileName: z.string(),
        fileType: z.string(),
        fileUrl: z.string(),
        fileSize: z.number().optional(),
      })).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [message] = await ctx.db.insert(chatMessages).values({
        channelId: input.channelId,
        content: input.content,
        replyToId: input.replyToId,
        mentions: input.mentions,
        attachments: input.attachments,
        senderId: ctx.user!.id,
        messageType: input.attachments?.length ? 'file' : 'text',
      }).returning();

      // Update channel last message time
      await ctx.db.update(chatChannels)
        .set({ lastMessageAt: new Date() })
        .where(eq(chatChannels.id, input.channelId));

      return message;
    }),

  // Edit message
  editMessage: protectedProcedure
    .input(z.object({
      messageId: z.string().uuid(),
      content: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const [message] = await ctx.db.update(chatMessages)
        .set({
          content: input.content,
          isEdited: true,
          editedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(and(
          eq(chatMessages.id, input.messageId),
          eq(chatMessages.senderId, ctx.user!.id)
        ))
        .returning();

      return message;
    }),

  // Delete message
  deleteMessage: protectedProcedure
    .input(z.object({ messageId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.update(chatMessages)
        .set({ isDeleted: true, deletedAt: new Date() })
        .where(and(
          eq(chatMessages.id, input.messageId),
          eq(chatMessages.senderId, ctx.user!.id)
        ));

      return { success: true };
    }),

  // Add reaction
  addReaction: protectedProcedure
    .input(z.object({
      messageId: z.string().uuid(),
      emoji: z.string().max(10),
    }))
    .mutation(async ({ ctx, input }) => {
      const [reaction] = await ctx.db.insert(chatReactions).values({
        messageId: input.messageId,
        userId: ctx.user!.id,
        emoji: input.emoji,
      }).returning();

      return reaction;
    }),

  // Remove reaction
  removeReaction: protectedProcedure
    .input(z.object({
      messageId: z.string().uuid(),
      emoji: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(chatReactions)
        .where(and(
          eq(chatReactions.messageId, input.messageId),
          eq(chatReactions.userId, ctx.user!.id),
          eq(chatReactions.emoji, input.emoji)
        ));

      return { success: true };
    }),

  // Mark as read
  markAsRead: protectedProcedure
    .input(z.object({ channelId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.update(chatChannelMembers)
        .set({ lastReadAt: new Date() })
        .where(and(
          eq(chatChannelMembers.channelId, input.channelId),
          eq(chatChannelMembers.userId, ctx.user!.id)
        ));

      return { success: true };
    }),

  // === Stats ===

  stats: protectedProcedure
    .query(async ({ ctx }) => {
      const memberships = await ctx.db.query.chatChannelMembers.findMany({
        where: and(
          eq(chatChannelMembers.userId, ctx.user!.id),
          eq(chatChannelMembers.isDeleted, false)
        ),
        columns: { channelId: true },
      });

      return {
        channelCount: memberships.length,
      };
    }),
});

export type ChatRouter = typeof chatRouter;
