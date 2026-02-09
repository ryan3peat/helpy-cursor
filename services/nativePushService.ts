/**
 * Native Push Notification Service for Helpy App (Android/iOS via Capacitor)
 * 
 * Uses @capacitor/push-notifications which wraps:
 * - Android: Firebase Cloud Messaging (FCM)
 * - iOS: Apple Push Notification Service (APNs) [future]
 * 
 * This service provides reliable push notifications that work even when
 * the app is backgrounded or killed, unlike Web Push in a WebView.
 * 
 * FCM tokens are stored in the `fcm_tokens` table in Supabase and the
 * send-notification Edge Function sends to both Web Push and FCM endpoints.
 */

import { logger } from '../utils/logger';
import { getDeviceId, getNativePlatform } from '../utils/pwaUtils';

// ============================================================================
// TYPES
// ============================================================================

export interface NativePushState {
  initialized: boolean;
  permissionGranted: boolean;
  token: string | null;
}

// Module-level state
let _state: NativePushState = {
  initialized: false,
  permissionGranted: false,
  token: null,
};

// Callback for handling notification taps (navigation)
let _onNotificationTap: ((url: string) => void) | null = null;

// Callback for handling data refresh (foreground notification received)
let _onDataChanged: ((dataType: string) => void) | null = null;

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Check if native push notifications are available.
 * Returns true only on Capacitor native platforms (Android/iOS).
 */
export function isNativePushAvailable(): boolean {
  try {
    const cap = (window as any).Capacitor;
    return cap?.isNativePlatform?.() === true;
  } catch {
    return false;
  }
}

/**
 * Initialize native push notifications.
 * 
 * This should be called once when the app starts on a native platform.
 * It sets up listeners for:
 * - Registration: when FCM token is received
 * - Registration error: when token registration fails
 * - Push received: foreground notification
 * - Action performed: notification tap
 */
export async function initializeNativePush(options: {
  onNotificationTap?: (url: string) => void;
  onDataChanged?: (dataType: string) => void;
} = {}): Promise<boolean> {
  if (!isNativePushAvailable()) {
    logger.log('[NativePush] Not on native platform, skipping initialization');
    return false;
  }

  if (_state.initialized) {
    logger.log('[NativePush] Already initialized');
    return true;
  }

  _onNotificationTap = options.onNotificationTap || null;
  _onDataChanged = options.onDataChanged || null;

  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');

    // Listen for successful registration (FCM token received)
    PushNotifications.addListener('registration', (token) => {
      logger.log('[NativePush] FCM token received:', token.value.substring(0, 20) + '...');
      _state.token = token.value;
      _state.permissionGranted = true;
    });

    // Listen for registration errors
    PushNotifications.addListener('registrationError', (error) => {
      logger.error('[NativePush] Registration error:', error);
      _state.token = null;
    });

    // Listen for push notifications received while app is in foreground
    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      logger.log('[NativePush] Foreground notification:', notification);
      
      // Trigger data refresh in the app (like Web Push DATA_CHANGED message)
      const dataType = notification.data?.type || 'general';
      if (_onDataChanged) {
        _onDataChanged(dataType);
      }
    });

    // Listen for notification action (user tapped notification)
    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      logger.log('[NativePush] Notification tapped:', action);
      
      const data = action.notification.data || {};
      const url = data.url || getActionUrl(data.type);
      
      if (_onNotificationTap) {
        _onNotificationTap(url);
      }
    });

    _state.initialized = true;
    logger.log('[NativePush] Initialized successfully');
    return true;
  } catch (error) {
    logger.error('[NativePush] Failed to initialize:', error);
    return false;
  }
}

// ============================================================================
// PERMISSION & REGISTRATION
// ============================================================================

/**
 * Request notification permission and register for push notifications.
 * 
 * On Android 13+, this will show the system permission dialog.
 * On older Android, permissions are granted at install time.
 * 
 * Returns the FCM token if successful, null otherwise.
 */
