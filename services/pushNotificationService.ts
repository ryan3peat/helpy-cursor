/**
 * Push Notification Service for Helpy App
 * 
 * Handles Web Push API subscription management:
 * - Requesting notification permission
 * - Subscribing to push notifications
 * - Storing subscriptions in Supabase
 * - Unsubscribing when disabled
 * 
 * IMPORTANT: This service handles the mapping between Clerk IDs (used in the app)
 * and Supabase UUIDs (used in the database). The push_subscriptions table requires
 * Supabase UUIDs for the user_id column.
 */

import { supabase } from './supabase';
import { getCachedSupabaseUuid, isUserCachePopulated, getUserCacheStats } from './supabaseService';
import { getAuthenticatedSupabaseClient } from '../contexts/SupabaseContext';
import { getDeviceId } from '../utils/pwaUtils';

// ============================================================================
// HELPER: Get authenticated Supabase client (for RLS) or fallback to default
// ============================================================================
function getSupabaseClient() {
  return getAuthenticatedSupabaseClient() || supabase;
}

// ============================================================================
// ID VALIDATION HELPERS
// ============================================================================

/**
 * Check if a string is a valid UUID format
 */
function isValidUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

/**
 * Check if a string looks like a Clerk ID (starts with user_)
 */
function isClerkId(id: string): boolean {
  return id && typeof id === 'string' && id.startsWith('user_');
}

/**
 * Get ID type for logging
 */
function getIdType(id: string): string {
  if (!id || typeof id !== 'string') return 'Invalid/Undefined';
  if (isValidUuid(id)) return 'UUID';
  if (isClerkId(id)) return 'Clerk ID';
  return 'Unknown';
}

// ============================================================================
// USER ID RESOLUTION
// ============================================================================

/**
 * Resolve a user ID (which may be a Clerk ID) to the actual Supabase UUID
 * This is necessary because the app uses Clerk IDs as user identifiers,
 * but the database and edge functions use Supabase UUIDs.
 * 
 * Resolution order:
 * 1. Check if already a valid UUID that exists in the database
 * 2. Check the supabaseService cache (populated when users are loaded)
 * 3. Query database by clerk_id
 * 4. Query database directly by id
 */
