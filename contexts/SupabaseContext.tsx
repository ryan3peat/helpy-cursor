// contexts/SupabaseContext.tsx
// Provides authenticated Supabase client with Clerk JWT token for RLS policies

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useAuth, useUser } from '@clerk/clerk-react';
import { createAuthenticatedClient, SupabaseClient, supabase, updateCurrentToken, setFreshTokenGetter, isTokenExpiredOrExpiring, getTokenExpirySeconds } from '../services/supabase';
import { logger } from '../utils/logger';

/**
 * Detect if an error is a network connectivity issue (DNS failure, offline, etc.)
 * rather than an actual auth/server error. Used to avoid treating temporary
 * network outages as session expiry.
 */
function isNetworkError(error: any): boolean {
  if (!error) return false;
  const msg = (error?.message || error?.toString() || '').toLowerCase();
  return (
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('network error') ||
    msg.includes('net::err_name_not_resolved') ||
    msg.includes('net::err_internet_disconnected') ||
    msg.includes('net::err_network_changed') ||
    msg.includes('net::err_connection_refused') ||
    msg.includes('net::err_address_unreachable') ||
    msg.includes('load failed') ||        // Safari offline error
    msg.includes('the internet connection appears to be offline') || // Safari
    msg.includes('type error: cancelled') // iOS fetch abort on background
  );
}

type SupabaseContextValue = {
  client: SupabaseClient | null;
  isAuthClient: boolean; // true only when client was created with JWT
  refreshToken: () => Promise<void>; // Function to manually refresh token
  tokenRefreshCount: number; // Increments each time token is refreshed - components can watch this to refetch
};

const SupabaseContext = createContext<SupabaseContextValue | null>(null);

// Global reference for services to access authenticated client (outside React)
let globalAuthenticatedClient: SupabaseClient | null = null;

// Global flag to track if the authenticated client is ready (has valid JWT)
let globalIsAuthClientReady: boolean = false;

// Global token refresh callback for error handling
let globalTokenRefreshCallback: (() => Promise<void>) | null = null;

// Global reference to Clerk's getToken function - THE KEY TO PROPER TOKEN MANAGEMENT
// This allows us to get a FRESH token on every request instead of using a stale cached one
let globalGetToken: ((options?: { template: string }) => Promise<string | null>) | null = null;

/**
 * Get a fresh JWT token from Clerk.
 * This is the PROPER way to handle tokens - Clerk internally:
 * - Returns cached token if still valid (fast, no network call)
 * - Auto-refreshes if expired (seamless to caller)
 * - Returns the fresh token
 * 
 * This is how Netflix/Spotify handle auth - call the token provider fresh on each request.
 * 
 * @param forceRefresh - If true, bypasses Clerk's cache and forces a fresh token from the server
 */
export const getFreshClerkToken = async (forceRefresh: boolean = false): Promise<string | null> => {
  if (!globalGetToken) {
    logger.warn('[SupabaseContext] getFreshClerkToken called but globalGetToken not set');
    return null;
  }
  
  try {
    const templateName = import.meta.env.VITE_CLERK_JWT_TEMPLATE_NAME || 'supabase';
    
    // Clerk's getToken options:
    // - template: The JWT template to use
    // - skipCache: If true, bypasses the cache and fetches a new token from the server
    const options: any = { template: templateName };
    if (forceRefresh) {
      options.skipCache = true;
      logger.log('[SupabaseContext] 🔄 Forcing fresh token (skipCache=true)...');
    }
    
    const token = await globalGetToken(options);
    
    if (token) {
      // Update the cached token for backwards compatibility with existing code
      updateCurrentToken(token);
      if (forceRefresh) {
        logger.log('[SupabaseContext] ✅ Forced fresh token obtained successfully');
      }
    }
    
    return token;
  } catch (error) {
    logger.error('[SupabaseContext] getFreshClerkToken error:', error);
    // Try basic token as fallback (without template)
    try {
      const basicOptions: any = forceRefresh ? { skipCache: true } : {};
      const basicToken = await globalGetToken(basicOptions);
      if (basicToken) {
        updateCurrentToken(basicToken);
      }
      return basicToken;
    } catch {
      return null;
    }
  }
};