export async function requestNativePushPermission(): Promise<string | null> {
  if (!isNativePushAvailable()) {
    logger.warn('[NativePush] Not on native platform');
    return null;
  }

  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');

    // Check current permission status
    const permResult = await PushNotifications.checkPermissions();
    logger.log('[NativePush] Current permission:', permResult.receive);

    if (permResult.receive === 'denied') {
      logger.warn('[NativePush] Permission denied by user');
      _state.permissionGranted = false;
      return null;
    }

    if (permResult.receive !== 'granted') {
      // Request permission (shows system dialog on Android 13+)
      const requestResult = await PushNotifications.requestPermissions();
      logger.log('[NativePush] Permission request result:', requestResult.receive);

      if (requestResult.receive !== 'granted') {
        logger.warn('[NativePush] Permission not granted:', requestResult.receive);
        _state.permissionGranted = false;
        return null;
      }
    }

    _state.permissionGranted = true;

    // Register with FCM to get token
    // The 'registration' listener will fire with the token
    await PushNotifications.register();
    logger.log('[NativePush] Registration requested, waiting for token...');

    // Wait for token (the registration listener sets it)
    // Give it up to 10 seconds
    const token = await waitForToken(10000);
    
    if (token) {
      logger.log('[NativePush] Got FCM token:', token.substring(0, 20) + '...');
      return token;
    }

    logger.warn('[NativePush] Token not received within timeout');
    return null;
  } catch (error) {
    logger.error('[NativePush] Permission/registration error:', error);
    return null;
  }
}

/**
 * Get the current FCM token (if already registered).
 * Returns null if not registered or no token available.
 */
export function getCurrentToken(): string | null {
  return _state.token;
}

/**
 * Check if native push permission is granted.
 */
export async function checkNativePermission(): Promise<'granted' | 'denied' | 'prompt'> {
  if (!isNativePushAvailable()) return 'denied';

  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    const result = await PushNotifications.checkPermissions();
    
    switch (result.receive) {
      case 'granted': return 'granted';
      case 'denied': return 'denied';
      default: return 'prompt';
    }
  } catch {
    return 'denied';
  }
}

// ============================================================================
// TOKEN SAVING
// ============================================================================

/**
 * Save the FCM token to the server for the given user.
 * 
 * Uses the /api/save-fcm-token endpoint which handles:
 * - Clerk ID to UUID resolution
 * - Upsert (update if token already exists for this user+device)
 */
export async function saveFcmToken(
  userId: string,
  householdId: string,
  token?: string
): Promise<boolean> {
  const fcmToken = token || _state.token;
  
  if (!fcmToken) {
    logger.warn('[NativePush] No FCM token to save');
    return false;
  }

  try {
    const appUrl = import.meta.env.VITE_APP_URL || 'https://app.helpyfam.com';
    const apiUrl = `${appUrl}/api/save-fcm-token`;

    logger.log('[NativePush] Saving FCM token via API...');

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        household_id: householdId,
        token: fcmToken,
        platform: getNativePlatform(),
        device_fingerprint: getDeviceId(),
        user_agent: navigator.userAgent,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      logger.error('[NativePush] API error:', errorData);
      return false;
    }

    const result = await response.json();
    logger.log('[NativePush] FCM token saved:', result);
    return true;
  } catch (error) {
    logger.error('[NativePush] Failed to save FCM token:', error);
    return false;
  }
}

/**
 * Remove FCM token from server (when user disables notifications or logs out).
 */
