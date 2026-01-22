/**
 * PWA Installation Service
 * 
 * Tracks PWA installations per user per device in Supabase.
 * This allows us to know if a user has already installed Helpy as PWA
 * on a specific device, so we don't show the install prompt again.
 */

import { supabase } from './supabase';
import { getAuthenticatedSupabaseClient, refreshSupabaseToken } from '../contexts/SupabaseContext';
import { logger } from '../utils/logger';
import { getDeviceId, isIosDevice, isAndroidDevice } from '../utils/pwaUtils';

// ============================================================================
// HELPER: Get authenticated Supabase client (for RLS) or fallback to default
// ============================================================================

function getSupabaseClient() {
  const authClient = getAuthenticatedSupabaseClient();
  if (!authClient) {
    logger.warn('[pwaService] ⚠️ No authenticated client available, using default (may fail RLS)');
  }
  return authClient || supabase;
}

/**
 * Check if an error is JWT/auth related and should trigger a retry
 */
function isJwtError(error: any): boolean {
  if (!error) return false;
  if (error.code === 'PGRST303') return true;
  const message = error.message?.toLowerCase() || '';
  if (message.includes('jwt expired')) return true;
  if (message.includes('jwt') && message.includes('expired')) return true;
  if (message.includes('invalid jwt')) return true;
  if (error.code === '42501' && message.includes('policy')) return true;
  return false;
}

// ============================================================================
// INSTALLATION TRACKING
// ============================================================================

/**
 * Check if the current device has the PWA installed for a specific user
 * 
 * @param userId - The Supabase UUID of the user
 * @returns true if PWA is installed on this device for this user
 */
export async function isDevicePwaInstalled(userId: string): Promise<boolean> {
  try {
    const deviceId = getDeviceId();
    
    let { data, error } = await getSupabaseClient()
      .from('pwa_installations')
      .select('id')
      .eq('user_id', userId)
      .eq('device_id', deviceId)
      .limit(1);

    // SELF-HEALING: If JWT error, refresh token and retry ONCE
    if (error && isJwtError(error)) {
      logger.warn('[pwaService] ⚠️ JWT error on isDevicePwaInstalled, refreshing token...');
      try {
        await refreshSupabaseToken();
        const retryResult = await getSupabaseClient()
          .from('pwa_installations')
          .select('id')
          .eq('user_id', userId)
          .eq('device_id', deviceId)
          .limit(1);
        if (!retryResult.error) {
          logger.log('[pwaService] ✅ Retry successful');
          data = retryResult.data;
          error = null;
        }
      } catch (refreshError) {
        logger.error('[pwaService] ❌ Token refresh failed:', refreshError);
      }
    }
    
    if (error) {
      logger.error('[PWA Service] Error checking installation:', error);
      return false;
    }
    
    const isInstalled = data && data.length > 0;
    logger.log('[PWA Service] Device installation check:', { userId, deviceId, isInstalled });
    return isInstalled;
  } catch (error) {
    logger.error('[PWA Service] Failed to check installation:', error);
    return false;
  }
}

/**
 * Record that the PWA has been installed on the current device for a user
 * 
 * @param userId - The Supabase UUID of the user
 * @param householdId - The household ID
 */
export async function recordPwaInstallation(
  userId: string,
  householdId: string
): Promise<boolean> {
  try {
    const deviceId = getDeviceId();
    const platform = isIosDevice() ? 'ios' : isAndroidDevice() ? 'android' : 'desktop';
    const userAgent = navigator.userAgent;
    
    logger.log('[PWA Service] Recording installation:', { userId, householdId, deviceId, platform });
    
    const { error } = await getSupabaseClient()
      .from('pwa_installations')
      .upsert({
        user_id: userId,
        household_id: householdId,
        device_id: deviceId,
        user_agent: userAgent,
        platform,
        installed_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,device_id'
      });
    
    if (error) {
      logger.error('[PWA Service] Error recording installation:', error);
      return false;
    }
    
    logger.log('[PWA Service] Installation recorded successfully');
    return true;
  } catch (error) {
    logger.error('[PWA Service] Failed to record installation:', error);
    return false;
  }
}

/**
 * Remove installation record for a device (for testing/debugging)
 * 
 * @param userId - The Supabase UUID of the user
 */
export async function clearPwaInstallation(userId: string): Promise<boolean> {
  try {
    const deviceId = getDeviceId();
    
    const { error } = await getSupabaseClient()
      .from('pwa_installations')
      .delete()
      .eq('user_id', userId)
      .eq('device_id', deviceId);
    
    if (error) {
      logger.error('[PWA Service] Error clearing installation:', error);
      return false;
    }
    
    logger.log('[PWA Service] Installation cleared for device:', deviceId);
    return true;
  } catch (error) {
    logger.error('[PWA Service] Failed to clear installation:', error);
    return false;
  }
}