async function resolveSupabaseUserId(userId: string, householdId: string): Promise<string | null> {
  const idType = getIdType(userId);
  console.log(`[Push] Resolving user ID: ${userId} (${idType}) in household: ${householdId}`);
  
  try {
    // OPTIMIZATION: If it's already a valid UUID, verify it exists before returning
    if (isValidUuid(userId)) {
      // Quick check if this UUID exists as a user
      const { data: existingUser, error: existsError } = await getSupabaseClient()
        .from('users')
        .select('id')
        .eq('id', userId)
        .eq('household_id', householdId)
        .maybeSingle();
      
      if (existingUser && !existsError) {
        console.log(`[Push] ✅ ID ${userId} is already a valid Supabase UUID`);
        return userId;
      }
      // UUID format but doesn't exist in database - might be stale, continue with other methods
      console.log(`[Push] ⚠️ UUID format but not found in database, trying other methods...`);
    }
    
    // Check the supabaseService cache first (fast, no DB query)
    const cachedUuid = getCachedSupabaseUuid(userId);
    if (cachedUuid !== userId && isValidUuid(cachedUuid)) {
      console.log(`[Push] ✅ Found cached mapping: ${userId} -> ${cachedUuid}`);
      return cachedUuid;
    }
    
    // Query users in the household
    const { data, error } = await getSupabaseClient()
      .from('users')
      .select('id, clerk_id')
      .eq('household_id', householdId);

    if (error) {
      console.error('[Push] ❌ Failed to query users:', error);
      // Fall through to try direct lookup
    }
    
    if (data && data.length > 0) {
      console.log(`[Push] Found ${data.length} users in household`);
      
      // Check if it's a clerk_id (active users)
      const userByClerkId = data.find(u => u.clerk_id === userId);
      if (userByClerkId) {
        console.log(`[Push] ✅ Resolved clerk_id ${userId} to UUID ${userByClerkId.id}`);
        return userByClerkId.id;
      }

      // Check if it's already a Supabase UUID (pending users)
      const userByUuid = data.find(u => u.id === userId);
      if (userByUuid) {
        console.log(`[Push] ✅ ID ${userId} found as Supabase UUID in household`);
        return userId;
      }
      
      console.log('[Push] User not found in household users list, trying direct lookup...');
    }
    
    // Direct lookup by clerk_id (in case household query failed or user not in results)
    const { data: directUser, error: directError } = await getSupabaseClient()
      .from('users')
      .select('id, clerk_id, household_id')
      .eq('clerk_id', userId)
      .maybeSingle();
    
    if (directUser && !directError) {
      console.log(`[Push] ✅ Found user by direct clerk_id lookup: UUID ${directUser.id}`);
      // Verify household matches
      if (directUser.household_id !== householdId) {
        console.warn(`[Push] ⚠️ User household mismatch: expected ${householdId}, got ${directUser.household_id}`);
        // Still return the ID, but log the mismatch for debugging
      }
      return directUser.id;
    }

    // Last resort: Direct lookup by id (in case it's a UUID that wasn't in the household query)
    if (!isClerkId(userId)) {
      const { data: directById, error: directByIdError } = await supabase
        .from('users')
        .select('id, household_id')
        .eq('id', userId)
        .maybeSingle();
      
      if (directById && !directByIdError) {
        console.log(`[Push] ✅ Found user by direct id lookup: ${directById.id}`);
        if (directById.household_id !== householdId) {
          console.warn(`[Push] ⚠️ User household mismatch: expected ${householdId}, got ${directById.household_id}`);
        }
        return directById.id;
      }
    }

    console.error(`[Push] ❌ Could not resolve user ID: ${userId}`, { 
      idType,
      householdId, 
      directError,
      usersInHousehold: data?.length || 0 
    });
    return null;
  } catch (err) {
    console.error('[Push] ❌ Error resolving user ID:', err);
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

// ============================================================================
// NOTIFICATION CAPABILITY CHECK - Single Source of Truth
// ============================================================================
// This is the definitive check for whether notifications will ACTUALLY work.
// Used to determine bell icon color and validate toggle state.
// ============================================================================

export type NotificationCapabilityResult = {
  capable: boolean;
  reason?: 
    | 'unsupported'           // Browser doesn't support push
    | 'permission_denied'     // User blocked notifications
    | 'permission_not_asked'  // Permission never requested
    | 'no_service_worker'     // Service worker not registered
    | 'no_browser_subscription' // Browser has no push subscription
    | 'no_database_subscription' // Subscription not in database
    | 'subscription_mismatch';   // Browser and database don't match
};

/**
 * Check if notifications will ACTUALLY work right now.
 * 
 * This is the SINGLE SOURCE OF TRUTH for notification status.
 * The bell icon should reflect THIS result, not just database flags.
 * 
 * @returns { capable: true } if notifications will work
 * @returns { capable: false, reason: '...' } if something is broken
 */
export async function checkNotificationCapability(
  userId: string, 
  householdId: string
): Promise<NotificationCapabilityResult> {
  console.log('[Push] 🔍 Checking notification capability...');
  
  // 1. Check if push is supported in this browser
  if (!isPushSupported()) {
    console.log('[Push] ❌ Capability: Push not supported');
    return { capable: false, reason: 'unsupported' };
  }
  
  // 2. Check browser permission
  const permission = getNotificationPermission();
  if (permission === 'denied') {
    console.log('[Push] ❌ Capability: Permission denied by user');
    return { capable: false, reason: 'permission_denied' };
  }
  if (permission === 'default') {
    console.log('[Push] ⚠️ Capability: Permission not yet requested');
    return { capable: false, reason: 'permission_not_asked' };
  }
  
  // 3. Check service worker is registered
  const registration = await getServiceWorkerRegistration();
  if (!registration) {
    console.log('[Push] ❌ Capability: No service worker');
    return { capable: false, reason: 'no_service_worker' };
  }
  
  // 4. Check browser has a push subscription
  let browserSub: PushSubscription | null = null;
  try {
    browserSub = await registration.pushManager.getSubscription();
  } catch (err) {
    console.warn('[Push] Error getting browser subscription:', err);
  }
  
  if (!browserSub) {
    console.log('[Push] ❌ Capability: No browser subscription');
    return { capable: false, reason: 'no_browser_subscription' };
  }
  
  // 5. Check subscription exists in database (and matches)
  try {
    const supabaseUserId = await resolveSupabaseUserId(userId, householdId);
    if (!supabaseUserId) {
      console.log('[Push] ⚠️ Could not resolve user ID, assuming capable');
      // Can't verify database, assume it's okay if browser side is good
      return { capable: true };
    }
    
    const { data, error } = await getSupabaseClient()
      .from('push_subscriptions')
      .select('id, endpoint')
      .eq('user_id', supabaseUserId)
      .limit(5);
    
    if (error) {
      console.warn('[Push] Error checking database subscription:', error);
      // Can't verify, assume okay if browser side is good
      return { capable: true };
    }
    
    if (!data || data.length === 0) {
      console.log('[Push] ❌ Capability: No subscription in database');
      return { capable: false, reason: 'no_database_subscription' };
    }
    
    // Check if browser endpoint matches any database endpoint
    const browserEndpoint = browserSub.endpoint;
    const hasMatchingEndpoint = data.some(sub => sub.endpoint === browserEndpoint);
    
    if (!hasMatchingEndpoint) {
      console.log('[Push] ⚠️ Capability: Browser subscription not in database (mismatch)');
      return { capable: false, reason: 'subscription_mismatch' };
    }
    
    console.log('[Push] ✅ Capability: All checks passed - notifications will work');
    return { capable: true };
    
  } catch (err) {
    console.warn('[Push] Error during database check:', err);
    // Browser side is good, assume okay
    return { capable: true };
  }
}

/**
 * CRITICAL: Ensure the current browser subscription is saved to database.
 * 
 * This function is the SINGLE source of truth for subscription sync.
 * It should be called on every app load when:
 * - notificationsEnabled is true
 * - Notification.permission is 'granted'
 * 
 * It will:
 * 1. Get the current browser subscription (create if needed)
 * 2. ALWAYS save it to database (upsert)
 * 3. Return true if successful
 * 
 * This fixes the "stale subscription" problem where user clears cache
 * and the database has old endpoints that don't match the new browser.
 */
export async function ensureCurrentSubscriptionSaved(
  userId: string,
  householdId: string,
  retryCount: number = 0,
  email?: string
): Promise<boolean> {
  const MAX_RETRIES = 3;
  const RETRY_DELAYS = [0, 1000, 2000]; // No delay first, then 1s, then 2s
  
  console.log(`[Push] 🔄 Ensuring current subscription is saved... (attempt ${retryCount + 1}/${MAX_RETRIES})`);
  
  // Add delay for retries to give service worker time to initialize
  if (retryCount > 0 && RETRY_DELAYS[retryCount]) {
    console.log(`[Push] Waiting ${RETRY_DELAYS[retryCount]}ms before retry...`);
    await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS[retryCount]));
  }
  
  if (!isPushSupported()) {
    console.log('[Push] ❌ Push not supported in this browser');
    return false;
  }
  
  const permission = getNotificationPermission();
  console.log('[Push] Current permission:', permission);
  if (permission !== 'granted') {
    console.log('[Push] ❌ Permission not granted:', permission);
    return false;
  }
  
  try {
    // Get or register service worker
    console.log('[Push] Getting service worker registration...');
    let registration = await getServiceWorkerRegistration();
    console.log('[Push] Existing registration:', registration ? 'found' : 'not found');
    
    if (!registration) {
      console.log('[Push] Registering service worker...');
      registration = await registerServiceWorker();
      console.log('[Push] New registration:', registration ? 'created' : 'failed');
    }
    
    if (!registration) {
      console.error('[Push] ❌ No service worker registration');
      // Retry if we haven't exceeded max retries
      if (retryCount < MAX_RETRIES - 1) {
        console.log('[Push] Will retry...');
        return ensureCurrentSubscriptionSaved(userId, householdId, retryCount + 1);
      }
      return false;
    }
    
    // Wait for service worker to be ready with timeout
    console.log('[Push] Waiting for service worker to be ready...');
    const readyPromise = navigator.serviceWorker.ready;
    const timeoutPromise = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error('Service worker ready timeout')), 10000)
    );
    
    try {
      await Promise.race([readyPromise, timeoutPromise]);
      console.log('[Push] ✅ Service worker is ready');
    } catch (timeoutError) {
      console.error('[Push] ⚠️ Service worker ready timed out');
      if (retryCount < MAX_RETRIES - 1) {
        console.log('[Push] Will retry...');
        return ensureCurrentSubscriptionSaved(userId, householdId, retryCount + 1);
      }
      return false;
    }
    
    // Get current browser subscription
    console.log('[Push] Getting existing browser subscription...');
    let subscription = await registration.pushManager.getSubscription();
    console.log('[Push] Existing subscription:', subscription ? subscription.endpoint.substring(0, 50) + '...' : 'none');
    
    // If no subscription exists, create one
    if (!subscription) {
      console.log('[Push] Creating new browser subscription...');
      if (!VAPID_PUBLIC_KEY) {
        console.error('[Push] ❌ VAPID_PUBLIC_KEY not configured');
        return false;
      }
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });
      console.log('[Push] ✅ New subscription created:', subscription.endpoint.substring(0, 50) + '...');
    } else {
      console.log('[Push] Using existing browser subscription');
    }
    
    // ALWAYS save to database using API route (bypasses RLS issues)
    console.log('[Push] Saving subscription via API for user:', userId);
    
    const subscriptionJson = subscription.toJSON();
    if (!subscriptionJson.endpoint || !subscriptionJson.keys) {
      console.error('[Push] ❌ Invalid subscription data');
      return false;
    }
    
    // Use API route which handles Clerk ID to UUID resolution server-side
    const appUrl = import.meta.env.VITE_APP_URL || 'https://app.helpyfam.com';
    const apiUrl = `${appUrl}/api/save-push-subscription-v2`;
    
    console.log('[Push] Calling API:', apiUrl);
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,  // Can be Clerk ID or UUID - API will resolve
        household_id: householdId,
        endpoint: subscriptionJson.endpoint,
        p256dh_key: subscriptionJson.keys.p256dh,
        auth_key: subscriptionJson.keys.auth,
        user_agent: navigator.userAgent,
        device_fingerprint: getDeviceId(),
        email: email || undefined  // Optional: helps API resolve user if clerk_id missing
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.error('[Push] ❌ API error:', errorData);
      throw new Error(errorData.error || `API failed: ${response.status}`);
    }
    
    const result = await response.json();
    console.log('[Push] ✅ Subscription saved via API:', result);
    
    return true;
  } catch (error) {
    console.error('[Push] ❌ Failed to ensure subscription:', error);
    // Retry on failure
    if (retryCount < MAX_RETRIES - 1) {
      console.log('[Push] Will retry after error...');
      return ensureCurrentSubscriptionSaved(userId, householdId, retryCount + 1);
    }
    return false;
  }
}

