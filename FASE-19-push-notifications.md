# FASE 19: Push-varsler

> Fase 1-18 må være fullført.
> Estimert tid: ~90 minutter.

## Mål

Implementer push-varsler for viktige hendelser som nye reklamasjoner, statusendringer og påminnelser.

---

## Oversikt

```
┌─────────────────────────────────────────────────────────────────┐
│  PUSH NOTIFICATION SYSTEM                                        │
├─────────────────────────────────────────────────────────────────┤
│  Backend:                                                        │
│  ├── Expo Push Service integrasjon                              │
│  ├── Notification templates (norsk)                             │
│  ├── User preferences (opt-in/out)                              │
│  └── Scheduled notifications (påminnelser)                      │
├─────────────────────────────────────────────────────────────────┤
│  Frontend:                                                       │
│  ├── Push token registrering                                    │
│  ├── Notification handling (foreground/background)              │
│  ├── Deep linking til riktig skjerm                             │
│  └── Innstillinger for varsler                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Database: Notification Tables

### packages/db/src/schema/notifications/push-tokens.ts

```typescript
import { pgTable, uuid, text, timestamp, boolean } from 'drizzle-orm/pg-core';
import { users } from '../auth/users';
import { baseFields } from '../common';

export const pushTokens = pgTable('push_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Bruker
  userId: uuid('user_id').notNull().references(() => users.id),
  
  // Token
  token: text('token').notNull().unique(),
  platform: text('platform').notNull(), // 'ios' | 'android' | 'web'
  deviceName: text('device_name'),
  
  // Status
  isActive: boolean('is_active').default(true),
  lastUsedAt: timestamp('last_used_at'),
  
  ...baseFields,
});
```

---

### packages/db/src/schema/notifications/notification-preferences.ts

```typescript
import { pgTable, uuid, boolean, jsonb } from 'drizzle-orm/pg-core';
import { users } from '../auth/users';
import { baseFields } from '../common';

export const notificationPreferences = pgTable('notification_preferences', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().unique().references(() => users.id),
  
  // Globale innstillinger
  pushEnabled: boolean('push_enabled').default(true),
  emailEnabled: boolean('email_enabled').default(true),
  
  // Kategori-spesifikke
  claimsNew: boolean('claims_new').default(true),
  claimsStatusChange: boolean('claims_status_change').default(true),
  claimsAssigned: boolean('claims_assigned').default(true),
  claimsSupplierResponse: boolean('claims_supplier_response').default(true),
  
  serviceVisitReminder: boolean('service_visit_reminder').default(true),
  serviceVisitAssigned: boolean('service_visit_assigned').default(true),
  
  agreementExpiring: boolean('agreement_expiring').default(true),
  
  // Stille timer (JSON: { start: "22:00", end: "07:00" })
  quietHours: jsonb('quiet_hours'),
  
  ...baseFields,
});
```

---

### packages/db/src/schema/notifications/notifications.ts

```typescript
import { pgTable, uuid, text, timestamp, boolean, jsonb } from 'drizzle-orm/pg-core';
import { users } from '../auth/users';
import { baseFields } from '../common';

export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Mottaker
  userId: uuid('user_id').notNull().references(() => users.id),
  
  // Innhold
  title: text('title').notNull(),
  body: text('body').notNull(),
  category: text('category').notNull(), // 'claim', 'service', 'agreement', 'system'
  
  // Deep linking
  targetType: text('target_type'), // 'claim', 'service_visit', 'agreement'
  targetId: uuid('target_id'),
  
  // Status
  sentAt: timestamp('sent_at'),
  readAt: timestamp('read_at'),
  clickedAt: timestamp('clicked_at'),
  
  // Push result
  pushTicketId: text('push_ticket_id'),
  pushReceiptId: text('push_receipt_id'),
  pushError: text('push_error'),
  
  // Metadata
  data: jsonb('data'),
  
  ...baseFields,
});