export const useSupabase = () => {
  const context = useContext(SupabaseContext);
  if (!context) {
    // Fallback to default client if context not available (for gradual migration)
    // This allows components to work during migration period
    return supabase;
  }
  return context.client;
};

/**
 * Get the authenticated Supabase client from outside React components
 * Used by service files that can't use hooks
 */
export const getAuthenticatedSupabaseClient = (): SupabaseClient | null => {
  return globalAuthenticatedClient;
};

/**
 * Trigger token refresh from outside React components
 * Used by error handlers when JWT expires
 */
export const refreshSupabaseToken = async (): Promise<void> => {
  if (globalTokenRefreshCallback) {
    await globalTokenRefreshCallback();
  }
};

/**
 * Hook to check if Supabase client is ready (JWT has been fetched)
 * Useful for components that need to wait before making authenticated requests
 */
export const useSupabaseReady = (): boolean => {
  const context = useContext(SupabaseContext);
  // Ready means we have an authenticated client (with JWT)
  return !!context?.isAuthClient;
};

/**
 * Hook to watch for token refreshes.
 * When the token is proactively refreshed (e.g., on app visibility change),
 * this counter increments. Components can use this as a dependency to refetch data.
 * 
 * This fixes the "stale data after app was backgrounded" issue where:
 * - User backgrounds the app for a while
 * - Token expires
 * - User returns to app
 * - Token gets refreshed proactively
 * - But data was fetched with OLD token and shows stale/empty results
 * 
 * By watching tokenRefreshCount, components can trigger a refetch when the token is refreshed.
 */
export const useTokenRefreshCount = (): number => {
  const context = useContext(SupabaseContext);
  return context?.tokenRefreshCount ?? 0;
};

/**
 * Check if Supabase auth client is ready from outside React components
 * Used by services that need to verify auth is available before making queries
 */
export const isSupabaseAuthReady = (): boolean => {
  return globalIsAuthClientReady;
};

interface SupabaseProviderProps {
  children: React.ReactNode;
}