/**
 * Auto-fix notification issues if possible.
 * 
 * Attempts to silently fix common problems:
 * - Missing database subscription → re-save it
 * - Subscription mismatch → update database with current browser subscription
 * 
 * @returns true if fixed successfully, false if manual action needed
 */
export async function autoFixNotificationIssues(
  userId: string,
  householdId: string
): Promise<boolean> {
  console.log('[Push] 🔧 Attempting auto-fix...');
  
  const capability = await checkNotificationCapability(userId, householdId);
  
  if (capability.capable) {
    console.log('[Push] ✅ No issues to fix');
    return true;
  }
  
  // Can't auto-fix these - require user action
  if (capability.reason === 'unsupported' || 
      capability.reason === 'permission_denied' || 
      capability.reason === 'permission_not_asked') {
    console.log('[Push] ❌ Cannot auto-fix:', capability.reason);
    return false;
  }
  
  // Try to fix service worker issues
  if (capability.reason === 'no_service_worker') {
    console.log('[Push] 🔧 Attempting to register service worker...');
    const registration = await registerServiceWorker();
    if (!registration) {
      console.log('[Push] ❌ Failed to register service worker');
      return false;
    }
  }
  
  // Try to fix subscription issues by re-subscribing
  if (capability.reason === 'no_browser_subscription' || 
      capability.reason === 'no_database_subscription' ||
      capability.reason === 'subscription_mismatch') {
    console.log('[Push] 🔧 Attempting to re-establish subscription...');
    
    try {
      // Re-subscribe (this will create browser subscription and save to database)
      const subscription = await subscribeToPush(userId, householdId);
      if (subscription) {
        console.log('[Push] ✅ Auto-fix successful - subscription re-established');
        return true;
      } else {
        console.log('[Push] ❌ Auto-fix failed - could not create subscription');
        return false;
      }
    } catch (err) {
      console.error('[Push] ❌ Auto-fix error:', err);
      return false;
    }
  }
  
  return false;
}