export async function removeFcmToken(
  userId: string,
  householdId: string
): Promise<boolean> {
  const fcmToken = _state.token;
  
  if (!fcmToken) {
    logger.log('[NativePush] No FCM token to remove');
    return true; // Nothing to remove
  }

  try {
    const appUrl = import.meta.env.VITE_APP_URL || 'https://app.helpyfam.com';
    const apiUrl = `${appUrl}/api/save-fcm-token`;

    const response = await fetch(apiUrl, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        household_id: householdId,
        token: fcmToken,
      }),
    });

    if (!response.ok) {
      logger.error('[NativePush] Failed to remove token:', response.status);
      return false;
    }

    logger.log('[NativePush] FCM token removed');
    return true;
  } catch (error) {
    logger.error('[NativePush] Error removing token:', error);
    return false;
  }
}

// ============================================================================
// FULL SUBSCRIBE/UNSUBSCRIBE FLOW
// ============================================================================

/**
 * Full subscribe flow for native push:
 * 1. Request permission
 * 2. Get FCM token
 * 3. Save to server
 * 
 * Returns true if all steps succeeded.
 */
export async function subscribeNativePush(
  userId: string,
  householdId: string
): Promise<boolean> {
  logger.log('[NativePush] Starting subscribe flow...');

  // Ensure initialized
  if (!_state.initialized) {
    const ok = await initializeNativePush();
    if (!ok) return false;
  }

  // Request permission and get token
  const token = await requestNativePushPermission();
  if (!token) {
    logger.warn('[NativePush] Subscribe failed: no token');
    return false;
  }

  // Save token to server
  const saved = await saveFcmToken(userId, householdId, token);
  if (!saved) {
    logger.warn('[NativePush] Subscribe failed: could not save token');
    return false;
  }

  logger.log('[NativePush] Subscribe successful!');
  return true;
}

/**
 * Auto-subscribe if user has notifications enabled and we're on native.
 * Similar to autoSubscribeIfNeeded in pushNotificationService.ts.
 */
export async function autoSubscribeNativeIfNeeded(
  userId: string,
  householdId: string,
  notificationsEnabled: boolean
): Promise<boolean> {
  if (!isNativePushAvailable()) return false;
  if (!notificationsEnabled) return false;
  if (!userId) return false;

  logger.log('[NativePush] Checking auto-subscribe...');

  // Ensure initialized
  if (!_state.initialized) {
    await initializeNativePush();
  }

  // Check if we already have a token
  const permission = await checkNativePermission();
  if (permission === 'denied') {
    logger.log('[NativePush] Auto-subscribe skipped: permission denied');
    return false;
  }

  if (permission === 'prompt') {
    // Don't auto-prompt, wait for user to toggle ON explicitly
    logger.log('[NativePush] Auto-subscribe skipped: permission not yet granted');
    return false;
  }

  // Permission is granted, ensure we have a token registered
  if (!_state.token) {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    await PushNotifications.register();
    await waitForToken(5000);
  }

  if (_state.token) {
    // Save/update token on server
    return await saveFcmToken(userId, householdId);
  }

  return false;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Determine the in-app URL based on notification type.
 * Mirrors the logic in sw-push.js.
 */
function getActionUrl(type?: string): string {
  switch (type) {
    case 'todo_item':
    case 'shopping':
      return '/#todo?section=shopping';
    case 'task':
      return '/#todo?section=task';
    case 'meal':
      return '/#meals';
    case 'expense':
      return '/#expenses';
    case 'family_board':
      return '/#home';
    default:
      return '/';
  }
}

/**
 * Wait for the FCM token to be set by the registration listener.
 */
function waitForToken(timeoutMs: number): Promise<string | null> {
  return new Promise((resolve) => {
    // If token is already available, return immediately
    if (_state.token) {
      resolve(_state.token);
      return;
    }

    const startTime = Date.now();
    const interval = setInterval(() => {
      if (_state.token) {
        clearInterval(interval);
        resolve(_state.token);
      } else if (Date.now() - startTime >= timeoutMs) {
        clearInterval(interval);
        resolve(null);
      }
    }, 100);
  });
}

/**
 * Get the current native push state (for debugging).
 */
export function getNativePushState(): NativePushState {
  return { ..._state };
}
