import { Expo, ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';
import { logger } from './logger';

// Initialize Expo SDK
const expo = new Expo();

interface PushToken {
  userId: string;
  token: string;
  platform: 'ios' | 'android' | 'web';
  deviceName?: string;
  createdAt: Date;
}

// In-memory store (use database in production)
const pushTokens = new Map<string, PushToken[]>();

/**
 * Register a push token for a user
 */
export function registerPushToken(
  userId: string,
  token: string,
  platform: 'ios' | 'android' | 'web',
  deviceName?: string
): void {
  // Validate Expo push token
  if (!Expo.isExpoPushToken(token)) {
    logger.warn({ token, userId }, 'Invalid Expo push token');
    return;
  }

  const userTokens = pushTokens.get(userId) || [];

  // Check if token already exists
  if (userTokens.some((t) => t.token === token)) {
    return;
  }

  userTokens.push({
    userId,
    token,
    platform,
    deviceName,
    createdAt: new Date(),
  });

  pushTokens.set(userId, userTokens);
  logger.info({ userId, platform }, 'Push token registered');
}

/**
 * Unregister a push token
 */
export function unregisterPushToken(userId: string, token: string): void {
  const userTokens = pushTokens.get(userId);
  if (!userTokens) return;

  const filtered = userTokens.filter((t) => t.token !== token);
  if (filtered.length > 0) {
    pushTokens.set(userId, filtered);
  } else {
    pushTokens.delete(userId);
  }

  logger.info({ userId }, 'Push token unregistered');
}

/**
 * Get all tokens for a user
 */
export function getUserTokens(userId: string): PushToken[] {
  return pushTokens.get(userId) || [];
}

interface SendPushOptions {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  sound?: 'default' | null;
  badge?: number;
  channelId?: string;
  categoryId?: string;
  priority?: 'default' | 'normal' | 'high';
}

/**
 * Send push notification to a user
 */
export async function sendPushNotification(
  options: SendPushOptions
): Promise<{ success: boolean; ticketIds: string[] }> {
  const tokens = getUserTokens(options.userId);

  if (tokens.length === 0) {
    logger.debug({ userId: options.userId }, 'No push tokens for user');
    return { success: false, ticketIds: [] };
  }

  const messages: ExpoPushMessage[] = tokens.map((t) => ({
    to: t.token,
    title: options.title,
    body: options.body,
    data: options.data,
    sound: options.sound || 'default',
    badge: options.badge,
    channelId: options.channelId,
    categoryId: options.categoryId,
    priority: options.priority || 'high',
  }));

  try {
    const chunks = expo.chunkPushNotifications(messages);
    const ticketIds: string[] = [];

    for (const chunk of chunks) {
      const tickets = await expo.sendPushNotificationsAsync(chunk);

      for (const ticket of tickets) {
        if (ticket.status === 'ok' && ticket.id) {
          ticketIds.push(ticket.id);
        } else if (ticket.status === 'error') {
          logger.error(
            { error: ticket.message, details: ticket.details },
            'Push notification error'
          );

          // Handle invalid tokens
          if (ticket.details?.error === 'DeviceNotRegistered') {
            // Token is invalid, should be removed
            const invalidToken = messages.find(
              (m) => m.to === ticket.details?.expoPushToken
            );
            if (invalidToken && typeof invalidToken.to === 'string') {
              unregisterPushToken(options.userId, invalidToken.to);
            }
          }
        }
      }
    }

    return { success: ticketIds.length > 0, ticketIds };
  } catch (error) {
    logger.error({ error }, 'Failed to send push notification');
    return { success: false, ticketIds: [] };
  }
}

/**
 * Send push notification to multiple users
 */
export async function sendPushToUsers(
  userIds: string[],
  notification: Omit<SendPushOptions, 'userId'>
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;

  for (const userId of userIds) {
    const result = await sendPushNotification({ ...notification, userId });
    if (result.success) {
      sent++;
    } else {
      failed++;
    }
  }

  return { sent, failed };
}

// Notification type helpers

export function sendNewClaimNotification(
  userId: string,
  claimNumber: string,
  customerName: string
) {
  return sendPushNotification({
    userId,
    title: 'Ny reklamasjon',
    body: `${claimNumber} fra ${customerName}`,
    data: { type: 'claim', claimNumber },
    channelId: 'claims',
  });
}

export function sendClaimUpdateNotification(
  userId: string,
  claimNumber: string,
  status: string
) {
  return sendPushNotification({
    userId,
    title: 'Reklamasjon oppdatert',
    body: `${claimNumber} er na ${status}`,
    data: { type: 'claim', claimNumber },
    channelId: 'claims',
  });
}

export function sendNewVisitNotification(
  userId: string,
  visitNumber: string,
  customerName: string,
  date: string
) {
  return sendPushNotification({
    userId,
    title: 'Nytt besok tildelt',
    body: `${visitNumber} hos ${customerName} - ${date}`,
    data: { type: 'visit', visitNumber },
    channelId: 'visits',
  });
}

export function sendChatMessageNotification(
  userId: string,
  senderName: string,
  channelName: string,
  preview: string
) {
  return sendPushNotification({
    userId,
    title: channelName,
    body: `${senderName}: ${preview}`,
    data: { type: 'chat', channelName },
    channelId: 'chat',
  });
}

export function sendMentionNotification(
  userId: string,
  senderName: string,
  context: string
) {
  return sendPushNotification({
    userId,
    title: 'Du ble nevnt',
    body: `${senderName} nevnte deg: ${context}`,
    data: { type: 'mention' },
    channelId: 'mentions',
    priority: 'high',
  });
}