// Indekser
// CREATE INDEX idx_notifications_user ON notifications(user_id);
// CREATE INDEX idx_notifications_read ON notifications(user_id, read_at);
```

---

## Backend: Push Service

### apps/api/src/lib/push.ts

```typescript
import Expo, { ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';
import type { Logger } from 'pino';

const expo = new Expo();

export interface PushNotification {
  to: string[];
  title: string;
  body: string;
  data?: Record<string, unknown>;
  categoryId?: string;
  sound?: 'default' | null;
  badge?: number;
}

export async function sendPushNotifications(
  notifications: PushNotification[],
  log: Logger
): Promise<ExpoPushTicket[]> {
  const messages: ExpoPushMessage[] = [];

  for (const notification of notifications) {
    for (const token of notification.to) {
      if (!Expo.isExpoPushToken(token)) {
        log.warn({ token }, 'Invalid Expo push token');
        continue;
      }

      messages.push({
        to: token,
        sound: notification.sound ?? 'default',
        title: notification.title,
        body: notification.body,
        data: notification.data,
        categoryId: notification.categoryId,
        badge: notification.badge,
      });
    }
  }

  if (messages.length === 0) {
    return [];
  }

  const chunks = expo.chunkPushNotifications(messages);
  const tickets: ExpoPushTicket[] = [];

  for (const chunk of chunks) {
    try {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...ticketChunk);
    } catch (error) {
      log.error({ error }, 'Failed to send push notifications');
    }
  }

  return tickets;
}

export async function getPushReceipts(
  ticketIds: string[],
  log: Logger
): Promise<Record<string, any>> {
  const receiptIdChunks = expo.chunkPushNotificationReceiptIds(ticketIds);
  const receipts: Record<string, any> = {};

  for (const chunk of receiptIdChunks) {
    try {
      const chunkReceipts = await expo.getPushNotificationReceiptsAsync(chunk);
      Object.assign(receipts, chunkReceipts);
    } catch (error) {
      log.error({ error }, 'Failed to get push receipts');
    }
  }

  return receipts;
}
```

---

### apps/api/src/modules/notifications/notification.templates.ts

```typescript
export interface NotificationTemplate {
  title: string;
  body: string;
}

export const templates = {
  // Claims
  claimCreated: (claimNumber: string): NotificationTemplate => ({
    title: 'Ny reklamasjon',
    body: `Reklamasjon ${claimNumber} er opprettet`,
  }),
  
  claimAssigned: (claimNumber: string): NotificationTemplate => ({
    title: 'Reklamasjon tildelt',
    body: `Du har fått tildelt reklamasjon ${claimNumber}`,
  }),
  
  claimStatusChanged: (claimNumber: string, status: string): NotificationTemplate => ({
    title: 'Statusendring',
    body: `Reklamasjon ${claimNumber} er nå: ${status}`,
  }),
  
  claimSupplierResponse: (claimNumber: string, supplierName: string): NotificationTemplate => ({
    title: 'Svar fra leverandør',
    body: `${supplierName} har svart på reklamasjon ${claimNumber}`,
  }),
  
  // Service
  serviceVisitReminder: (customerName: string, date: string): NotificationTemplate => ({
    title: 'Påminnelse: Servicebesøk',
    body: `Du har servicebesøk hos ${customerName} ${date}`,
  }),
  
  serviceVisitAssigned: (customerName: string, date: string): NotificationTemplate => ({
    title: 'Nytt servicebesøk',
    body: `Du er tildelt servicebesøk hos ${customerName} ${date}`,
  }),
  
  // Agreements
  agreementExpiring: (customerName: string, daysLeft: number): NotificationTemplate => ({
    title: 'Avtale utløper snart',
    body: `Avtalen med ${customerName} utløper om ${daysLeft} dager`,
  }),
};
```

---

### apps/api/src/modules/notifications/notifications.service.ts

```typescript
import { eq, and, isNull, desc } from 'drizzle-orm';
import type { Database } from '../../lib/db';
import type { Logger } from 'pino';
import { notifications, pushTokens, notificationPreferences } from '@myhrvold/db/schema';
import { sendPushNotifications } from '../../lib/push';
import { templates, NotificationTemplate } from './notification.templates';

export class NotificationsService {
  constructor(
    private db: Database,
    private log: Logger
  ) {}

  // Registrer push token
  async registerToken(userId: string, token: string, platform: string, deviceName?: string) {
    await this.db
      .insert(pushTokens)
      .values({ userId, token, platform, deviceName })
      .onConflictDoUpdate({
        target: pushTokens.token,
        set: { 
          userId, 
          platform, 
          deviceName,
          isActive: true,
          lastUsedAt: new Date(),
        },
      });
  }

  // Fjern push token
  async unregisterToken(token: string) {
    await this.db
      .update(pushTokens)
      .set({ isActive: false })
      .where(eq(pushTokens.token, token));
  }

