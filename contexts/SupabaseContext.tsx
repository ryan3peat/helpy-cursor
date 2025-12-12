// contexts/SupabaseContext.tsx
// Provides authenticated Supabase client with Clerk JWT token for RLS policies

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { createAuthenticatedClient, SupabaseClient } from '../services/supabase';

const SupabaseContext = createContext<SupabaseClient | null>(null);

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
          const token = await getToken({ template: 'supabase' });
          const authenticatedClient = await createAuthenticatedClient(token);
          setClient(authenticatedClient);
        } catch (error) {
          console.error('[SupabaseContext] Failed to create authenticated client:', error);
          // Fallback to default client on error
          const { supabase } = await import('../services/supabase');
          setClient(supabase);
        }
      } else {
        // User not signed in, use default client (will fail RLS checks, but that's expected)
        const { supabase } = await import('../services/supabase');
        setClient(supabase);
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
