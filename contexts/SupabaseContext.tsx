// contexts/SupabaseContext.tsx
// Provides authenticated Supabase client with Clerk JWT token for RLS policies

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { createAuthenticatedClient, SupabaseClient } from '../services/supabase';

const SupabaseContext = createContext<SupabaseClient | null>(null);

// Global reference for services to access authenticated client (outside React)
let globalAuthenticatedClient: SupabaseClient | null = null;

export const useSupabase = () => {
  const context = useContext(SupabaseContext);
  if (!context) {
    // Fallback to default client if context not available (for gradual migration)
    // This allows components to work during migration period
    const { supabase } = require('../services/supabase');
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

interface SupabaseProviderProps {
  children: React.ReactNode;
}

export const SupabaseProvider: React.FC<SupabaseProviderProps> = ({ children }) => {
  const { getToken, isSignedIn } = useAuth();
  const [client, setClient] = useState<SupabaseClient | null>(null);

  useEffect(() => {
    const initClient = async () => {
      if (isSignedIn) {
        try {
          // Get Clerk JWT token with 'supabase' template
          // Make sure you've created this template in Clerk Dashboard with clerk_id claim
          // Template name can be configured via environment variable or defaults to 'supabase'
          const templateName = import.meta.env.VITE_CLERK_JWT_TEMPLATE_NAME || 'supabase';
          const token = await getToken({ template: templateName });
          
          if (!token) {
            console.warn('[SupabaseContext] No JWT token received, using default client');
            const { supabase } = await import('../services/supabase');
            setClient(supabase);
            globalAuthenticatedClient = supabase;
            return;
          }
          
          const authenticatedClient = await createAuthenticatedClient(token);
          setClient(authenticatedClient);
          globalAuthenticatedClient = authenticatedClient;
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
        }
      } else {
        // User not signed in, use default client (will fail RLS checks, but that's expected)
        const { supabase } = await import('../services/supabase');
        setClient(supabase);
        globalAuthenticatedClient = supabase;
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