  // Send notifikasjon til bruker
  async notify(
    userId: string,
    template: NotificationTemplate,
    options: {
      category: string;
      targetType?: string;
      targetId?: string;
      data?: Record<string, unknown>;
    }
  ) {
    // Sjekk brukerpreferanser
    const prefs = await this.db.query.notificationPreferences.findFirst({
      where: eq(notificationPreferences.userId, userId),
    });

    if (prefs && !prefs.pushEnabled) {
      this.log.info({ userId }, 'Push disabled for user');
      return;
    }

    // Hent aktive tokens
    const tokens = await this.db.query.pushTokens.findMany({
      where: and(
        eq(pushTokens.userId, userId),
        eq(pushTokens.isActive, true)
      ),
    });

    if (tokens.length === 0) {
      this.log.info({ userId }, 'No push tokens for user');
      return;
    }

    // Lagre notifikasjon
    const [notification] = await this.db
      .insert(notifications)
      .values({
        userId,
        title: template.title,
        body: template.body,
        category: options.category,
        targetType: options.targetType,
        targetId: options.targetId,
        data: options.data,
      })
      .returning();

    // Send push
    const tickets = await sendPushNotifications([{
      to: tokens.map(t => t.token),
      title: template.title,
      body: template.body,
      data: {
        notificationId: notification.id,
        targetType: options.targetType,
        targetId: options.targetId,
        ...options.data,
      },
    }], this.log);

    // Oppdater med ticket ID
    if (tickets.length > 0 && tickets[0].status === 'ok') {
      await this.db
        .update(notifications)
        .set({ 
          sentAt: new Date(),
          pushTicketId: (tickets[0] as any).id,
        })
        .where(eq(notifications.id, notification.id));
    }

    return notification;
  }

  // Hent brukerens notifikasjoner
  async getForUser(userId: string, limit = 50) {
    return this.db.query.notifications.findMany({
      where: and(
        eq(notifications.userId, userId),
        isNull(notifications.deletedAt)
      ),
      orderBy: [desc(notifications.createdAt)],
      limit,
    });
  }

  // Marker som lest
  async markAsRead(notificationId: string, userId: string) {
    await this.db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(
        eq(notifications.id, notificationId),
        eq(notifications.userId, userId)
      ));
  }

  // Marker alle som lest
  async markAllAsRead(userId: string) {
    await this.db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(
        eq(notifications.userId, userId),
        isNull(notifications.readAt)
      ));
  }

  // Hent antall uleste
  async getUnreadCount(userId: string): Promise<number> {
    const result = await this.db
      .select({ count: notifications.id })
      .from(notifications)
      .where(and(
        eq(notifications.userId, userId),
        isNull(notifications.readAt),
        isNull(notifications.deletedAt)
      ));
    
    return result.length;
  }
}
```

---

### apps/api/src/modules/notifications/notifications.router.ts

```typescript
import { z } from 'zod';
import { router, protectedProcedure } from '../../trpc/trpc';
import { NotificationsService } from './notifications.service';

export const notificationsRouter = router({
  // Registrer push token
  registerToken: protectedProcedure
    .input(z.object({
      token: z.string(),
      platform: z.enum(['ios', 'android', 'web']),
      deviceName: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new NotificationsService(ctx.db, ctx.log);
      await service.registerToken(ctx.user.id, input.token, input.platform, input.deviceName);
      return { success: true };
    }),

  // Fjern push token
  unregisterToken: protectedProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const service = new NotificationsService(ctx.db, ctx.log);
      await service.unregisterToken(input.token);
      return { success: true };
    }),

  // Hent notifikasjoner
  list: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(50) }).optional())
    .query(async ({ ctx, input }) => {
      const service = new NotificationsService(ctx.db, ctx.log);
      return service.getForUser(ctx.user.id, input?.limit);
    }),

  // Antall uleste
  unreadCount: protectedProcedure
    .query(async ({ ctx }) => {
      const service = new NotificationsService(ctx.db, ctx.log);
      return service.getUnreadCount(ctx.user.id);
    }),

  // Marker som lest
  markAsRead: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const service = new NotificationsService(ctx.db, ctx.log);
      await service.markAsRead(input.id, ctx.user.id);
      return { success: true };
    }),

  // Marker alle som lest
  markAllAsRead: protectedProcedure
    .mutation(async ({ ctx }) => {
      const service = new NotificationsService(ctx.db, ctx.log);
      await service.markAllAsRead(ctx.user.id);
      return { success: true };
    }),

  // Hent/oppdater preferanser
  preferences: protectedProcedure
    .query(async ({ ctx }) => {
      // TODO: Implementer
      return {};
    }),

  updatePreferences: protectedProcedure
    .input(z.object({
      pushEnabled: z.boolean().optional(),
      emailEnabled: z.boolean().optional(),
      claimsNew: z.boolean().optional(),
      claimsStatusChange: z.boolean().optional(),
      // ... flere felter
    }))
    .mutation(async ({ ctx, input }) => {
      // TODO: Implementer
      return { success: true };
    }),
});