/**
 * Register the service worker for push notifications
 * Also sets up update detection to notify users when a new version is available
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
    
    // Set up update detection
    setupUpdateDetection(registration);
    
    return registration;
  } catch (error) {
    console.error('[Push] Service worker registration failed:', error);
    return null;
  }
}

/**
 * Set up listeners to detect when a new service worker version is available
 */
function setupUpdateDetection(registration: ServiceWorkerRegistration): void {
  // Check if there's already a waiting worker (update available)
  if (registration.waiting) {
    console.log('[SW Update] New version already waiting');
    dispatchUpdateAvailable(registration);
  }
  
  // Listen for new service worker installations
  registration.addEventListener('updatefound', () => {
    const newWorker = registration.installing;
    if (!newWorker) return;
    
    console.log('[SW Update] New version being installed...');
    
    newWorker.addEventListener('statechange', () => {
      // When the new worker is installed and waiting
      if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
        console.log('[SW Update] New version ready - dispatching event');
        dispatchUpdateAvailable(registration);
      }
    });
  });
  
  // Safety net: if the service worker controller changes mid-session, reload cleanly
  // This handles the case where user clicks Update or browser decides to activate new SW
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    console.log('[SW Update] Controller changed - reloading for clean state...');
    window.location.reload();
  });
}

/**
 * Dispatch custom event to notify the app that an update is available
 */
function dispatchUpdateAvailable(registration: ServiceWorkerRegistration): void {
  window.dispatchEvent(new CustomEvent('swUpdateAvailable', {
    detail: { registration }
  }));
}

/**
 * Apply a pending service worker update
 * Call this when user clicks "Update" button
 */