export const SupabaseProvider: React.FC<SupabaseProviderProps> = ({ children }) => {
  logger.log('[SupabaseContext] 🎯 Component rendering/mounting');
  logger.log('[SupabaseContext] Clerk available:', typeof window !== 'undefined' ? !!window.Clerk : 'N/A (server)');
  
  const authResult = useAuth();
  const { getToken, isSignedIn } = authResult;
  
  // FIX: Use useUser to get isLoaded - this tells us when Clerk is fully initialized
  // Without this, on iOS PWA cold start, isSignedIn might be undefined (not false)
  // and we'd skip token fetching, causing the 5-second timeout to always fire
  const { isLoaded: clerkLoaded } = useUser();
  
  logger.log('[SupabaseContext] useAuth result:', {
    hasGetToken: !!getToken,
    isSignedIn,
    clerkLoaded,
    authKeys: Object.keys(authResult)
  });
  const [client, setClient] = useState<SupabaseClient | null>(null);
  const [isAuthClient, setIsAuthClient] = useState(false);
  const [tokenRefreshCount, setTokenRefreshCount] = useState(0);
  const lastVisibilityRefreshRef = useRef<number>(0);
  // Note: refreshIntervalRef removed - no longer needed with fresh token on every request
  
  // Track consecutive token refresh failures for graceful logout
  // After MAX_TOKEN_REFRESH_FAILURES consecutive failures, trigger session expired event
  const tokenRefreshFailuresRef = useRef<number>(0);
  const MAX_TOKEN_REFRESH_FAILURES = 3;

  // Circuit breaker: once session-expired has been dispatched, stop all retry loops
  // Reset only when the user signs back in or network recovers
  const sessionExpiredFiredRef = useRef<boolean>(false);

  logger.log('[SupabaseContext] 📊 Current state:', { 
    isSignedIn,
    clerkLoaded,
    hasGetToken: !!getToken,
    hasClient: !!client,
    isAuthClient
  });

  // Token refresh function
  // FIX: Don't set isAuthClient=false during refresh - this was causing subscriptions to tear down!
  // The old client remains valid while we get a fresh token. Only reset on actual failure.
  const refreshToken = useCallback(async () => {
    if (!isSignedIn || !getToken) {
      logger.log('[SupabaseContext] ⚠️ Cannot refresh token: not signed in or getToken unavailable');
      return;
    }

    // Circuit breaker: if session-expired already fired, don't keep retrying
    if (sessionExpiredFiredRef.current) {
      logger.log('[SupabaseContext] ⏹️ Session already expired - not retrying token refresh');
      return;
    }

    // Network check: don't count offline failures as auth failures
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      logger.warn('[SupabaseContext] 📡 Device offline - skipping token refresh (not counting as auth failure)');
      return;
    }

    logger.log('[SupabaseContext] 🔄 Refreshing JWT token...');
    // REMOVED: setIsAuthClient(false) - this was causing data to disappear!
    // Keep the old client working while we refresh the token

    try {
      const templateName = import.meta.env.VITE_CLERK_JWT_TEMPLATE_NAME || 'supabase';
      let token: string | null = null;

      try {
        token = await getToken({ template: templateName });
      } catch (templateError: any) {
        // Check if this is a network error rather than an auth error
        if (!navigator.onLine || isNetworkError(templateError)) {
          logger.warn('[SupabaseContext] 📡 Network error during token refresh - not counting as auth failure');
          return;
        }
        logger.error('[SupabaseContext] Template token refresh failed:', templateError);
        try {
          token = await getToken();
        } catch (basicError: any) {
          if (!navigator.onLine || isNetworkError(basicError)) {
            logger.warn('[SupabaseContext] 📡 Network error during fallback token refresh - not counting as auth failure');
            return;
          }
          logger.error('[SupabaseContext] Basic token refresh also failed:', basicError);
        }
      }

      if (!token) {
        // If we're offline now (network dropped mid-request), don't count as auth failure
        if (!navigator.onLine) {
          logger.warn('[SupabaseContext] 📡 Went offline during token refresh - not counting as auth failure');
          return;
        }

        // Increment failure counter
        tokenRefreshFailuresRef.current += 1;
        const failures = tokenRefreshFailuresRef.current;
        logger.error(`[SupabaseContext] ❌ Token refresh failed - no token received (attempt ${failures}/${MAX_TOKEN_REFRESH_FAILURES})`);
        
        // Only reset auth state on actual failure to get a token
        setIsAuthClient(false);
        globalIsAuthClientReady = false;
        
        // After max consecutive failures, dispatch session expired event
        // This allows App.tsx to show a modal and gracefully logout
        if (failures >= MAX_TOKEN_REFRESH_FAILURES) {
          logger.error('[SupabaseContext] 🚨 Max token refresh failures reached - triggering session expired');
          sessionExpiredFiredRef.current = true; // Circuit breaker: stop all future retries
          tokenRefreshFailuresRef.current = 0;
          window.dispatchEvent(new CustomEvent('helpy:session-expired', {
            detail: { reason: 'max_refresh_failures', attempts: failures }
          }));
        }
        return;
      }

      // Success! Reset failure counter and circuit breaker
      tokenRefreshFailuresRef.current = 0;
      sessionExpiredFiredRef.current = false;
      logger.log('[SupabaseContext] ✅ Token refreshed successfully');
      // Update the stored token
      updateCurrentToken(token);
      const authenticatedClient = await createAuthenticatedClient(token, refreshToken);
      setClient(authenticatedClient);
      globalAuthenticatedClient = authenticatedClient;
      // isAuthClient stays true (or becomes true) - no interruption to subscriptions
      setIsAuthClient(true);
      globalIsAuthClientReady = true;
    } catch (error: any) {
      // Don't count network errors as auth failures
      if (!navigator.onLine || isNetworkError(error)) {
        logger.warn('[SupabaseContext] 📡 Network error during token refresh - not counting as auth failure');
        return;
      }

      // Increment failure counter
      tokenRefreshFailuresRef.current += 1;
      const failures = tokenRefreshFailuresRef.current;
      logger.error(`[SupabaseContext] ❌ Token refresh error (attempt ${failures}/${MAX_TOKEN_REFRESH_FAILURES}):`, error);
      
      setIsAuthClient(false);
      globalIsAuthClientReady = false;
      
      // After max consecutive failures, dispatch session expired event
      if (failures >= MAX_TOKEN_REFRESH_FAILURES) {
        logger.error('[SupabaseContext] 🚨 Max token refresh failures reached - triggering session expired');
        sessionExpiredFiredRef.current = true; // Circuit breaker: stop all future retries
        tokenRefreshFailuresRef.current = 0;
        window.dispatchEvent(new CustomEvent('helpy:session-expired', {
          detail: { reason: 'max_refresh_failures', attempts: failures }
        }));
      }
    }
  }, [getToken, isSignedIn]);

  // Store refresh callback globally for error handlers
  // CRITICAL FIX: Don't nullify in cleanup - keep last known good reference
  // Only clear when user is actually signed out (handled in the token getter effect above)
  useEffect(() => {
    if (refreshToken) {
      globalTokenRefreshCallback = refreshToken;
    }
    // NO cleanup that nullifies - this was part of the "broken auth state" bug
  }, [refreshToken]);

  // Store getToken function globally so we can get fresh tokens on every request
  // This is the KEY to proper token management - no more stale cached tokens!
  // 
  // CRITICAL FIX: We NO LONGER nullify these in cleanup!
  // The old pattern caused a race condition where:
  // 1. Component remounts or isSignedIn briefly changes
  // 2. Cleanup runs, sets globalGetToken = null
  // 3. Any in-flight or subsequent requests fail because they can't get fresh tokens
  // 4. User sees "Failed to add item" and has to kill the app
  //
  // New pattern: Only clear on actual logout (isSignedIn becomes false AND clerkLoaded is true)
  // Keep last known good reference during remounts/re-renders
  //
  // CRITICAL FIX: Must check clerkLoaded before clearing globals!
  // During Clerk initialization, isSignedIn is undefined (not false).
  // !undefined = true in JavaScript, so without clerkLoaded check,
  // we'd clear globals while Clerk is still loading, causing auth failures.
  // See: https://clerk.com/docs - always gate auth logic behind isLoaded
  useEffect(() => {
    if (getToken && isSignedIn) {
      globalGetToken = getToken as any;
      // Register the fresh token getter with supabase.ts
      // This allows the customFetch to get fresh tokens on every request
      setFreshTokenGetter(getFreshClerkToken);
      logger.log('[SupabaseContext] ✅ Fresh token getter registered - proper auth enabled');
    } else if (clerkLoaded && !isSignedIn) {
      // Only clear when Clerk is fully loaded AND confirms user is signed out
      // clerkLoaded ensures we don't clear during initialization (when isSignedIn is undefined)
      logger.log('[SupabaseContext] 🔓 User signed out - clearing auth globals');
      globalGetToken = null;
      globalTokenRefreshCallback = null;
      setFreshTokenGetter(null);
    }
    // NO cleanup function that nullifies - this was causing the bug!
    // The token getter should persist across remounts while user is signed in
  }, [getToken, isSignedIn, clerkLoaded]);

  useEffect(() => {
    logger.log('[SupabaseContext] 🔄 useEffect triggered', { 
      isSignedIn,
      clerkLoaded,
      hasGetToken: !!getToken,
      getTokenType: typeof getToken
    });
    
    // FIX: Don't run until Clerk is fully loaded
    // On iOS PWA cold start, isSignedIn is undefined while Clerk loads
    // Without this check, we'd skip token fetching and isAuthClient stays false
    // This caused the 5-second timeout to always fire on iOS PWA
    if (!clerkLoaded) {
      logger.log('[SupabaseContext] ⏳ Waiting for Clerk to load...');
      return;
    }
    
    const initClient = async () => {
      // NOTE: Do NOT call setIsAuthClient(false) here!
      // It was causing data to flash (disappear then reappear) because:
      // 1. Setting false tears down subscriptions
      // 2. Then setting true restarts them with fresh fetch
      // 3. User sees cached data → empty → fresh data
      // Only set to false on actual failure (see error handlers below)
      logger.log('[SupabaseContext] 🚀 initClient called', { isSignedIn, clerkLoaded });
      
      if (isSignedIn) {
        try {
          // Get Clerk JWT token with 'supabase' template
          // Make sure you've created this template in Clerk Dashboard with clerk_id claim
          // Template name can be configured via environment variable or defaults to 'supabase'
          const templateName = import.meta.env.VITE_CLERK_JWT_TEMPLATE_NAME || 'supabase';
          logger.log('[SupabaseContext] Requesting JWT token with template:', templateName);

          let token;
          try {
            token = await getToken({ template: templateName });
            logger.log('[SupabaseContext] Template token result:', token ? 'SUCCESS' : 'NULL');
          } catch (templateError) {
            logger.error('[SupabaseContext] Template token failed:', templateError);
            // Try basic token as fallback
            logger.log('[SupabaseContext] Trying basic token...');
            try {
              token = await getToken();
              logger.log('[SupabaseContext] Basic token result:', token ? 'SUCCESS' : 'NULL');
            } catch (basicError) {
              logger.error('[SupabaseContext] Basic token also failed:', basicError);
            }
          }
          
          if (!token) {
            logger.error('[SupabaseContext] ❌ No JWT token received from Clerk');
            logger.error('[SupabaseContext] This means requests will NOT include JWT and RLS will fail');
            logger.error('[SupabaseContext] 🔄 Trying basic token as emergency fallback...');

            // Emergency fallback: try basic token
            try {
              const basicToken = await getToken();
              if (basicToken) {
                logger.log('[SupabaseContext] ✅ Basic token fallback successful');
                token = basicToken;
              } else {
                logger.error('[SupabaseContext] ❌ Basic token also failed');
                const { supabase } = await import('../services/supabase');
                setClient(supabase);
                globalAuthenticatedClient = supabase;
                setIsAuthClient(false);
                globalIsAuthClientReady = false;
                return;
              }
            } catch (basicError) {
              logger.error('[SupabaseContext] ❌ Basic token error:', basicError);
              const { supabase } = await import('../services/supabase');
              setClient(supabase);
              globalAuthenticatedClient = supabase;
              setIsAuthClient(false);
              globalIsAuthClientReady = false;
              return;
            }
          }
          
          logger.log('[SupabaseContext] ✅ JWT token received:', token.substring(0, 50) + '...');
          logger.log('[SupabaseContext] Token length:', token.length);
          
          // Decode and log JWT claims for debugging
          try {
            const parts = token.split('.');
            if (parts.length === 3) {
              const payload = parts[1];
              const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
              const jsonPayload = decodeURIComponent(
                atob(base64)
                  .split('')
                  .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                  .join('')
              );
              const claims = JSON.parse(jsonPayload);
              logger.log('[SupabaseContext] JWT Claims:', claims);
              
              // Check for critical claims
              if (claims.clerk_id) {
                logger.log('[SupabaseContext] ✅ clerk_id claim present:', claims.clerk_id);
              } else {
                logger.warn('[SupabaseContext] ⚠️ clerk_id claim MISSING! RLS will fail.');
                logger.warn('[SupabaseContext] 💡 Add { "clerk_id": "{{user.id}}" } to your Clerk JWT template');
                if (claims.sub) {
                  logger.log('[SupabaseContext] ℹ️ "sub" claim available:', claims.sub, '- migration 041 will use this as fallback');
                }
              }
            }
          } catch (decodeError) {
            logger.warn('[SupabaseContext] Could not decode JWT for debugging:', decodeError);
          }
          // Update the stored token
          updateCurrentToken(token);
          const authenticatedClient = await createAuthenticatedClient(token, refreshToken);
          setClient(authenticatedClient);
          globalAuthenticatedClient = authenticatedClient;
          logger.log('[SupabaseContext] ✅ Authenticated Supabase client created');
          
          // CRITICAL: Verify token getter is working BEFORE marking client as ready
          // This prevents race condition where subscriptions start but token isn't available yet
          // The token getter useEffect should have run by now, but we verify to be safe
          // getFreshClerkToken is defined in this file and uses globalGetToken
          const verificationToken = await getFreshClerkToken(false);
          if (verificationToken) {
            logger.log('[SupabaseContext] ✅ Token getter verification passed - safe to start subscriptions');
            setIsAuthClient(true);
            globalIsAuthClientReady = true;
          } else {
            // Token getter not working yet - wait a bit and retry
            logger.warn('[SupabaseContext] ⚠️ Token getter verification failed, retrying...');
            await new Promise(resolve => setTimeout(resolve, 300));
            const retryToken = await getFreshClerkToken(false);
            if (retryToken) {
              logger.log('[SupabaseContext] ✅ Token getter verification passed on retry');
              setIsAuthClient(true);
              globalIsAuthClientReady = true;
            } else {
              // Still failing - set ready anyway but log warning
              // This prevents infinite waiting, but subscriptions may fail
              logger.error('[SupabaseContext] ❌ Token getter still not working - subscriptions may fail initially');
              setIsAuthClient(true);
              globalIsAuthClientReady = true;
            }
          }
        } catch (error: any) {
          logger.error('[SupabaseContext] Failed to create authenticated client:', error);
          
          // Check if it's a template name error
          if (error?.message?.includes('No JWT template exists')) {
            logger.error('[SupabaseContext] JWT template not found. Please:');
            logger.error('1. Go to Clerk Dashboard → Configure → JWT Templates');
            logger.error('2. Create a template named "supabase" (or set VITE_CLERK_JWT_TEMPLATE_NAME)');
            logger.error('3. Add custom claim: { "clerk_id": "{{user.id}}" }');
          }

          // Additional error logging
          logger.error('[SupabaseContext] Full error details:', {
            message: error?.message,
            name: error?.name,
            stack: error?.stack
          });
          
          // Fallback to default client on error
          const { supabase } = await import('../services/supabase');
          setClient(supabase);
          globalAuthenticatedClient = supabase;
          setIsAuthClient(false);
          globalIsAuthClientReady = false;
        }
      } else {
        // User not signed in, use default client (will fail RLS checks, but that's expected)
        logger.log('[SupabaseContext] ⚠️ User not signed in, using default client (no JWT)');
        const { supabase } = await import('../services/supabase');
        setClient(supabase);
        globalAuthenticatedClient = supabase;
        setIsAuthClient(false);
        globalIsAuthClientReady = false;
      }
    };
    
    initClient();
  }, [getToken, isSignedIn, clerkLoaded]);

  // REMOVED: Periodic token refresh is no longer needed!
  // We now call getFreshClerkToken() on every Supabase request, which:
  // - Returns cached token if still valid (fast, no network call)
  // - Auto-refreshes if expired (Clerk handles this internally)
  // - Returns fresh token seamlessly
  // This is the proper way to handle tokens (like Netflix/Spotify do).

  // PROACTIVE TOKEN REFRESH ON VISIBILITY CHANGE
  // When user returns to app (switches back from another tab/app):
  // - If app was backgrounded for more than 5 minutes, ALWAYS refresh token and trigger data refetch
  // - This fixes the "stale data after returning to app" issue where family members don't see updates
  // - Even if token isn't expired, realtime subscriptions may have disconnected
  const lastVisibleTimestampRef = useRef<number>(Date.now());
  const BACKGROUND_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes - if backgrounded longer, force refresh
  
  useEffect(() => {
    if (!isSignedIn || !getToken) return;
    
    const handleVisibilityChange = async () => {
      const now = Date.now();
      
      if (document.visibilityState !== 'visible') {
        // App going to background - record the timestamp
        lastVisibleTimestampRef.current = now;
        logger.log('[SupabaseContext] 📱 App going to background');
        return;
      }
      
      // Circuit breaker: don't retry if session already expired
      if (sessionExpiredFiredRef.current) {
        logger.log('[SupabaseContext] ⏹️ Session already expired - skipping visibility refresh');
        return;
      }

      // Network check: don't attempt refresh while offline
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        logger.warn('[SupabaseContext] 📡 Device offline on resume - skipping token refresh');
        return;
      }
      
      // Throttle: Don't check more than once per 10 seconds
      if (now - lastVisibilityRefreshRef.current < 10000) {
        logger.log('[SupabaseContext] 👀 Visibility change throttled (too recent)');
        return;
      }
      
      const timeInBackground = now - lastVisibleTimestampRef.current;
      const wasBackgroundedLong = timeInBackground > BACKGROUND_THRESHOLD_MS;
      
      logger.log(`[SupabaseContext] 👀 App became visible after ${Math.round(timeInBackground / 1000)}s in background`);
      lastVisibilityRefreshRef.current = now;
      
      try {
        const templateName = import.meta.env.VITE_CLERK_JWT_TEMPLATE_NAME || 'supabase';
        const currentToken = await getToken({ template: templateName });
        
        if (!currentToken) {
          if (navigator.onLine) {
            logger.error('[SupabaseContext] ❌ No token on visibility change while online - session likely expired');
            tokenRefreshFailuresRef.current += 1;
            if (tokenRefreshFailuresRef.current >= MAX_TOKEN_REFRESH_FAILURES) {
              sessionExpiredFiredRef.current = true;
              tokenRefreshFailuresRef.current = 0;
              window.dispatchEvent(new CustomEvent('helpy:session-expired', {
                detail: { reason: 'no_token_on_resume', attempts: MAX_TOKEN_REFRESH_FAILURES }
              }));
            }
          } else {
            logger.warn('[SupabaseContext] 📡 No token on visibility change - device offline');
          }
          return;
        }
        
        // FIX: If app was backgrounded for more than 5 minutes, ALWAYS force refresh
        // This ensures realtime subscriptions are re-established and data is refetched
        // Even if token hasn't expired, the websocket connections may have dropped
        const tokenExpiring = isTokenExpiredOrExpiring(currentToken, 60);
        const shouldRefresh = tokenExpiring || wasBackgroundedLong;
        
        if (shouldRefresh) {
          const reason = tokenExpiring ? 'token expiring' : `backgrounded for ${Math.round(timeInBackground / 60000)} minutes`;
          logger.log(`[SupabaseContext] 🔄 Forcing token refresh (${reason})...`);
          
          // Force a fresh token from Clerk
          const freshToken = await getToken({ template: templateName, skipCache: true } as any);
          
          if (freshToken) {
            logger.log('[SupabaseContext] ✅ Token refresh successful');
            updateCurrentToken(freshToken);
            
            // Reset circuit breaker on success (e.g. if network just came back)
            sessionExpiredFiredRef.current = false;
            tokenRefreshFailuresRef.current = 0;
            
            // CRITICAL: Increment counter so components re-subscribe and refetch data
            // This is what triggers syncAllData and re-establishes realtime subscriptions
            setTokenRefreshCount(prev => prev + 1);
            logger.log('[SupabaseContext] 📢 Token refresh count incremented - triggering data refetch');
          } else {
            logger.warn('[SupabaseContext] ⚠️ Token refresh returned no token');
          }
        } else {
          const expirySeconds = getTokenExpirySeconds(currentToken);
          logger.log(`[SupabaseContext] ✅ Token fresh (expires in ${expirySeconds}s), no refresh needed`);
        }
      } catch (error: any) {
        // Don't log network errors as token refresh errors
        if (!navigator.onLine || isNetworkError(error)) {
          logger.warn('[SupabaseContext] 📡 Network error during visibility token refresh - will retry when online');
        } else {
          logger.error('[SupabaseContext] ❌ Error during token refresh:', error);
        }
      }
    };
    
    // Also check on initial mount (in case app was backgrounded for a long time)
    handleVisibilityChange();
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isSignedIn, getToken]);

  // AUTO-RECOVERY: When network comes back online, attempt to restore the session
  // This handles the case where the app was offline, token refresh failed, and
  // session-expired was triggered. When network returns, try to refresh the token
  // instead of forcing the user to sign in again.
  useEffect(() => {
    if (!isSignedIn || !getToken) return;

    const handleOnline = async () => {
      logger.log('[SupabaseContext] 🌐 Network came back online');
      
      // Reset circuit breaker so we can try again
      const wasExpired = sessionExpiredFiredRef.current;
      sessionExpiredFiredRef.current = false;
      tokenRefreshFailuresRef.current = 0;

      // Small delay to let DNS/network stabilize
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Only attempt recovery if we're still online
      if (!navigator.onLine) {
        logger.warn('[SupabaseContext] 📡 Network dropped again before recovery');
        return;
      }

      try {
        const templateName = import.meta.env.VITE_CLERK_JWT_TEMPLATE_NAME || 'supabase';
        const freshToken = await getToken({ template: templateName, skipCache: true } as any);
        
        if (freshToken) {
          logger.log('[SupabaseContext] ✅ Network recovery: token refresh successful');
          updateCurrentToken(freshToken);
          
          const authenticatedClient = await createAuthenticatedClient(freshToken, refreshToken);
          setClient(authenticatedClient);
          globalAuthenticatedClient = authenticatedClient;
          setIsAuthClient(true);
          globalIsAuthClientReady = true;
          
          // Trigger data refetch for all components
          setTokenRefreshCount(prev => prev + 1);
          
          // If session-expired modal was shown, dismiss it
          if (wasExpired) {
            logger.log('[SupabaseContext] 🔄 Dismissing session-expired state after network recovery');
            window.dispatchEvent(new CustomEvent('helpy:session-recovered'));
          }
        } else {
          logger.warn('[SupabaseContext] ⚠️ Network recovery: still no token (may need re-auth)');
        }
      } catch (error: any) {
        if (isNetworkError(error)) {
          logger.warn('[SupabaseContext] 📡 Network recovery failed - still having connectivity issues');
        } else {
          logger.error('[SupabaseContext] ❌ Network recovery token refresh failed:', error);
        }
      }
    };

    window.addEventListener('online', handleOnline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [isSignedIn, getToken, refreshToken]);

  // Expose diagnostic function globally for console debugging
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).helpyTestJWT = async () => {
        logger.log('🔍 Manual JWT Test Starting...');
        logger.log('Clerk available:', !!window.Clerk);
        logger.log('isSignedIn:', isSignedIn);
        logger.log('getToken available:', !!getToken);
        
        if (!isSignedIn) {
          logger.error('❌ User is not signed in!');
          return;
        }
        
        if (!getToken) {
          logger.error('❌ getToken function not available!');
          return;
        }
        
        try {
          const templateName = import.meta.env.VITE_CLERK_JWT_TEMPLATE_NAME || 'supabase';
          logger.log('📝 Attempting to get token with template:', templateName);
          
          const token = await getToken({ template: templateName } as any);
          if (token) {
            logger.log('✅ Token received! Length:', token.length);
            logger.log('Token preview:', token.substring(0, 50) + '...');
            
            // Decode token
            try {
              const parts = token.split('.');
              const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
              logger.log('📋 Token claims:', payload);
              logger.log('clerk_id claim:', payload.clerk_id || '❌ MISSING');
            } catch (e) {
              logger.error('Failed to decode token:', e);
            }
          } else {
            logger.error('❌ Token is NULL!');
          }
        } catch (error: any) {
          logger.error('❌ Error getting token:', error);
          logger.error('Error message:', error?.message);
        }
      };
      
      logger.log('[SupabaseContext] 💡 Run window.helpyTestJWT() in console to manually test JWT retrieval');
    }
  }, [isSignedIn, getToken]);

  return (
    <SupabaseContext.Provider value={{ client, isAuthClient, refreshToken, tokenRefreshCount }}>
      {children}
    </SupabaseContext.Provider>
  );
};




