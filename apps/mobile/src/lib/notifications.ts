import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PUSH_TOKEN_KEY = '@push_token';

// Configure notification handling
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Register for push notifications
 */
export async function registerForPushNotifications(): Promise<string | null> {
  // Check if physical device
  if (!Device.isDevice) {
    console.log('Push notifications require a physical device');
    return null;
  }

  // Check permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Push notification permission denied');
    return null;
  }

  // Get Expo push token
  try {
    const token = await Notifications.getExpoPushTokenAsync({
      projectId: process.env.EXPO_PROJECT_ID,
    });

    // Store token locally
    await AsyncStorage.setItem(PUSH_TOKEN_KEY, token.data);

    // Configure Android channel
    if (Platform.OS === 'android') {
      await setupAndroidChannels();
    }

    return token.data;
  } catch (error) {
    console.error('Failed to get push token:', error);
    return null;
  }
}

/**
 * Get stored push token
 */
export async function getStoredPushToken(): Promise<string | null> {
  return AsyncStorage.getItem(PUSH_TOKEN_KEY);
}

/**
 * Setup Android notification channels
 */
async function setupAndroidChannels() {
  // Claims channel
  await Notifications.setNotificationChannelAsync('claims', {
    name: 'Reklamasjoner',
    description: 'Varsler om reklamasjoner',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#003366',
  });

  // Visits channel
  await Notifications.setNotificationChannelAsync('visits', {
    name: 'Besok',
    description: 'Varsler om servicebesok',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#003366',
  });

  // Chat channel
  await Notifications.setNotificationChannelAsync('chat', {
    name: 'Chat',
    description: 'Chatmeldinger',
    importance: Notifications.AndroidImportance.DEFAULT,
  });

  // Mentions channel
  await Notifications.setNotificationChannelAsync('mentions', {
    name: 'Omtaler',
    description: 'Nar du blir nevnt',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
  });

  // Default channel
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Generelt',
    description: 'Generelle varsler',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

/**
 * Add notification listener
 */
export function addNotificationListener(
  callback: (notification: Notifications.Notification) => void
) {
  return Notifications.addNotificationReceivedListener(callback);
}

/**
 * Add notification response listener (when user taps notification)
 */
export function addNotificationResponseListener(
  callback: (response: Notifications.NotificationResponse) => void
) {
  return Notifications.addNotificationResponseReceivedListener(callback);
}

/**
 * Get notification that launched the app
 */
export async function getInitialNotification() {
  return Notifications.getLastNotificationResponseAsync();
}

/**
 * Schedule local notification
 */
export async function scheduleLocalNotification(
  title: string,
  body: string,
  data?: Record<string, any>,
  trigger?: Notifications.NotificationTriggerInput
) {
  return Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
      sound: true,
    },
    trigger: trigger || null, // null = immediate
  });
}

/**
 * Cancel all scheduled notifications
 */
export async function cancelAllNotifications() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/**
 * Get badge count
 */
export async function getBadgeCount(): Promise<number> {
  return Notifications.getBadgeCountAsync();
}

/**
 * Set badge count
 */
export async function setBadgeCount(count: number) {
  await Notifications.setBadgeCountAsync(count);
}

/**
 * Clear badge
 */
export async function clearBadge() {
  await Notifications.setBadgeCountAsync(0);
}

/**
 * Handle notification navigation
 */
export function handleNotificationNavigation(
  data: Record<string, any>,
  navigate: (route: string, params?: any) => void
) {
  switch (data.type) {
    case 'claim':
      navigate('/(dashboard)/claims/[id]', { id: data.claimId });
      break;
    case 'visit':
      navigate('/(dashboard)/visits/[id]', { id: data.visitId });
      break;
    case 'chat':
      navigate('/(dashboard)/chat/[channelId]', { channelId: data.channelId });
      break;
    case 'forum':
      navigate('/(dashboard)/forum/[id]', { id: data.threadId });
      break;
    default:
      // Navigate to dashboard
      navigate('/(dashboard)');
  }
}
