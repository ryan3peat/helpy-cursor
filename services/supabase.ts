import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Memory-only storage implementation to prevent "Multiple GoTrueClient instances" warning
// This ensures the default client uses a separate storage key from the authenticated client
const memoryStorage: Storage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
  clear: () => {},
  get length() { return 0; },
  key: () => null,
};

// Default client (for backward compatibility during migration)
// Note: This client won't have JWT tokens, so RLS policies won't work until migration is complete
// Uses memory-only storage to prevent "Multiple GoTrueClient instances" warning
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
    storage: memoryStorage, // Use memory-only storage to prevent conflicts
    storageKey: 'helpy-default-client-auth', // Unique storage key
  },
});

// SINGLETON: Reuse the same authenticated client to prevent "Multiple GoTrueClient instances" warning
// The customFetch inside handles getting fresh tokens on every request, so we don't need new clients
let authenticatedClientSingleton: SupabaseClient | null = null;

// Global token refresh function (set by SupabaseContext)
let globalTokenRefresh: (() => Promise<void>) | null = null;
let currentToken: string | null = null;

// THE PROPER WAY: Store reference to Clerk's getToken function
// This allows us to get a FRESH token on every request (like Netflix/Spotify do)
// The forceRefresh parameter bypasses Clerk's cache when true
let globalGetFreshToken: ((forceRefresh?: boolean) => Promise<string | null>) | null = null;

// Retry configuration for auth failures
const AUTH_RETRY_CONFIG = {
  maxAttempts: 3,
  delayMs: [0, 500, 1000], // No delay first, then 500ms, then 1s
  waitForTokenGetterMs: 100, // Wait time when token getter is temporarily unavailable
  maxWaitForTokenGetterAttempts: 5, // Max times to wait for token getter
};

/**
 * Set the fresh token getter function.
 * This is called by SupabaseContext to register the token provider.
 * Getting a fresh token on every request is the PROPER way to handle auth:
 * - Clerk internally caches valid tokens (fast, no network call)
 * - Clerk auto-refreshes expired tokens seamlessly
 * - No more stale token issues!
 * 
 * @param getter - Function that takes optional forceRefresh param and returns fresh token
 */
export const setFreshTokenGetter = (getter: ((forceRefresh?: boolean) => Promise<string | null>) | null) => {
  globalGetFreshToken = getter;
  if (getter) {
    logger.log('[Supabase] ✅ Fresh token getter registered - proper auth enabled');
  }
};

/**
 * Set the token refresh function and current token
 * Called by SupabaseContext when creating authenticated client
 */
export const setTokenRefresh = (refreshFn: (() => Promise<void>) | null, token: string | null) => {
  globalTokenRefresh = refreshFn;
  currentToken = token;
};

/**
 * Update the current token (called after refresh)
 */
export const updateCurrentToken = (token: string | null) => {
  currentToken = token;
};

/**
 * Wait for a specified number of milliseconds
 */
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Get a fresh token with retry logic.
 * This is the KEY to fixing the stale token bug.
 * 
 * NEVER falls back to stale cached tokens.
 * If we can't get a fresh token after retries, we return null and let the request fail cleanly.
 * 
 * @param forceRefresh - If true, bypasses Clerk's cache and forces a fresh token
 * @returns Fresh token or null if unable to get one
 */