export function applyServiceWorkerUpdate(registration: ServiceWorkerRegistration): void {
  if (registration.waiting) {
    // Tell the waiting SW to activate immediately
    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
  }
  // Reload after a brief delay to allow SW to activate
  setTimeout(() => {
    window.location.reload();
  }, 100);
}

/**
 * Check for service worker updates
 * Call this periodically or on visibility change
 */
export async function checkForUpdates(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  
  try {
    const registration = await navigator.serviceWorker.getRegistration('/');
    if (registration) {
      console.log('[SW Update] Checking for updates...');
      await registration.update();
    }
  } catch (error) {
    console.warn('[SW Update] Update check failed:', error);
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
 * 
 * BULLETPROOF VERSION: Uses API endpoint as the ONLY save path.
 * The API has service role access and handles Clerk ID → UUID resolution server-side.
 * Returns null if ANYTHING fails - no more silent failures.
 */
export async function subscribeToPush(
  userId: string,
  householdId: string,
  email?: string
): Promise<PushSubscription | null> {
  console.log('[Push] subscribeToPush called:', { userId, householdId });
  
  if (!isPushSupported()) {
    console.warn('[Push] Push not supported');
    return null;
  }

  if (!VAPID_PUBLIC_KEY) {
    console.error('[Push] VAPID_PUBLIC_KEY not configured');
    return null;
  }

  try {
    // Step 1: Request permission only if not already granted
    let permission = getNotificationPermission();
    if (permission === 'default') {
      console.log('[Push] Requesting permission...');
      permission = await requestNotificationPermission();
    }
    if (permission !== 'granted') {
      console.warn('[Push] Permission not granted:', permission);
      return null;
    }
    console.log('[Push] Permission granted');

    // Step 2: Get or register service worker
    let registration = await getServiceWorkerRegistration();
    if (!registration) {
      console.log('[Push] Registering service worker...');
      registration = await registerServiceWorker();
    }

    if (!registration) {
      console.error('[Push] No service worker registration');
      return null;
    }
    console.log('[Push] Service worker ready');

    // Step 3: Wait for service worker to be ready
    await navigator.serviceWorker.ready;

    // Step 4: Get or create browser subscription
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      console.log('[Push] Creating new browser subscription...');
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });
      console.log('[Push] New subscription created');
    } else {
      console.log('[Push] Using existing browser subscription');
    }

    // Step 5: CRITICAL - Save via API endpoint (ONLY path, not fallback)
    // The API uses service role and handles Clerk ID → UUID resolution server-side
    // This is 100% reliable, unlike client-side resolution which fails for new users
    const subscriptionJson = subscription.toJSON();
    if (!subscriptionJson.endpoint || !subscriptionJson.keys) {
      console.error('[Push] Invalid subscription data');
      return null;
    }
    
    const appUrl = import.meta.env.VITE_APP_URL || 'https://app.helpyfam.com';
    const apiUrl = `${appUrl}/api/save-push-subscription-v2`;
    
    console.log('[Push] Saving subscription via API...');
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,  // Clerk ID or UUID - API handles resolution
        household_id: householdId,
        endpoint: subscriptionJson.endpoint,
        p256dh_key: subscriptionJson.keys.p256dh,
        auth_key: subscriptionJson.keys.auth,
        user_agent: navigator.userAgent,
        device_fingerprint: getDeviceId(),
        email: email || undefined  // Optional: helps API resolve user if clerk_id missing
      }),
    });

    // Step 6: ONLY return success if API confirmed save
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.error('[Push] API save failed:', response.status, errorData);
      // BE HONEST - return null, don't pretend it worked
      return null;
    }

    const result = await response.json();
    console.log('[Push] Subscription saved successfully via API:', result);
    
    return subscription;
    
  } catch (error) {
    console.error('[Push] subscribeToPush failed:', error);
    console.error('[Push] Error details:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    // BE HONEST - return null on any failure
    return null;
  }
}

/**
 * Save push subscription to Supabase database
 * 
 * CRITICAL: This function must save the subscription with a valid Supabase UUID,
 * not a Clerk ID. The edge function will query push_subscriptions by user_id (UUID).
 */
