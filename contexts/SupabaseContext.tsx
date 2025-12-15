// contexts/SupabaseContext.tsx
// Provides authenticated Supabase client with Clerk JWT token for RLS policies

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { createAuthenticatedClient, SupabaseClient, supabase } from '../services/supabase';

type SupabaseContextValue = {
  client: SupabaseClient | null;
  isAuthClient: boolean; // true only when client was created with JWT
};

const SupabaseContext = createContext<SupabaseContextValue | null>(null);

// Global reference for services to access authenticated client (outside React)
let globalAuthenticatedClient: SupabaseClient | null = null;

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

  console.log('[SupabaseContext] 📊 Current state:', { 
    isSignedIn, 
    hasGetToken: !!getToken,
    hasClient: !!client,
    isAuthClient
  });

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
          const authenticatedClient = await createAuthenticatedClient(token);
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
    <SupabaseContext.Provider value={{ client, isAuthClient }}>
      {children}
    </SupabaseContext.Provider>
  );
};