async function getFreshTokenWithRetry(forceRefresh: boolean = false): Promise<string | null> {
  // If globalGetFreshToken is null, it might be a race condition during React re-render
  // Wait briefly and check again before giving up
  if (!globalGetFreshToken) {
    logger.warn('[Supabase] ⚠️ Token getter not available, waiting for React to stabilize...');
    
    for (let i = 0; i < AUTH_RETRY_CONFIG.maxWaitForTokenGetterAttempts; i++) {
      await delay(AUTH_RETRY_CONFIG.waitForTokenGetterMs);
      if (globalGetFreshToken) {
        logger.log('[Supabase] ✅ Token getter became available after wait');
        break;
      }
    }
    
    // If still not available, try the refresh function as last resort
    if (!globalGetFreshToken) {
      logger.warn('[Supabase] ⚠️ Token getter still unavailable, trying globalTokenRefresh...');
      if (globalTokenRefresh) {
        try {
          await globalTokenRefresh();
          // After refresh, currentToken should be updated
          if (currentToken) {
            logger.log('[Supabase] ✅ Got token via globalTokenRefresh fallback');
            return currentToken;
          }
        } catch (e) {
          logger.error('[Supabase] ❌ globalTokenRefresh fallback failed:', e);
        }
      }
      logger.error('[Supabase] ❌ No way to get fresh token - user may need to re-login');
      return null;
    }
  }
  
  // Try to get fresh token (with forceRefresh if requested)
  try {
    const token = await globalGetFreshToken(forceRefresh);
    if (token) {
      return token;
    }
    logger.warn('[Supabase] ⚠️ Fresh token getter returned null');
  } catch (e) {
    logger.warn('[Supabase] ⚠️ Fresh token getter threw error:', e);
  }
  
  // If first attempt failed, try with forceRefresh=true (bypass Clerk cache)
  if (!forceRefresh && globalGetFreshToken) {
    logger.log('[Supabase] 🔄 Retrying with forceRefresh=true...');
    try {
      const token = await globalGetFreshToken(true);
      if (token) {
        logger.log('[Supabase] ✅ Got token with forceRefresh=true');
        return token;
      }
    } catch (e) {
      logger.warn('[Supabase] ⚠️ forceRefresh attempt failed:', e);
    }
  }
  
  // If fresh token failed, try the globalTokenRefresh as last resort
  if (globalTokenRefresh) {
    logger.log('[Supabase] 🔄 Last resort: calling globalTokenRefresh...');
    try {
      await globalTokenRefresh();
      // Try getting fresh token again after refresh
      if (globalGetFreshToken) {
        const token = await globalGetFreshToken(true); // Force fresh after refresh
        if (token) {
          logger.log('[Supabase] ✅ Got token after globalTokenRefresh');
          return token;
        }
      }
      // Or use the currentToken that should have been updated by globalTokenRefresh
      if (currentToken) {
        logger.log('[Supabase] ✅ Using currentToken after globalTokenRefresh');
        return currentToken;
      }
    } catch (e) {
      logger.error('[Supabase] ❌ globalTokenRefresh failed:', e);
    }
  }
  
  // CRITICAL: Do NOT fall back to potentially stale currentToken here
  // If we couldn't get a fresh token, return null and let the request fail cleanly
  logger.error('[Supabase] ❌ Unable to get fresh token after all attempts');
  return null;
}

/**
 * Check if a response indicates an auth/JWT error that should trigger retry
 */
function isAuthError(status: number, responseData?: any): boolean {
  if (status === 401 || status === 403) return true;
  if (responseData?.code === 'PGRST303') return true;
  const message = responseData?.message?.toLowerCase() || '';
  if (message.includes('jwt') || message.includes('token') || message.includes('auth')) return true;
  return false;
}

