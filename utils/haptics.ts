/**
 * Haptic Feedback Utility
 * Provides tactile feedback for UI interactions to make the PWA feel native.
 * Uses the Vibration API (supported on Android, some iOS scenarios).
 * 
 * Note: iOS Safari has limited vibration support, but the API calls are safe
 * and will simply do nothing on unsupported devices.
 */

/**
 * Check if vibration is supported
 */
const canVibrate = (): boolean => {
  return 'vibrate' in navigator;
};

/**
 * Haptic feedback patterns for different interaction types
 */
export const haptics = {
  /**
   * Light tap - for selections, toggles, minor interactions
   * Duration: 10ms
   */
  light: (): void => {
    if (canVibrate()) navigator.vibrate(10);
  },

  /**
   * Medium tap - for button presses, confirmations
   * Duration: 20ms
   */
  medium: (): void => {
    if (canVibrate()) navigator.vibrate(20);
  },

  /**
   * Heavy tap - for important actions, drag completion
   * Duration: 30ms
   */
  heavy: (): void => {
    if (canVibrate()) navigator.vibrate(30);
  },

  /**
   * Success pattern - for completing tasks, successful saves
   * Pattern: short-pause-long
   */
  success: (): void => {
    if (canVibrate()) navigator.vibrate([10, 50, 20]);
  },

  /**
   * Error pattern - for validation errors, failed actions
   * Pattern: three quick pulses
   */
  error: (): void => {
    if (canVibrate()) navigator.vibrate([30, 50, 30, 50, 30]);
  },

  /**
   * Warning pattern - for destructive action confirmations
   * Pattern: two medium pulses
   */
  warning: (): void => {
    if (canVibrate()) navigator.vibrate([20, 40, 20]);
  },

  /**
   * Selection change - for tab switches, option selections
   * Duration: 5ms (very subtle)
   */
  selection: (): void => {
    if (canVibrate()) navigator.vibrate(5);
  },

  /**
   * Custom pattern - for specific use cases
   * @param pattern - Array of durations in ms [vibrate, pause, vibrate, ...]
   */
  custom: (pattern: number | number[]): void => {
    if (canVibrate()) navigator.vibrate(pattern);
  },
};

export default haptics;