async function saveSubscriptionToDatabase(
  subscription: PushSubscription,
  userId: string,
  householdId: string
): Promise<void> {
  const idType = getIdType(userId);
  console.log(`[Push] Saving subscription for user: ${userId} (${idType})`);
  
  const subscriptionJson = subscription.toJSON();
  
  if (!subscriptionJson.endpoint || !subscriptionJson.keys) {
    throw new Error('Invalid subscription data - missing endpoint or keys');
  }

  // IMPORTANT: Resolve to Supabase UUID (userId may be a Clerk ID)
  const supabaseUserId = await resolveSupabaseUserId(userId, householdId);
  
  // Validate that we got a valid UUID, not a Clerk ID or other invalid value
  if (!supabaseUserId) {
    console.error('[Push] ❌ Failed to resolve user ID:', { 
      input: userId, 
      inputType: idType,
      resolved: null 
    });
    throw new Error(`Could not resolve user ID to Supabase UUID. Input: ${userId} (${idType})`);
  }
  
  if (!isValidUuid(supabaseUserId)) {
    console.error('[Push] ❌ Resolved ID is not a valid UUID:', { 
      input: userId, 
      inputType: idType,
      resolved: supabaseUserId,
      resolvedType: getIdType(supabaseUserId)
    });
    throw new Error(`Resolved user ID is not a valid UUID: ${supabaseUserId}`);
  }

  const data = {
    user_id: supabaseUserId,  // Use Supabase UUID, not Clerk ID
    household_id: householdId,
    endpoint: subscriptionJson.endpoint,
    p256dh_key: subscriptionJson.keys.p256dh,
    auth_key: subscriptionJson.keys.auth,
    user_agent: navigator.userAgent,
    device_fingerprint: getDeviceId(),  // Persistent device ID from localStorage
    updated_at: new Date().toISOString()
  };

  // Log the save attempt with clear ID mapping
  console.log('[Push] Saving subscription to database:', {
    original_user_id: userId,
    original_id_type: idType,
    resolved_user_id: supabaseUserId,
    household_id: householdId,
    endpoint: data.endpoint.substring(0, 50) + '...',
    has_p256dh: !!data.p256dh_key,
    has_auth: !!data.auth_key
  });

  // Use authenticated client if available (for RLS), otherwise fall back to default
  const supabaseClient = getAuthenticatedSupabaseClient() || supabase;
  
  // Try upsert - if unique constraint exists, it will update; otherwise insert
  let savedData;
  let error;
  
  try {
    const result = await supabaseClient
      .from('push_subscriptions')
      .upsert(data, {
        onConflict: 'user_id,endpoint',  // Matches UNIQUE(user_id, endpoint) constraint
        ignoreDuplicates: false
      })
      .select();
    
    savedData = result.data;
    error = result.error;
  } catch (e: any) {
    error = e;
  }

  // If JWT verification fails (PGRST301), fall back to API route
  if (error && (error.code === 'PGRST301' || error.message?.includes('No suitable key'))) {
    console.warn('[Push] JWT verification failed, using API route fallback');
    
    try {
      const appUrl = import.meta.env.VITE_APP_URL || import.meta.env.NEXT_PUBLIC_APP_URL || 'https://app.helpyfam.com';
      const apiUrl = `${appUrl}/api/save-push-subscription`;
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `API route failed: ${response.status}`);
      }

      const result = await response.json();
      savedData = result.data ? [result.data] : null;
      error = null;
      console.log('[Push] ✅ Subscription saved via API route');
    } catch (apiError: any) {
      console.error('[Push] ❌ API route also failed:', apiError);
      throw apiError;
    }
  } else if (error) {
    console.error('[Push] ❌ Failed to save subscription:', error);
    console.error('[Push] Error details:', {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
      user_id_attempted: supabaseUserId,
      household_id: householdId
    });
    throw error;
  }

  console.log('[Push] ✅ Subscription saved to database successfully:', savedData ? `ID: ${savedData[0]?.id}` : '(no data returned)');
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
    const { error } = await getSupabaseClient()
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
        
        const { data } = await getSupabaseClient()
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

// Device ID is now managed by utils/pwaUtils.ts using localStorage
// The old generateDeviceFingerprint() has been replaced with getDeviceId()
// which provides a persistent UUID per device instead of a weak hash

/**
 * Validate and sync subscription on app load
 * 
 * This ensures the browser subscription matches what's in the database.
 * If there's a mismatch, it re-saves the subscription.
 * 
 * Call this when the app loads to ensure notifications work properly.
 * 
 * @returns true if subscription is valid and synced, false otherwise
 */