export type NotificationsRouter = typeof notificationsRouter;
```

---

## Frontend: Push Registration

### apps/mobile/src/lib/notifications.ts

```typescript
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { trpc } from './api';

// Konfigurer notifikasjonshåndtering
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    console.log('Push notifications only work on physical devices');
    return null;
  }

  // Sjekk/be om tillatelse
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Permission not granted for push notifications');
    return null;
  }

  // Hent token
  const tokenData = await Notifications.getExpoPushTokenAsync({
    projectId: process.env.EXPO_PROJECT_ID,
  });

  // Android-spesifikk kanal
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Standard',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#003366',
    });
  }

  return tokenData.data;
}

export function addNotificationListener(
  callback: (notification: Notifications.Notification) => void
) {
  return Notifications.addNotificationReceivedListener(callback);
}

export function addNotificationResponseListener(
  callback: (response: Notifications.NotificationResponse) => void
) {
  return Notifications.addNotificationResponseReceivedListener(callback);
}

export async function setBadgeCount(count: number) {
  await Notifications.setBadgeCountAsync(count);
}
```

---

### apps/mobile/src/hooks/usePushNotifications.ts

```typescript
import { useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { 
  registerForPushNotifications, 
  addNotificationListener,
  addNotificationResponseListener,
} from '../lib/notifications';
import { trpc } from '../lib/api';
import { useAuthStore } from '../stores/auth.store';

export function usePushNotifications() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const notificationListener = useRef<Notifications.Subscription>();
  const responseListener = useRef<Notifications.Subscription>();

  const registerToken = trpc.notifications.registerToken.useMutation();

  useEffect(() => {
    if (!isAuthenticated) return;

    // Registrer for push
    registerForPushNotifications().then(token => {
      if (token) {
        registerToken.mutate({
          token,
          platform: Platform.OS as 'ios' | 'android' | 'web',
          deviceName: undefined,
        });
      }
    });

    // Lytt på innkommende notifikasjoner (forgrunn)
    notificationListener.current = addNotificationListener(notification => {
      console.log('Notification received:', notification);
    });

    // Lytt på tap på notifikasjon
    responseListener.current = addNotificationResponseListener(response => {
      const data = response.notification.request.content.data;
      
      // Deep link basert på type
      if (data.targetType === 'claim' && data.targetId) {
        router.push(`/claims/${data.targetId}`);
      } else if (data.targetType === 'service_visit' && data.targetId) {
        router.push(`/service-visits/${data.targetId}`);
      }
    });

    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, [isAuthenticated]);
}
```

---

### apps/mobile/app/_layout.tsx (oppdatert)

```tsx
import { usePushNotifications } from '../src/hooks/usePushNotifications';

export default function RootLayout() {
  // ... eksisterende kode

  // Aktiver push notifications
  usePushNotifications();

  // ... resten av layout
}
```

---

## Notifications UI

### apps/mobile/src/features/notifications/NotificationsScreen.tsx

```tsx
import { View, Text, FlatList, Pressable, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { trpc } from '../../lib/api';
import { Bell, Check, CheckCheck } from 'lucide-react-native';
import { formatDistanceToNow } from 'date-fns';
import { nb } from 'date-fns/locale';

export function NotificationsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const utils = trpc.useUtils();

  const { data: notifications, isLoading, refetch, isRefetching } = 
    trpc.notifications.list.useQuery();

  const markAsRead = trpc.notifications.markAsRead.useMutation({
    onSuccess: () => utils.notifications.list.invalidate(),
  });

  const markAllAsRead = trpc.notifications.markAllAsRead.useMutation({
    onSuccess: () => utils.notifications.list.invalidate(),
  });

  const handlePress = (notification: any) => {
    // Marker som lest
    if (!notification.readAt) {
      markAsRead.mutate({ id: notification.id });
    }

    // Navigate
    if (notification.targetType === 'claim' && notification.targetId) {
      router.push(`/claims/${notification.targetId}`);
    }
  };

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-primary pt-12 pb-6 px-4">
        <View className="flex-row items-center justify-between">
          <Text className="text-white text-2xl font-bold">Varsler</Text>
          <Pressable 
            onPress={() => markAllAsRead.mutate()}
            className="flex-row items-center"
          >
            <CheckCheck size={20} color="white" />
            <Text className="text-white ml-1">Marker alle lest</Text>
          </Pressable>
        </View>
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => handlePress(item)}
            className={`p-4 border-b border-gray-100 ${
              item.readAt ? 'bg-white' : 'bg-blue-50'
            }`}
          >
            <View className="flex-row items-start">
              <View className={`w-2 h-2 rounded-full mt-2 mr-3 ${
                item.readAt ? 'bg-transparent' : 'bg-primary'
              }`} />
              <View className="flex-1">
                <Text className="font-semibold text-gray-900">{item.title}</Text>
                <Text className="text-gray-600 mt-1">{item.body}</Text>
                <Text className="text-gray-400 text-xs mt-2">
                  {formatDistanceToNow(new Date(item.createdAt), { 
                    addSuffix: true, 
                    locale: nb 
                  })}
                </Text>
              </View>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          <View className="items-center py-12">
            <Bell size={48} color="#9ca3af" />
            <Text className="text-gray-500 mt-4">Ingen varsler</Text>
          </View>
        }
      />
    </View>
  );
}
```

---

## Notification Badge

### apps/mobile/src/components/NotificationBadge.tsx

```tsx
import { View, Text } from 'react-native';
import { trpc } from '../lib/api';

