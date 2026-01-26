// contexts/SupabaseContext.tsx
// Provides authenticated Supabase client with Clerk JWT token for RLS policies

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuth, useUser } from '@clerk/clerk-react';
import { createAuthenticatedClient, SupabaseClient, supabase, updateCurrentToken, setFreshTokenGetter } from '../services/supabase';
import { logger } from '../utils/logger';

type SupabaseContextValue = {
  client: SupabaseClient | null;
  isAuthClient: boolean; // true only when client was created with JWT
  refreshToken: () => Promise<void>; // Function to manually refresh token
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
  // Note: refreshIntervalRef removed - no longer needed with fresh token on every request

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

    logger.log('[SupabaseContext] 🔄 Refreshing JWT token...');
    // REMOVED: setIsAuthClient(false) - this was causing data to disappear!
    // Keep the old client working while we refresh the token

    try {
      const templateName = import.meta.env.VITE_CLERK_JWT_TEMPLATE_NAME || 'supabase';
      let token: string | null = null;

      try {
        token = await getToken({ template: templateName });
      } catch (templateError) {
        logger.error('[SupabaseContext] Template token refresh failed:', templateError);
        try {
          token = await getToken();
        } catch (basicError) {
          logger.error('[SupabaseContext] Basic token refresh also failed:', basicError);
        }
      }

      if (!token) {
        logger.error('[SupabaseContext] ❌ Token refresh failed - no token received');
        // Only reset auth state on actual failure to get a token
        setIsAuthClient(false);
        globalIsAuthClientReady = false;
        return;
      }

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
      logger.error('[SupabaseContext] ❌ Token refresh error:', error);
      setIsAuthClient(false);
      globalIsAuthClientReady = false;
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
  // New pattern: Only clear on actual logout (isSignedIn becomes false)
  // Keep last known good reference during remounts/re-renders
  useEffect(() => {
    if (getToken && isSignedIn) {
      globalGetToken = getToken as any;
      // Register the fresh token getter with supabase.ts
      // This allows the customFetch to get fresh tokens on every request
      setFreshTokenGetter(getFreshClerkToken);
      logger.log('[SupabaseContext] ✅ Fresh token getter registered - proper auth enabled');
    } else if (!isSignedIn) {
      // Only clear when user is actually signed out
      // This prevents the "stuck in broken auth state" bug
      logger.log('[SupabaseContext] 🔓 User signed out - clearing auth globals');
      globalGetToken = null;
      globalTokenRefreshCallback = null;
      setFreshTokenGetter(null);
    }
    // NO cleanup function that nullifies - this was causing the bug!
    // The token getter should persist across remounts while user is signed in
  }, [getToken, isSignedIn]);

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
          setIsAuthClient(true);
          globalIsAuthClientReady = true;
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
    <SupabaseContext.Provider value={{ client, isAuthClient, refreshToken }}>
      {children}
    </SupabaseContext.Provider>
  );
};