// Function to create authenticated client with Clerk JWT token
// This client will include the JWT in headers, allowing RLS policies to work
// FIX: Now returns singleton to prevent "Multiple GoTrueClient instances" warning
export const createAuthenticatedClient = async (clerkToken: string | null, tokenRefresh?: () => Promise<void>): Promise<SupabaseClient> => {
  if (!clerkToken) {
    logger.warn('[Supabase] No JWT token provided, creating client without authentication');
    return supabase; // Return default client instead of creating new one
  }
  
  // Store token refresh function globally (always update these)
  if (tokenRefresh) {
    setTokenRefresh(tokenRefresh, clerkToken);
  } else {
    // Still update the current token even if no refresh function
    currentToken = clerkToken;
  }
  
  // SINGLETON PATTERN: Reuse existing client if available
  // The customFetch already handles getting fresh tokens via globalGetFreshToken
  // So we don't need a new client, we just need to update the token references
  if (authenticatedClientSingleton) {
    logger.log('[Supabase] Reusing existing authenticated client (token updated)');
    return authenticatedClientSingleton;
  }
  
  logger.log('[Supabase] Creating authenticated client with JWT token');
  logger.log('[Supabase] Token preview:', clerkToken.substring(0, 50) + '...');
  
  /**
   * ROBUST CUSTOM FETCH WITH SILENT RETRY
   * 
   * This is the key to making auth invisible to users (like Netflix/Spotify):
   * 1. Get a FRESH token before every request (never use stale cached tokens)
   * 2. If request fails with auth error, force token refresh and retry
   * 3. Retry up to 3 times with delays before showing any error to user
   * 4. User never knows there was an auth issue - it just works
   */
  const customFetch = async (url: RequestInfo | URL, options: RequestInit = {}) => {
    const requestUrl = typeof url === 'string' ? url : url.toString();
    const isSupabaseRequest = requestUrl.includes('supabase.co');
    
    // For non-Supabase requests, just pass through
    if (!isSupabaseRequest) {
      return fetch(url, options);
    }
    
    let lastError: Error | null = null;
    let lastResponse: Response | null = null;
    
    // RETRY LOOP: Try up to maxAttempts times with actual token refresh between attempts
    for (let attempt = 0; attempt < AUTH_RETRY_CONFIG.maxAttempts; attempt++) {
      // Wait before retry (no delay on first attempt)
      const isRetry = attempt > 0;
      if (isRetry) {
        const delayTime = AUTH_RETRY_CONFIG.delayMs[attempt] || AUTH_RETRY_CONFIG.delayMs[AUTH_RETRY_CONFIG.delayMs.length - 1];
        logger.log(`[Supabase] 🔄 Retry attempt ${attempt + 1}/${AUTH_RETRY_CONFIG.maxAttempts} after ${delayTime}ms delay...`);
        await delay(delayTime);
        
        // Force a token refresh before retry - this is the KEY fix
        // Don't just retry with the same broken state
        if (globalTokenRefresh) {
          try {
            logger.log('[Supabase] 🔄 Forcing token refresh before retry...');
            await globalTokenRefresh();
          } catch (e) {
            logger.warn('[Supabase] ⚠️ Token refresh before retry failed:', e);
          }
        }
      }
      
      // Get fresh token - NEVER fall back to stale tokens
      // On retry attempts, force a fresh token from Clerk's server (bypass cache)
      const token = await getFreshTokenWithRetry(isRetry);
      
      if (!token) {
        // Couldn't get any token - this is a serious auth issue
        // On first attempt, try continuing without token (will likely fail but gives better error)
        // On retry attempts, this means refresh didn't help
        if (attempt > 0) {
          logger.error(`[Supabase] ❌ Still no token after ${attempt + 1} attempts`);
          // Continue to make the request anyway - Supabase will return a clear auth error
        } else {
          logger.warn('[Supabase] ⚠️ No token available, request will likely fail');
        }
      }
      
      // Build headers with token
      const headers = new Headers(options.headers);
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      
      // Log for debugging (reduced frequency)
      if (Math.random() < 0.1 || attempt > 0) {
        logger.log('[Supabase] Request:', {
          url: requestUrl.substring(0, 80),
          attempt: attempt + 1,
          hasToken: !!token,
          tokenPreview: token ? token.substring(0, 20) + '...' : 'none'
        });
      }
      
      try {
        const response = await fetch(url, { ...options, headers });
        
        // SUCCESS: Request completed (may still be an HTTP error, but not a network failure)
        
        // Check if it's an auth error that we should retry
        if (isAuthError(response.status)) {
          // Try to parse response for more details
          let responseData: any = null;
          try {
            const clonedResponse = response.clone();
            const responseText = await clonedResponse.text();
            responseData = responseText ? JSON.parse(responseText) : {};
          } catch {
            // Ignore parse errors
          }
          
          if (isAuthError(response.status, responseData)) {
            logger.warn(`[Supabase] ⚠️ Auth error (${response.status}) on attempt ${attempt + 1}:`, responseData?.message || 'Unknown');
            lastResponse = response;
            
            // If we have more attempts, continue the retry loop
            if (attempt < AUTH_RETRY_CONFIG.maxAttempts - 1) {
              continue; // This will trigger the retry with forced token refresh
            }
            
            // Out of retries - return the error response
            logger.error(`[Supabase] ❌ Auth error persisted after ${AUTH_RETRY_CONFIG.maxAttempts} attempts`);
            return response;
          }
        }
        
        // Non-auth error or success - return the response
        return response;
        
      } catch (networkError) {
        // Network failure (not HTTP error)
        logger.warn(`[Supabase] ⚠️ Network error on attempt ${attempt + 1}:`, networkError);
        lastError = networkError instanceof Error ? networkError : new Error(String(networkError));
        
        // If we have more attempts, continue
        if (attempt < AUTH_RETRY_CONFIG.maxAttempts - 1) {
          continue;
        }
        
        // Out of retries - throw the error
        throw lastError;
      }
    }
    
    // Should not reach here, but just in case
    if (lastResponse) {
      return lastResponse;
    }
    if (lastError) {
      throw lastError;
    }
    throw new Error('[Supabase] Unexpected state in customFetch retry loop');
  };
  
  const client = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      fetch: customFetch,
    },
    auth: {
      storageKey: 'helpy-authenticated-client-auth', // Unique storage key to prevent conflicts
    },
  });
  
  // Store in singleton for reuse
  authenticatedClientSingleton = client;
  
  logger.log('[Supabase] ✅ Authenticated client created (singleton) with robust retry logic');
  return client;
};