export async function validateAndSyncSubscription(
  userId: string,
  householdId: string,
  notificationsEnabled: boolean
): Promise<{ valid: boolean; action: 'none' | 'synced' | 'cleaned' | 'disabled' }> {
  console.log('[Push] Validating subscription...', { userId, notificationsEnabled });
  
  // If notifications are disabled, no need to validate
  if (!notificationsEnabled) {
    return { valid: true, action: 'disabled' };
  }
  
  // Check if push is supported
  if (!isPushSupported()) {
    console.log('[Push] Push not supported, skipping validation');
    return { valid: false, action: 'none' };
  }
  
  try {
    const registration = await getServiceWorkerRegistration();
    if (!registration) {
      console.log('[Push] No service worker registration');
      return { valid: false, action: 'none' };
    }
    
    const browserSub = await registration.pushManager.getSubscription();
    
    // Resolve user ID to Supabase UUID
    const supabaseUserId = await resolveSupabaseUserId(userId, householdId);
    if (!supabaseUserId) {
      console.log('[Push] Could not resolve user ID');
      return { valid: false, action: 'none' };
    }
    
    if (!browserSub) {
      // No browser subscription - check if we have stale ones in database
      const { data: staleSubscriptions } = await getSupabaseClient()
        .from('push_subscriptions')
        .select('id')
        .eq('user_id', supabaseUserId);
      
      if (staleSubscriptions && staleSubscriptions.length > 0) {
        // Clean up stale database entries
        console.log(`[Push] Cleaning up ${staleSubscriptions.length} stale subscription(s)`);
        await getSupabaseClient()
          .from('push_subscriptions')
          .delete()
          .eq('user_id', supabaseUserId);
        return { valid: false, action: 'cleaned' };
      }
      
      return { valid: false, action: 'none' };
    }
    
    // Browser has subscription - verify it's in database
    const { data } = await getSupabaseClient()
      .from('push_subscriptions')
      .select('id, endpoint')
      .eq('user_id', supabaseUserId)
      .eq('endpoint', browserSub.endpoint)
      .limit(1);
    
    if (data && data.length > 0) {
      console.log('[Push] Subscription is valid and in sync');
      return { valid: true, action: 'none' };
    }
    
    // Browser has subscription but it's not in database - sync it
    console.log('[Push] Browser subscription not in database, syncing...');
    
    const subscriptionJson = browserSub.toJSON();
    if (!subscriptionJson.endpoint || !subscriptionJson.keys) {
      console.log('[Push] Invalid subscription data');
      return { valid: false, action: 'none' };
    }
    
    const deviceId = getDeviceId();  // Use persistent device ID
    
    // Delete old subscriptions for this device before inserting
    await getSupabaseClient()
      .from('push_subscriptions')
      .delete()
      .eq('user_id', supabaseUserId)
      .neq('endpoint', subscriptionJson.endpoint);
    
    // Upsert the current subscription
    const { error } = await getSupabaseClient()
      .from('push_subscriptions')
      .upsert({
        user_id: supabaseUserId,
        household_id: householdId,
        endpoint: subscriptionJson.endpoint,
        p256dh_key: subscriptionJson.keys.p256dh,
        auth_key: subscriptionJson.keys.auth,
        user_agent: navigator.userAgent,
        device_fingerprint: deviceId,  // Persistent device ID
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,endpoint'
      });
    
    if (error) {
      console.error('[Push] Failed to sync subscription:', error);
      return { valid: false, action: 'none' };
    }
    
    console.log('[Push] Subscription synced successfully');
    return { valid: true, action: 'synced' };
    
  } catch (error) {
    console.error('[Push] Error validating subscription:', error);
    return { valid: false, action: 'none' };
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
  notificationsEnabled: boolean,
  email?: string
): Promise<boolean> {
  console.log('[Push] Checking auto-subscribe...', { userId, householdId, notificationsEnabled });

  // Check for valid userId
  if (!userId) {
    console.log('[Push] Auto-subscribe skipped: userId is undefined');
    return false;
  }

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
    // IMPORTANT: Auto-subscribe should NEVER request permission - only explicit toggle should do that
    // If permission is 'default' (never asked), skip and wait for user to toggle ON explicitly
    const permission = getNotificationPermission();
    if (permission === 'denied') {
      console.log('[Push] Auto-subscribe skipped: permission denied');
      return false;
    }

    if (permission === 'default') {
      console.log('[Push] Auto-subscribe skipped: permission not yet granted (user needs to toggle ON explicitly)');
      return false;
    }

    if (permission !== 'granted') {
      console.log('[Push] Auto-subscribe skipped: permission not granted (current:', permission, ')');
      return false;
    }

    // Subscribe to push notifications without prompting (permission already granted)
    console.log('[Push] Auto-subscribing user to push notifications...');
    const subscription = await subscribeToPush(userId, householdId, email);
    
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
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║         HELPY PUSH NOTIFICATION DIAGNOSTICS                ║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  
  // 1. Check VAPID key
  const vapidStatus = VAPID_PUBLIC_KEY ? `✅ Set (${VAPID_PUBLIC_KEY.length} chars)` : '❌ MISSING';
  console.log(`║ 1. VAPID Public Key: ${vapidStatus}`);
  if (!VAPID_PUBLIC_KEY) {
    console.log('║    FIX: Add VITE_VAPID_PUBLIC_KEY to .env.local');
  }
  
  // 2. Check browser support
  const browserSupport = isPushSupported() ? '✅ Supported' : '❌ Not supported';
  console.log(`║ 2. Browser Support: ${browserSupport}`);
  
  // 3. Check permission
  const permission = getNotificationPermission();
  const permissionIcon = permission === 'granted' ? '✅' : permission === 'denied' ? '❌' : '⚠️';
  console.log(`║ 3. Notification Permission: ${permissionIcon} ${permission}`);
  if (permission === 'denied') {
    console.log('║    FIX: Enable in browser settings (click lock icon)');
  }
  
  // 4. Check service worker
  const registration = await getServiceWorkerRegistration();
  console.log(`║ 4. Service Worker: ${registration ? '✅ Registered' : '❌ Not registered'}`);
  
  // 5. Check browser subscription
  if (registration) {
    const subscription = await registration.pushManager.getSubscription();
    console.log(`║ 5. Browser Subscription: ${subscription ? '✅ Active' : '❌ None'}`);
    if (subscription) {
      console.log(`║    Endpoint: ${subscription.endpoint.substring(0, 40)}...`);
    }
  }
  
  // 6. Check user ID cache status
  const cachePopulated = isUserCachePopulated();
  const cacheStats = getUserCacheStats();
  console.log(`║ 6. User ID Cache: ${cachePopulated ? `✅ Populated (${cacheStats.size} entries)` : '❌ Empty'}`);
  if (!cachePopulated) {
    console.log('║    FIX: Users may not be loaded yet. Wait or refresh.');
  }
  
  // 7. Check ID resolution (if userId provided)
  if (userId && householdId) {
    console.log('║ 7. ID Resolution Test:');
    console.log(`║    Input: ${userId} (${getIdType(userId)})`);
    
    // First try cache
    const cachedId = getCachedSupabaseUuid(userId);
    console.log(`║    Cached: ${cachedId === userId ? '(not in cache)' : cachedId}`);
    
    // Then try full resolution
    const resolvedId = await resolveSupabaseUserId(userId, householdId);
    console.log(`║    Resolved: ${resolvedId ? `✅ ${resolvedId}` : '❌ Failed'}`);
    
    // 8. Check database subscriptions
    if (resolvedId) {
      console.log('║ 8. Database Subscriptions:');
      const { data, error } = await getSupabaseClient()
        .from('push_subscriptions')
        .select('id, endpoint, created_at')
        .eq('user_id', resolvedId);
      
      if (error) {
        console.log(`║    ❌ Query error: ${error.message}`);
      } else if (data && data.length > 0) {
        console.log(`║    ✅ Found ${data.length} subscription(s)`);
        data.forEach((sub, i) => {
          console.log(`║    [${i + 1}] ${sub.endpoint.substring(0, 35)}...`);
        });
      } else {
        console.log('║    ⚠️ No subscriptions in database');
        console.log('║    FIX: Toggle notifications OFF then ON in Settings');
      }
    }
  } else {
    console.log('║ 7-8. (Provide userId and householdId for full test)');
    console.log('║      Usage: helpyDebugPush("user_xxx", "household-uuid")');
  }
  
  console.log('╚════════════════════════════════════════════════════════════╝');
}

// Make it available globally for debugging
if (typeof window !== 'undefined') {
  (window as any).helpyDebugPush = debugPushNotifications;
}

/**
 * Trigger batch processing on the server
 * This is a backup mechanism in case pg_cron is not available.
 * Call this periodically (e.g., every 5 minutes) to ensure batches are processed.
 */
export async function triggerBatchProcessing(): Promise<boolean> {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client.rpc('process_notification_batches');
    
    if (error) {
      // Function might not exist yet - that's OK
      if (error.code === '42883') {
        console.log('[Push] Batch processing RPC not available (migration not run yet)');
        return false;
      }
      console.error('[Push] Batch processing error:', error);
      return false;
    }
    
    if (data?.processed > 0) {
      console.log(`[Push] Batch processing: ${data.processed} notification(s) sent`);
    }
    
    return data?.success ?? false;
  } catch (err) {
    console.error('[Push] Batch processing failed:', err);
    return false;
  }
}

// Interval ID for periodic batch processing
let batchProcessingInterval: NodeJS.Timeout | null = null;

/**
 * Start periodic batch processing (every 5 minutes)
 * This ensures notification batches are processed even if no new items are added.
 */
export function startPeriodicBatchProcessing(): void {
  // Don't start if already running
  if (batchProcessingInterval) {
    return;
  }
  
  const INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
  
  console.log('[Push] Starting periodic batch processing (every 5 minutes)');
  
  batchProcessingInterval = setInterval(() => {
    triggerBatchProcessing().catch(err => {
      console.warn('[Push] Periodic batch processing failed:', err);
    });
  }, INTERVAL_MS);
  
  // Also trigger immediately on start
  triggerBatchProcessing().catch(() => {});
}

/**
 * Stop periodic batch processing
 */
export function stopPeriodicBatchProcessing(): void {
  if (batchProcessingInterval) {
    clearInterval(batchProcessingInterval);
    batchProcessingInterval = null;
    console.log('[Push] Stopped periodic batch processing');
  }
}