export function NotificationBadge() {
  const { data: count } = trpc.notifications.unreadCount.useQuery(undefined, {
    refetchInterval: 30000, // Oppdater hvert 30. sekund
  });

  if (!count || count === 0) return null;

  return (
    <View className="absolute -top-1 -right-1 bg-red-500 rounded-full min-w-[18px] h-[18px] items-center justify-center">
      <Text className="text-white text-xs font-bold">
        {count > 99 ? '99+' : count}
      </Text>
    </View>
  );
}
```

---

## Package.json dependencies

```json
{
  "dependencies": {
    "expo-notifications": "~0.29.0",
    "expo-device": "~7.0.0"
  }
}
```

**Backend:**
```json
{
  "dependencies": {
    "expo-server-sdk": "^3.7.0"
  }
}
```

---

## Trigger Notifications fra Claims Service

### apps/api/src/modules/claims/claims.service.ts (oppdatert)

```typescript
import { NotificationsService } from '../notifications/notifications.service';
import { templates } from '../notifications/notification.templates';

export class ClaimsService {
  // ... eksisterende kode

  async create(data: CreateClaimInput, createdBy: string) {
    const claim = await this.repo.create({ ...data, createdBy });
    
    // Send notifikasjon til ansvarlig
    if (claim.assignedToId) {
      const notificationService = new NotificationsService(this.db, this.log);
      await notificationService.notify(
        claim.assignedToId,
        templates.claimAssigned(claim.claimNumber),
        {
          category: 'claim',
          targetType: 'claim',
          targetId: claim.id,
        }
      );
    }

    return claim;
  }

  async updateStatus(id: string, status: string, userId: string) {
    const claim = await this.repo.update(id, { status });
    
    // Send notifikasjon ved statusendring
    if (claim.assignedToId && claim.assignedToId !== userId) {
      const notificationService = new NotificationsService(this.db, this.log);
      await notificationService.notify(
        claim.assignedToId,
        templates.claimStatusChanged(claim.claimNumber, status),
        {
          category: 'claim',
          targetType: 'claim',
          targetId: claim.id,
        }
      );
    }

    return claim;
  }
}
```

---

## Sjekkliste

- [ ] Database: push_tokens, notification_preferences, notifications
- [ ] Push service med Expo Server SDK
- [ ] Notification templates (norsk)
- [ ] Notifications router med alle endpoints
- [ ] Frontend: Token registrering
- [ ] Frontend: Notification listeners
- [ ] Deep linking fra notifikasjon
- [ ] Notifications liste-skjerm
- [ ] Notification badge
- [ ] Preferanser-skjerm
- [ ] Trigger fra claims service

---

## Neste fase

Gå til **FASE 20: AI Dokumentsøk** for intelligent søk i teknisk dokumentasjon.
