import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Default client (for backward compatibility during migration)
// Note: This client won't have JWT tokens, so RLS policies won't work until migration is complete
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Function to create authenticated client with Clerk JWT token
// This client will include the JWT in headers, allowing RLS policies to work
export const createAuthenticatedClient = async (clerkToken: string | null): Promise<SupabaseClient> => {
  if (!clerkToken) {
    console.warn('[Supabase] No JWT token provided, creating client without authentication');
    return createClient(supabaseUrl, supabaseAnonKey);
  }
  
  console.log('[Supabase] Creating authenticated client with JWT token');
  const client = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${clerkToken}`,
      },
    },
  });
  
  // Verify headers are set (for debugging)
  console.log('[Supabase] Authenticated client created, JWT will be sent in requests');
  return client;
};