// contexts/SupabaseContext.tsx
// Provides authenticated Supabase client with Clerk JWT token for RLS policies

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { createAuthenticatedClient, SupabaseClient, supabase, updateCurrentToken, setFreshTokenGetter } from '../services/supabase';

type SupabaseContextValue = {
  client: SupabaseClient | null;
  isAuthClient: boolean; // true only when client was created with JWT
  refreshToken: () => Promise<void>; // Function to manually refresh token
};

const SupabaseContext = createContext<SupabaseContextValue | null>(null);

// Global reference for services to access authenticated client (outside React)
let globalAuthenticatedClient: SupabaseClient | null = null;

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
 */
export const getFreshClerkToken = async (): Promise<string | null> => {
  if (!globalGetToken) {
    console.warn('[SupabaseContext] getFreshClerkToken called but globalGetToken not set');
    return null;
  }
  
  try {
    const templateName = import.meta.env.VITE_CLERK_JWT_TEMPLATE_NAME || 'supabase';
    const token = await globalGetToken({ template: templateName });
    
    if (token) {
      // Update the cached token for backwards compatibility with existing code
      updateCurrentToken(token);
    }
    
    return token;
  } catch (error) {
    console.error('[SupabaseContext] getFreshClerkToken error:', error);
    // Try basic token as fallback
    try {
      const basicToken = await globalGetToken({} as any);
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

interface SupabaseProviderProps {
  children: React.ReactNode;
}

export const SupabaseProvider: React.FC<SupabaseProviderProps> = ({ children }) => {
  console.log('[SupabaseContext] 🎯 Component rendering/mounting');
  console.log('[SupabaseContext] Clerk available:', typeof window !== 'undefined' ? !!window.Clerk : 'N/A (server)');
  
  const authResult = useAuth();
  const { getToken, isSignedIn } = authResult;
  
  console.log('[SupabaseContext] useAuth result:', {
    hasGetToken: !!getToken,
    isSignedIn,
    authKeys: Object.keys(authResult)
  });
  const [client, setClient] = useState<SupabaseClient | null>(null);
  const [isAuthClient, setIsAuthClient] = useState(false);
  // Note: refreshIntervalRef removed - no longer needed with fresh token on every request

  console.log('[SupabaseContext] 📊 Current state:', { 
    isSignedIn, 
    hasGetToken: !!getToken,
    hasClient: !!client,
    isAuthClient
  });

  // Token refresh function
  const refreshToken = useCallback(async () => {
    if (!isSignedIn || !getToken) {
      console.log('[SupabaseContext] ⚠️ Cannot refresh token: not signed in or getToken unavailable');
      return;
    }

    console.log('[SupabaseContext] 🔄 Refreshing JWT token...');
    setIsAuthClient(false); // Reset while refreshing

    try {
      const templateName = import.meta.env.VITE_CLERK_JWT_TEMPLATE_NAME || 'supabase';
      let token: string | null = null;

      try {
        token = await getToken({ template: templateName });
      } catch (templateError) {
        console.error('[SupabaseContext] Template token refresh failed:', templateError);
        try {
          token = await getToken();
        } catch (basicError) {
          console.error('[SupabaseContext] Basic token refresh also failed:', basicError);
        }
      }

      if (!token) {
        console.error('[SupabaseContext] ❌ Token refresh failed - no token received');
        return;
      }

      console.log('[SupabaseContext] ✅ Token refreshed successfully');
      // Update the stored token
      updateCurrentToken(token);
      const authenticatedClient = await createAuthenticatedClient(token, refreshToken);
      setClient(authenticatedClient);
      globalAuthenticatedClient = authenticatedClient;
      setIsAuthClient(true);
    } catch (error: any) {
      console.error('[SupabaseContext] ❌ Token refresh error:', error);
      setIsAuthClient(false);
    }
  }, [getToken, isSignedIn]);

  // Store refresh callback globally for error handlers
  useEffect(() => {
    globalTokenRefreshCallback = refreshToken;
    return () => {
      globalTokenRefreshCallback = null;
    };
  }, [refreshToken]);

  // Store getToken function globally so we can get fresh tokens on every request
  // This is the KEY to proper token management - no more stale cached tokens!
  useEffect(() => {
    if (getToken && isSignedIn) {
      globalGetToken = getToken as any;
      // Register the fresh token getter with supabase.ts
      // This allows the customFetch to get fresh tokens on every request
      setFreshTokenGetter(getFreshClerkToken);
      console.log('[SupabaseContext] ✅ Fresh token getter registered - proper auth enabled');
    }
    return () => {
      globalGetToken = null;
      setFreshTokenGetter(null);
    };
  }, [getToken, isSignedIn]);

  useEffect(() => {
    console.log('[SupabaseContext] 🔄 useEffect triggered', { 
      isSignedIn, 
      hasGetToken: !!getToken,
      getTokenType: typeof getToken
    });
    
    const initClient = async () => {
      setIsAuthClient(false); // reset while initializing
      console.log('[SupabaseContext] 🚀 initClient called', { isSignedIn });
      
      if (isSignedIn) {
        try {
          // Get Clerk JWT token with 'supabase' template
          // Make sure you've created this template in Clerk Dashboard with clerk_id claim
          // Template name can be configured via environment variable or defaults to 'supabase'
          const templateName = import.meta.env.VITE_CLERK_JWT_TEMPLATE_NAME || 'supabase';
          console.log('[SupabaseContext] Requesting JWT token with template:', templateName);

          let token;
          try {
            token = await getToken({ template: templateName });
            console.log('[SupabaseContext] Template token result:', token ? 'SUCCESS' : 'NULL');
          } catch (templateError) {
            console.error('[SupabaseContext] Template token failed:', templateError);
            // Try basic token as fallback
            console.log('[SupabaseContext] Trying basic token...');
            try {
              token = await getToken();
              console.log('[SupabaseContext] Basic token result:', token ? 'SUCCESS' : 'NULL');
            } catch (basicError) {
              console.error('[SupabaseContext] Basic token also failed:', basicError);
            }
          }
          
          if (!token) {
            console.error('[SupabaseContext] ❌ No JWT token received from Clerk');
            console.error('[SupabaseContext] This means requests will NOT include JWT and RLS will fail');
            console.error('[SupabaseContext] 🔄 Trying basic token as emergency fallback...');

            // Emergency fallback: try basic token
            try {
              const basicToken = await getToken();
              if (basicToken) {
                console.log('[SupabaseContext] ✅ Basic token fallback successful');
                token = basicToken;
              } else {
                console.error('[SupabaseContext] ❌ Basic token also failed');
                const { supabase } = await import('../services/supabase');
                setClient(supabase);
                globalAuthenticatedClient = supabase;
                setIsAuthClient(false);
                return;
              }
            } catch (basicError) {
              console.error('[SupabaseContext] ❌ Basic token error:', basicError);
              const { supabase } = await import('../services/supabase');
              setClient(supabase);
              globalAuthenticatedClient = supabase;
              setIsAuthClient(false);
              return;
            }
          }
          
          console.log('[SupabaseContext] ✅ JWT token received:', token.substring(0, 50) + '...');
          console.log('[SupabaseContext] Token length:', token.length);
          
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
              console.log('[SupabaseContext] JWT Claims:', claims);
              
              // Check for critical claims
              if (claims.clerk_id) {
                console.log('[SupabaseContext] ✅ clerk_id claim present:', claims.clerk_id);
              } else {
                console.warn('[SupabaseContext] ⚠️ clerk_id claim MISSING! RLS will fail.');
                console.warn('[SupabaseContext] 💡 Add { "clerk_id": "{{user.id}}" } to your Clerk JWT template');
                if (claims.sub) {
                  console.log('[SupabaseContext] ℹ️ "sub" claim available:', claims.sub, '- migration 041 will use this as fallback');
                }
              }
            }
          } catch (decodeError) {
            console.warn('[SupabaseContext] Could not decode JWT for debugging:', decodeError);
          }
          // Update the stored token
          updateCurrentToken(token);
          const authenticatedClient = await createAuthenticatedClient(token, refreshToken);
          setClient(authenticatedClient);
          globalAuthenticatedClient = authenticatedClient;
          console.log('[SupabaseContext] ✅ Authenticated Supabase client created');
          setIsAuthClient(true);
        } catch (error: any) {
          console.error('[SupabaseContext] Failed to create authenticated client:', error);
          
          // Check if it's a template name error
          if (error?.message?.includes('No JWT template exists')) {
            console.error('[SupabaseContext] JWT template not found. Please:');
            console.error('1. Go to Clerk Dashboard → Configure → JWT Templates');
            console.error('2. Create a template named "supabase" (or set VITE_CLERK_JWT_TEMPLATE_NAME)');
            console.error('3. Add custom claim: { "clerk_id": "{{user.id}}" }');
          }

          // Additional error logging
          console.error('[SupabaseContext] Full error details:', {
            message: error?.message,
            name: error?.name,
            stack: error?.stack
          });
          
          // Fallback to default client on error
          const { supabase } = await import('../services/supabase');
          setClient(supabase);
          globalAuthenticatedClient = supabase;
          setIsAuthClient(false);
        }
      } else {
        // User not signed in, use default client (will fail RLS checks, but that's expected)
        console.log('[SupabaseContext] ⚠️ User not signed in, using default client (no JWT)');
        const { supabase } = await import('../services/supabase');
        setClient(supabase);
        globalAuthenticatedClient = supabase;
        setIsAuthClient(false);
      }
    };
    
    initClient();
  }, [getToken, isSignedIn]);

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
        console.log('🔍 Manual JWT Test Starting...');
        console.log('Clerk available:', !!window.Clerk);
        console.log('isSignedIn:', isSignedIn);
        console.log('getToken available:', !!getToken);
        
        if (!isSignedIn) {
          console.error('❌ User is not signed in!');
          return;
        }
        
        if (!getToken) {
          console.error('❌ getToken function not available!');
          return;
        }
        
        try {
          const templateName = import.meta.env.VITE_CLERK_JWT_TEMPLATE_NAME || 'supabase';
          console.log('📝 Attempting to get token with template:', templateName);
          
          const token = await getToken({ template: templateName } as any);
          if (token) {
            console.log('✅ Token received! Length:', token.length);
            console.log('Token preview:', token.substring(0, 50) + '...');
            
            // Decode token
            try {
              const parts = token.split('.');
              const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
              console.log('📋 Token claims:', payload);
              console.log('clerk_id claim:', payload.clerk_id || '❌ MISSING');
            } catch (e) {
              console.error('Failed to decode token:', e);
            }
          } else {
            console.error('❌ Token is NULL!');
          }
        } catch (error: any) {
          console.error('❌ Error getting token:', error);
          console.error('Error message:', error?.message);
        }
      };
      
      console.log('[SupabaseContext] 💡 Run window.helpyTestJWT() in console to manually test JWT retrieval');
    }
  }, [isSignedIn, getToken]);

  return (
    <SupabaseContext.Provider value={{ client, isAuthClient, refreshToken }}>
      {children}
    </SupabaseContext.Provider>
  );
};




