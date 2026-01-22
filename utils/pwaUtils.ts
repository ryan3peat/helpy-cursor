/**
 * PWA and Device Utilities
 * 
 * Utilities for detecting PWA mode and managing device identification
 * for push notification features.
 */
import { logger } from './logger';

// ============================================================================
// PWA DETECTION
// ============================================================================

/**
 * Check if the app is running as an installed PWA (standalone mode)
 * 
 * This detects:
 * - Android: display-mode: standalone media query
 * - iOS: navigator.standalone property
 * 
 * Returns false when running in a regular browser tab.
 */
export function isRunningAsPwa(): boolean {
  // Check standard display-mode media query (works on Android Chrome, Desktop)
  const isStandalone = window.matchMedia?.('(display-mode: standalone)')?.matches;
  
  // Check iOS-specific standalone property
  const isIosStandalone = (window.navigator as any).standalone === true;
  
  return isStandalone || isIosStandalone;
}

/**
 * Check if the device is iOS (iPhone/iPad)
 */
export function isIosDevice(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
}

/**
 * Check if the device is Android
 */
export function isAndroidDevice(): boolean {
  return /Android/.test(navigator.userAgent);
}

// ============================================================================
// DEVICE ID MANAGEMENT
// ============================================================================

const DEVICE_ID_KEY = 'helpy_device_id';

/**
 * Get or create a unique device ID
 * 
 * This ID persists across sessions and is used to:
 * - Track which devices have been prompted for notifications
 * - Associate push subscriptions with specific devices
 * - Detect "already prompted" state for first-launch flow
 * 
 * The ID is stored in localStorage and survives until user clears browser data.
 * If cleared, a new ID is generated (treated as a new device).
 */
export function getDeviceId(): string {
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  
  if (!deviceId) {
    // Generate a new UUID using crypto API
    deviceId = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
    logger.log('[PWA] Generated new device ID:', deviceId);
  }
  
  return deviceId;
}

/**
 * Clear the device ID (for testing/debugging only)
 * This will make the device appear as "new" on next app load.
 */
export function clearDeviceId(): void {
  localStorage.removeItem(DEVICE_ID_KEY);
  logger.log('[PWA] Device ID cleared');
}

// ============================================================================
// NOTIFICATION PROMPT TRACKING
// ============================================================================

const PROMPT_PREFIX = 'helpy_notif_prompted_';
const PROMPT_DISMISSED_PREFIX = 'helpy_notif_dismissed_';

/**
 * Check if the notification prompt has been shown on this device
 * for the current user.
 * 
 * @param userId - The user ID to check (prompts are per-user per-device)
 */
export function hasBeenPromptedForNotifications(userId: string): boolean {
  const deviceId = getDeviceId();
  const key = `${PROMPT_PREFIX}${deviceId}_${userId}`;
  return localStorage.getItem(key) === 'true';
}

/**
 * Mark that the notification prompt has been shown on this device
 * for the current user.
 * 
 * @param userId - The user ID to mark as prompted
 */
export function markAsPromptedForNotifications(userId: string): void {
  const deviceId = getDeviceId();
  const key = `${PROMPT_PREFIX}${deviceId}_${userId}`;
  localStorage.setItem(key, 'true');
  logger.log('[PWA] Marked as prompted for notifications:', key);
}

/**
 * Check if the notification prompt was recently dismissed
 * (within the cooldown period).
 * 
 * @param userId - The user ID to check
 * @param cooldownHours - Hours to wait before showing again (default: 24)
 */
export function isPromptDismissed(userId: string, cooldownHours: number = 24): boolean {
  const deviceId = getDeviceId();
  const key = `${PROMPT_DISMISSED_PREFIX}${deviceId}_${userId}`;
  const dismissedUntil = localStorage.getItem(key);
  
  if (!dismissedUntil) return false;
  
  const dismissedUntilTime = parseInt(dismissedUntil, 10);
  return Date.now() < dismissedUntilTime;
}

/**
 * Mark the notification prompt as dismissed for a cooldown period.
 * 
 * @param userId - The user ID
 * @param cooldownHours - Hours before prompt can show again (default: 24)
 */
export function dismissPromptTemporarily(userId: string, cooldownHours: number = 24): void {
  const deviceId = getDeviceId();
  const key = `${PROMPT_DISMISSED_PREFIX}${deviceId}_${userId}`;
  const dismissUntil = Date.now() + (cooldownHours * 60 * 60 * 1000);
  localStorage.setItem(key, dismissUntil.toString());
  logger.log('[PWA] Prompt dismissed until:', new Date(dismissUntil).toISOString());
}

/**
 * Clear prompt tracking for testing/debugging.
 * 
 * @param userId - The user ID to clear tracking for
 */
export function clearPromptTracking(userId: string): void {
  const deviceId = getDeviceId();
  localStorage.removeItem(`${PROMPT_PREFIX}${deviceId}_${userId}`);
  localStorage.removeItem(`${PROMPT_DISMISSED_PREFIX}${deviceId}_${userId}`);
  logger.log('[PWA] Prompt tracking cleared for user:', userId);
}

