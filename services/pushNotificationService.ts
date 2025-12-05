/**
 * Push Notification Service for Helpy App
 * 
 * Handles Web Push API subscription management:
 * - Requesting notification permission
 * - Subscribing to push notifications
 * - Storing subscriptions in Supabase
 * - Unsubscribing when disabled
 */

import { supabase } from './supabase';

// VAPID public key - this should match the one used in the edge function
// Generate with: npx web-push generate-vapid-keys
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

// Service worker path
const SW_PATH = '/sw-push.js';

/**
 * Check if push notifications are supported in this browser
 */
export function isPushSupported(): boolean {
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/**
 * Get the current notification permission state
 */
export function getNotificationPermission(): NotificationPermission {
  if (!('Notification' in window)) {
    return 'denied';
  }
  return Notification.permission;
}

/**
 * Request notification permission from the user
 * Returns the permission state after the request
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    console.warn('[Push] Notifications not supported');
    return 'denied';
  }

  // If already granted or denied, return current state
  if (Notification.permission !== 'default') {
    return Notification.permission;
  }

  // Request permission
  const permission = await Notification.requestPermission();
  console.log('[Push] Permission result:', permission);
  return permission;
}

/**
 * Register the service worker for push notifications
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    console.warn('[Push] Service workers not supported');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register(SW_PATH, {
      scope: '/'
    });
    console.log('[Push] Service worker registered:', registration);
    return registration;
  } catch (error) {
    console.error('[Push] Service worker registration failed:', error);
    return null;
  }
}

/**
 * Get the existing service worker registration
 */
export async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration(SW_PATH);
    return registration || null;
  } catch (error) {
    console.error('[Push] Failed to get service worker registration:', error);
    return null;
  }
}

/**
 * Convert a base64 string to Uint8Array (for VAPID key)
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Subscribe to push notifications
 * Returns the subscription or null if failed
 */
export async function subscribeToPush(
  userId: string,
  householdId: string
): Promise<PushSubscription | null> {
  if (!isPushSupported()) {
    console.warn('[Push] Push not supported');
    return null;
  }

  if (!VAPID_PUBLIC_KEY) {
    console.error('[Push] VAPID_PUBLIC_KEY not configured');
    return null;
  }

  try {
    // Request permission first
    const permission = await requestNotificationPermission();
    if (permission !== 'granted') {
      console.warn('[Push] Permission not granted:', permission);
      return null;
    }

    // Get or register service worker
    let registration = await getServiceWorkerRegistration();
    if (!registration) {
      registration = await registerServiceWorker();
    }

    if (!registration) {
      console.error('[Push] No service worker registration');
      return null;
    }

    // Wait for service worker to be ready
    await navigator.serviceWorker.ready;

    // Check for existing subscription
    let subscription = await registration.pushManager.getSubscription();

    // If no subscription, create one
    if (!subscription) {
      console.log('[Push] Creating new subscription...');
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });
      console.log('[Push] New subscription created:', subscription.endpoint);
    } else {
      console.log('[Push] Using existing subscription:', subscription.endpoint);
    }

    // Save subscription to Supabase
    await saveSubscriptionToDatabase(subscription, userId, householdId);

    return subscription;
  } catch (error) {
    console.error('[Push] Failed to subscribe:', error);
    return null;
  }
}

/**
 * Save push subscription to Supabase database
 */
async function saveSubscriptionToDatabase(
  subscription: PushSubscription,
  userId: string,
  householdId: string
): Promise<void> {
  const subscriptionJson = subscription.toJSON();
  
  if (!subscriptionJson.endpoint || !subscriptionJson.keys) {
    throw new Error('Invalid subscription data');
  }

  const data = {
    user_id: userId,
    household_id: householdId,
    endpoint: subscriptionJson.endpoint,
    p256dh_key: subscriptionJson.keys.p256dh,
    auth_key: subscriptionJson.keys.auth,
    user_agent: navigator.userAgent,
    updated_at: new Date().toISOString()
  };

  // Upsert - update if exists (same user + endpoint), insert if not
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert(data, {
      onConflict: 'user_id,endpoint',
      ignoreDuplicates: false
    });

  if (error) {
    console.error('[Push] Failed to save subscription:', error);
    throw error;
  }

  console.log('[Push] Subscription saved to database');
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribeFromPush(userId: string): Promise<boolean> {
  try {
    const registration = await getServiceWorkerRegistration();
    if (!registration) {
      console.log('[Push] No service worker registration to unsubscribe');
      return true;
    }

    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      // Unsubscribe from push manager
      await subscription.unsubscribe();
      console.log('[Push] Unsubscribed from push manager');

      // Remove from database
      const { error } = await supabase
        .from('push_subscriptions')
        .delete()
        .eq('user_id', userId)
        .eq('endpoint', subscription.endpoint);

      if (error) {
        console.error('[Push] Failed to remove subscription from database:', error);
      }
    }

    return true;
  } catch (error) {
    console.error('[Push] Failed to unsubscribe:', error);
    return false;
  }
}

/**
 * Remove all subscriptions for a user (e.g., on logout)
 */
export async function removeAllSubscriptions(userId: string): Promise<void> {
  try {
    // Remove from database
    const { error } = await supabase
      .from('push_subscriptions')
      .delete()
      .eq('user_id', userId);

    if (error) {
      console.error('[Push] Failed to remove subscriptions:', error);
    }

    // Unsubscribe from push manager if possible
    const registration = await getServiceWorkerRegistration();
    if (registration) {
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
      }
    }

    console.log('[Push] All subscriptions removed for user');
  } catch (error) {
    console.error('[Push] Failed to remove all subscriptions:', error);
  }
}

/**
 * Check if user has an active push subscription
 */
export async function hasActiveSubscription(userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('push_subscriptions')
      .select('id')
      .eq('user_id', userId)
      .limit(1);

    if (error) {
      console.error('[Push] Failed to check subscription:', error);
      return false;
    }

    return data && data.length > 0;
  } catch (error) {
    console.error('[Push] Failed to check subscription:', error);
    return false;
  }
}

/**
 * Initialize push notifications on app load
 * This registers the service worker but doesn't subscribe until user enables notifications
 */
export async function initializePushNotifications(): Promise<void> {
  if (!isPushSupported()) {
    console.log('[Push] Push notifications not supported in this browser');
    return;
  }

  // Register service worker in the background
  const registration = await registerServiceWorker();
  if (registration) {
    console.log('[Push] Push notification service initialized');
  }
}

/**
 * Send a test notification (for debugging)
 */
export async function sendTestNotification(): Promise<void> {
  if (Notification.permission !== 'granted') {
    console.warn('[Push] Cannot send test notification - permission not granted');
    return;
  }

  const registration = await getServiceWorkerRegistration();
  if (!registration) {
    console.warn('[Push] No service worker registration');
    return;
  }

  await registration.showNotification('Helpy Test', {
    body: 'Push notifications are working! 🎉',
    icon: '/icons/icon-192.png',
    badge: '/icons/favicon-32.png',
    tag: 'test-notification'
  });
}

