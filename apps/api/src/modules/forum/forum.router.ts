import { z } from 'zod';
import { eq, and, ilike, desc, count, gte, sql } from 'drizzle-orm';
import { router, protectedProcedure } from '../../trpc/trpc';
import { discussionIssues, discussionReplies, discussionAttachments } from '@myhrvold/db/schema';

export const forumRouter = router({
  // === Issues ===

  // List issues
  issuesList: protectedProcedure
    .input(z.object({
      page: z.number().int().positive().default(1),
      limit: z.number().int().positive().max(100).default(20),
      search: z.string().optional(),
      category: z.string().optional(),
      status: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const { page, limit, search, category, status } = input;
      const offset = (page - 1) * limit;

      const conditions = [eq(discussionIssues.isDeleted, false)];

      if (search) {
        conditions.push(ilike(discussionIssues.title, `%${search}%`));
      }

      if (category) {
        conditions.push(eq(discussionIssues.category, category));
      }

      if (status) {
        conditions.push(eq(discussionIssues.status, status));
      }

      const result = await ctx.db.query.discussionIssues.findMany({
        where: and(...conditions),
        orderBy: [
          desc(discussionIssues.isPinned),
          desc(discussionIssues.lastActivityAt),
        ],
        limit,
        offset,
        with: {
          createdBy: {
            columns: { id: true, firstName: true, lastName: true },
          },
          replies: {
            columns: { id: true },
          },
        },
      });

      return result.map(issue => ({
        ...issue,
        replyCount: issue.replies.length,
      }));
    }),

  // Get issue by ID
  issueById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const issue = await ctx.db.query.discussionIssues.findFirst({
        where: and(
          eq(discussionIssues.id, input.id),
          eq(discussionIssues.isDeleted, false)
        ),
        with: {
          createdBy: {
            columns: { id: true, firstName: true, lastName: true },
          },
          assignedTo: {
            columns: { id: true, firstName: true, lastName: true },
          },
          replies: {
            where: eq(discussionReplies.isDeleted, false),
            orderBy: [desc(discussionReplies.isAcceptedAnswer), desc(discussionReplies.createdAt)],
            with: {
              createdBy: {
                columns: { id: true, firstName: true, lastName: true },
              },
              attachments: true,
            },
          },
          attachments: true,
        },
      });

      return issue;
    }),

  // Create issue
  createIssue: protectedProcedure
    .input(z.object({
      title: z.string().min(1).max(300),
      content: z.string().min(1),
      category: z.string().optional(),
      tags: z.string().optional(),
      priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
    }))
    .mutation(async ({ ctx, input }) => {
      const [issue] = await ctx.db.insert(discussionIssues).values({
        ...input,
        status: 'open',
        createdById: ctx.user!.id,
        lastActivityAt: new Date(),
      }).returning();

      return issue;
    }),

  // Update issue
  updateIssue: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      title: z.string().min(1).max(300).optional(),
      content: z.string().min(1).optional(),
      category: z.string().optional(),
      tags: z.string().optional(),
      priority: z.string().optional(),
      status: z.string().optional(),
      isPinned: z.boolean().optional(),
      isLocked: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      const updateData: any = { ...data, updatedAt: new Date() };

      if (data.status === 'resolved') {
        updateData.resolvedAt = new Date();
      }

      const [issue] = await ctx.db.update(discussionIssues)
        .set(updateData)
        .where(eq(discussionIssues.id, id))
        .returning();

      return issue;
    }),

  // === Replies ===

  // Create reply
  createReply: protectedProcedure
    .input(z.object({
      issueId: z.string().uuid(),
      content: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const [reply] = await ctx.db.insert(discussionReplies).values({
        issueId: input.issueId,
        content: input.content,
        createdById: ctx.user!.id,
      }).returning();

      // Update issue last activity
      await ctx.db.update(discussionIssues)
        .set({ lastActivityAt: new Date() })
        .where(eq(discussionIssues.id, input.issueId));

      return reply;
    }),

  // Mark as accepted answer
  acceptAnswer: protectedProcedure
    .input(z.object({
      replyId: z.string().uuid(),
      issueId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      // First, unmark any previously accepted answer
      await ctx.db.update(discussionReplies)
        .set({ isAcceptedAnswer: false })
        .where(eq(discussionReplies.issueId, input.issueId));

      // Mark this reply as accepted
      const [reply] = await ctx.db.update(discussionReplies)
        .set({ isAcceptedAnswer: true, updatedAt: new Date() })
        .where(eq(discussionReplies.id, input.replyId))
        .returning();

      // Mark issue as resolved
      await ctx.db.update(discussionIssues)
        .set({ status: 'resolved', resolvedAt: new Date() })
        .where(eq(discussionIssues.id, input.issueId));

      return reply;
    }),

  // Delete reply
  deleteReply: protectedProcedure
    .input(z.object({ replyId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.update(discussionReplies)
        .set({ isDeleted: true, deletedAt: new Date() })
        .where(and(
          eq(discussionReplies.id, input.replyId),
          eq(discussionReplies.createdById, ctx.user!.id)
        ));

      return { success: true };
    }),

  // === Categories ===

  categories: protectedProcedure
    .query(async () => {
      return [
        { id: 'general', name: 'Generelt' },
        { id: 'technical', name: 'Teknisk' },
        { id: 'service', name: 'Service' },
        { id: 'claims', name: 'Reklamasjon' },
        { id: 'products', name: 'Produkter' },
        { id: 'procedures', name: 'Prosedyrer' },
        { id: 'training', name: 'Opplæring' },
        { id: 'other', name: 'Annet' },
      ];
    }),

  // === Stats ===

  stats: protectedProcedure
    .query(async ({ ctx }) => {
      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());

      const [total] = await ctx.db
        .select({ count: count() })
        .from(discussionIssues)
        .where(eq(discussionIssues.isDeleted, false));

      const [open] = await ctx.db
        .select({ count: count() })
        .from(discussionIssues)
        .where(and(
          eq(discussionIssues.isDeleted, false),
          eq(discussionIssues.status, 'open')
        ));

      const [thisWeek] = await ctx.db
        .select({ count: count() })
        .from(discussionIssues)
        .where(and(
          eq(discussionIssues.isDeleted, false),
          gte(discussionIssues.createdAt, startOfWeek)
        ));

      const [myIssues] = await ctx.db
        .select({ count: count() })
        .from(discussionIssues)
        .where(and(
          eq(discussionIssues.isDeleted, false),
          eq(discussionIssues.createdById, ctx.user!.id)
        ));

      return {
        total: Number(total.count),
        open: Number(open.count),
        thisWeek: Number(thisWeek.count),
        myIssues: Number(myIssues.count),
      };
    }),
});

export type ForumRouter = typeof forumRouter;
