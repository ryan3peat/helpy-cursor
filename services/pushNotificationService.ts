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

/**
 * Resolve a user ID (which may be a Clerk ID) to the actual Supabase UUID
 * This is necessary because the app uses Clerk IDs as user identifiers,
 * but the database and edge functions use Supabase UUIDs.
 */
async function resolveSupabaseUserId(userId: string, householdId: string): Promise<string | null> {
  console.log(`[Push] Resolving user ID: ${userId} in household: ${householdId}`);
  
  try {
    // First try: Query users in the household
    const { data, error } = await supabase
      .from('users')
      .select('id, clerk_id')
      .eq('household_id', householdId);

    if (error) {
      console.error('[Push] Failed to query users:', error);
      // Fall through to try direct lookup
    }
    
    if (data && data.length > 0) {
      console.log(`[Push] Found ${data.length} users in household`);
      
      // Check if it's a clerk_id (active users)
      const userByClerkId = data.find(u => u.clerk_id === userId);
      if (userByClerkId) {
        console.log(`[Push] Resolved clerk_id ${userId} to UUID ${userByClerkId.id}`);
        return userByClerkId.id;
      }

      // Check if it's already a Supabase UUID (pending users)
      const userByUuid = data.find(u => u.id === userId);
      if (userByUuid) {
        console.log(`[Push] ID ${userId} is already a Supabase UUID`);
        return userId;
      }
      
      console.log('[Push] User not found in household users list, trying direct lookup...');
    }
    
    // Second try: Direct lookup by clerk_id (in case household query failed or user not in results)
    const { data: directUser, error: directError } = await supabase
      .from('users')
      .select('id, clerk_id, household_id')
      .eq('clerk_id', userId)
      .maybeSingle();
    
    if (directUser && !directError) {
      console.log(`[Push] Found user by direct clerk_id lookup: UUID ${directUser.id}`);
      // Verify household matches
      if (directUser.household_id !== householdId) {
        console.warn(`[Push] User household mismatch: expected ${householdId}, got ${directUser.household_id}`);
      }
      return directUser.id;
    }

    console.error(`[Push] Could not find user with ID: ${userId}`, { 
      householdId, 
      directError,
      usersInHousehold: data?.length || 0 
    });
    return null;
  } catch (err) {
    console.error('[Push] Error resolving user ID:', err);
    return null;
  }
}

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
    // getRegistration() expects a scope URL, not a script path
    // Since we register with scope '/', we should look for registrations with scope '/'
    // Or we can get all registrations and find the one that matches
    const registrations = await navigator.serviceWorker.getRegistrations();
    const registration = registrations.find(reg => {
      // Check if this registration's script matches our service worker
      return reg.active?.scriptURL?.endsWith(SW_PATH) || 
             reg.waiting?.scriptURL?.endsWith(SW_PATH) ||
             reg.installing?.scriptURL?.endsWith(SW_PATH);
    });
    
    // If not found, try getting registration by scope (since we register with scope '/')
    if (!registration) {
      const scopeRegistration = await navigator.serviceWorker.getRegistration('/');
      return scopeRegistration || null;
    }
    
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
    // Request permission only if not already granted
    let permission = getNotificationPermission();
    if (permission === 'default') {
      permission = await requestNotificationPermission();
    }
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
    try {
      await saveSubscriptionToDatabase(subscription, userId, householdId);
      console.log('[Push] Subscription successfully saved to database');
    } catch (saveError) {
      console.error('[Push] Failed to save subscription to database:', saveError);
      // Still return the subscription even if save fails (user can retry)
      // But log the error so we know what went wrong
    }

    return subscription;
  } catch (error) {
    console.error('[Push] Failed to subscribe:', error);
    console.error('[Push] Error details:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
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

  // IMPORTANT: Resolve to Supabase UUID (userId may be a Clerk ID)
  const supabaseUserId = await resolveSupabaseUserId(userId, householdId);
  
  // Validate that we got a valid UUID, not a Clerk ID or other invalid value
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!supabaseUserId || !uuidRegex.test(supabaseUserId)) {
    console.error('[Push] Invalid user ID resolution:', { input: userId, resolved: supabaseUserId });
    throw new Error(`Could not resolve user ID to valid Supabase UUID: ${userId} -> ${supabaseUserId}`);
  }

  const data = {
    user_id: supabaseUserId,  // Use Supabase UUID, not Clerk ID
    household_id: householdId,
    endpoint: subscriptionJson.endpoint,
    p256dh_key: subscriptionJson.keys.p256dh,
    auth_key: subscriptionJson.keys.auth,
    user_agent: navigator.userAgent,
    updated_at: new Date().toISOString()
  };

  // Upsert - update if exists (same user + endpoint), insert if not
  console.log('[Push] Saving subscription to database:', {
    user_id: supabaseUserId,
    household_id: householdId,
    endpoint: data.endpoint.substring(0, 50) + '...',
    has_p256dh: !!data.p256dh_key,
    has_auth: !!data.auth_key
  });

  // Try upsert - if unique constraint exists, it will update; otherwise insert
  const { data: savedData, error } = await supabase
    .from('push_subscriptions')
    .upsert(data, {
      onConflict: 'user_id,endpoint',  // Matches UNIQUE(user_id, endpoint) constraint
      ignoreDuplicates: false
    })
    .select();

  if (error) {
    console.error('[Push] Failed to save subscription:', error);
    console.error('[Push] Error code:', error.code);
    console.error('[Push] Error message:', error.message);
    console.error('[Push] Error details:', error.details);
    throw error;
  }

  console.log('[Push] Subscription saved to database successfully:', savedData ? '✅' : '⚠️ No data returned');
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribeFromPush(userId: string, householdId?: string): Promise<boolean> {
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

      // Try to resolve user ID if householdId provided
      let supabaseUserId = userId;
      if (householdId) {
        const resolved = await resolveSupabaseUserId(userId, householdId);
        if (resolved) {
          supabaseUserId = resolved;
        }
      }

      // Remove from database (try both resolved ID and original ID for cleanup)
      const { error } = await supabase
        .from('push_subscriptions')
        .delete()
        .eq('user_id', supabaseUserId)
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
export async function removeAllSubscriptions(userId: string, householdId?: string): Promise<void> {
  try {
    // Try to resolve user ID if householdId provided
    let supabaseUserId = userId;
    if (householdId) {
      const resolved = await resolveSupabaseUserId(userId, householdId);
      if (resolved) {
        supabaseUserId = resolved;
      }
    }

    // Remove from database
    const { error } = await supabase
      .from('push_subscriptions')
      .delete()
      .eq('user_id', supabaseUserId);

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
 * Note: Also checks browser's PushManager for local subscription
 */
export async function hasActiveSubscription(userId: string, householdId?: string): Promise<boolean> {
  try {
    // First, check if we have a browser-side subscription
    const registration = await getServiceWorkerRegistration();
    if (registration) {
      const browserSub = await registration.pushManager.getSubscription();
      if (browserSub) {
        console.log('[Push] Found active browser subscription');
        
        // Verify it's in the database too
        // Try to resolve to Supabase UUID if householdId provided
        let supabaseUserId = userId;
        if (householdId) {
          const resolved = await resolveSupabaseUserId(userId, householdId);
          if (resolved) {
            supabaseUserId = resolved;
          }
        }
        
        const { data } = await supabase
          .from('push_subscriptions')
          .select('id')
          .eq('user_id', supabaseUserId)
          .eq('endpoint', browserSub.endpoint)
          .limit(1);
        
        if (data && data.length > 0) {
          console.log('[Push] Browser subscription is also in database');
          return true;
        }
        
        // Browser has subscription but it's not in our database
        // This could happen if DB was cleared - return false so we re-save it
        console.log('[Push] Browser subscription not found in database');
        return false;
      }
    }

    // No browser subscription found
    return false;
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
 * Auto-subscribe to push notifications if:
 * 1. User has notificationsEnabled = true
 * 2. Push is supported
 * 3. Permission is already granted (or will be requested)
 * 4. No active subscription exists in database
 * 
 * This should be called when the app loads and currentUser is available.
 */
export async function autoSubscribeIfNeeded(
  userId: string,
  householdId: string,
  notificationsEnabled: boolean
): Promise<boolean> {
  console.log('[Push] Checking auto-subscribe...', { userId, householdId, notificationsEnabled });
  
  // Only proceed if notifications are enabled
  if (!notificationsEnabled) {
    console.log('[Push] Auto-subscribe skipped: notifications not enabled');
    return false;
  }

  // Check if push is supported
  if (!isPushSupported()) {
    console.log('[Push] Auto-subscribe skipped: push not supported');
    return false;
  }

  // Check if VAPID key is configured
  if (!VAPID_PUBLIC_KEY) {
    console.error('[Push] Auto-subscribe skipped: VAPID key not configured');
    console.error('[Push] VAPID_PUBLIC_KEY from env:', import.meta.env.VITE_VAPID_PUBLIC_KEY ? 'EXISTS' : 'MISSING');
    return false;
  }
  
  console.log('[Push] VAPID public key length:', VAPID_PUBLIC_KEY.length, 'characters');

  try {
    // Check if user already has an active subscription in the database
    const hasSubscription = await hasActiveSubscription(userId, householdId);
    if (hasSubscription) {
      console.log('[Push] Auto-subscribe skipped: already has active subscription');
      return true;
    }

    // Check current permission state
    const permission = getNotificationPermission();
    if (permission === 'denied') {
      console.log('[Push] Auto-subscribe skipped: permission denied');
      return false;
    }

    // If permission is default, request it once here (user has notifications enabled)
    let effectivePermission = permission;
    if (effectivePermission === 'default') {
      console.log('[Push] Requesting notification permission for auto-subscribe...');
      effectivePermission = await requestNotificationPermission();
    }

    if (effectivePermission !== 'granted') {
      console.log('[Push] Auto-subscribe skipped: permission not granted (current:', effectivePermission, ')');
      return false;
    }

    // Subscribe to push notifications without prompting (permission already granted)
    console.log('[Push] Auto-subscribing user to push notifications...');
    const subscription = await subscribeToPush(userId, householdId);
    
    if (subscription) {
      console.log('[Push] Auto-subscribe successful!');
      return true;
    } else {
      console.log('[Push] Auto-subscribe failed: no subscription returned');
      return false;
    }
  } catch (error) {
    console.error('[Push] Auto-subscribe error:', error);
    return false;
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

/**
 * Diagnostic function to check push notification setup
 * Call this from browser console: window.helpyDebugPush()
 */
export async function debugPushNotifications(userId?: string, householdId?: string): Promise<void> {
  console.log('=== PUSH NOTIFICATION DIAGNOSTICS ===');
  
  // 1. Check VAPID key
  console.log('1. VAPID Public Key:', VAPID_PUBLIC_KEY ? `✅ Set (${VAPID_PUBLIC_KEY.length} chars)` : '❌ MISSING');
  console.log('   From env:', import.meta.env.VITE_VAPID_PUBLIC_KEY ? '✅' : '❌');
  
  // 2. Check browser support
  console.log('2. Browser Support:', isPushSupported() ? '✅ Supported' : '❌ Not supported');
  
  // 3. Check permission
  const permission = getNotificationPermission();
  console.log('3. Notification Permission:', permission);
  
  // 4. Check service worker
  const registration = await getServiceWorkerRegistration();
  console.log('4. Service Worker:', registration ? '✅ Registered' : '❌ Not registered');
  
  if (registration) {
    const subscription = await registration.pushManager.getSubscription();
    console.log('5. Browser Subscription:', subscription ? '✅ Exists' : '❌ None');
    if (subscription) {
      console.log('   Endpoint:', subscription.endpoint.substring(0, 50) + '...');
    }
  }
  
  // 5. Check database subscriptions
  if (userId && householdId) {
    console.log('6. Checking database subscriptions...');
    const supabaseUserId = await resolveSupabaseUserId(userId, householdId);
    console.log('   User ID resolved:', supabaseUserId ? `✅ ${supabaseUserId}` : '❌ Failed');
    
    if (supabaseUserId) {
      const { data, error } = await supabase
        .from('push_subscriptions')
        .select('*')
        .eq('user_id', supabaseUserId);
      
      if (error) {
        console.log('   Database query error:', error);
      } else {
        console.log(`   Database subscriptions: ${data?.length || 0} found`);
        if (data && data.length > 0) {
          data.forEach((sub, i) => {
            console.log(`   [${i + 1}] Endpoint: ${sub.endpoint.substring(0, 50)}...`);
          });
        }
      }
    }
  }
  
  console.log('=== END DIAGNOSTICS ===');
}

// Make it available globally for debugging
if (typeof window !== 'undefined') {
  (window as any).helpyDebugPush = debugPushNotifications;
}


