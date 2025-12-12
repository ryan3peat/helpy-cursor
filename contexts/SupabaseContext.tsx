// contexts/SupabaseContext.tsx
// Provides authenticated Supabase client with Clerk JWT token for RLS policies

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { createAuthenticatedClient, SupabaseClient, supabase } from '../services/supabase';

const SupabaseContext = createContext<SupabaseClient | null>(null);

// Global reference for services to access authenticated client (outside React)
let globalAuthenticatedClient: SupabaseClient | null = null;

export const useSupabase = () => {
  const context = useContext(SupabaseContext);
  if (!context) {
    // Fallback to default client if context not available (for gradual migration)
    // This allows components to work during migration period
    return supabase;
  }
  return context;
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
  // If context exists, client is ready (even if it's the default fallback)
  return context !== null;
};

interface SupabaseProviderProps {
  children: React.ReactNode;
}

export const SupabaseProvider: React.FC<SupabaseProviderProps> = ({ children }) => {
  const { getToken, isSignedIn } = useAuth();
  const [client, setClient] = useState<SupabaseClient | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const initClient = async () => {
      setIsReady(false); // Mark as not ready while initializing
      
      if (isSignedIn) {
        try {
          // Get Clerk JWT token with 'supabase' template
          // Make sure you've created this template in Clerk Dashboard with clerk_id claim
          // Template name can be configured via environment variable or defaults to 'supabase'
          const templateName = import.meta.env.VITE_CLERK_JWT_TEMPLATE_NAME || 'supabase';
          console.log('[SupabaseContext] Requesting JWT token with template:', templateName);
          const token = await getToken({ template: templateName });
          
          if (!token) {
            console.error('[SupabaseContext] ❌ No JWT token received from Clerk');
            console.error('[SupabaseContext] This means requests will NOT include JWT and RLS will fail');
            const { supabase } = await import('../services/supabase');
            setClient(supabase);
            globalAuthenticatedClient = supabase;
            setIsReady(true);
            return;
          }
          
          console.log('[SupabaseContext] ✅ JWT token received:', token.substring(0, 50) + '...');
          console.log('[SupabaseContext] Token length:', token.length);
          const authenticatedClient = await createAuthenticatedClient(token);
          setClient(authenticatedClient);
          globalAuthenticatedClient = authenticatedClient;
          console.log('[SupabaseContext] ✅ Authenticated Supabase client created');
          setIsReady(true);
        } catch (error: any) {
          console.error('[SupabaseContext] Failed to create authenticated client:', error);
          
          // Check if it's a template name error
          if (error?.message?.includes('No JWT template exists')) {
            console.error('[SupabaseContext] JWT template not found. Please:');
            console.error('1. Go to Clerk Dashboard → Configure → JWT Templates');
            console.error('2. Create a template named "supabase" (or set VITE_CLERK_JWT_TEMPLATE_NAME)');
            console.error('3. Add custom claim: { "clerk_id": "{{user.id}}" }');
          }
          
          // Fallback to default client on error
          const { supabase } = await import('../services/supabase');
          setClient(supabase);
          globalAuthenticatedClient = supabase;
          setIsReady(true);
        }
      } else {
        // User not signed in, use default client (will fail RLS checks, but that's expected)
        const { supabase } = await import('../services/supabase');
        setClient(supabase);
        globalAuthenticatedClient = supabase;
        setIsReady(true);
      }
    };
    
    initClient();
  }, [getToken, isSignedIn]);

  return (
    <SupabaseContext.Provider value={client}>
      {children}
    </SupabaseContext.Provider>
  );
};
