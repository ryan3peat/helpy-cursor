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
  console.log('[Supabase] Token preview:', clerkToken.substring(0, 50) + '...');
  
  // Use custom fetch to ensure JWT is sent with EVERY request
  // This is more reliable than global.headers which may not persist
  const customFetch = (url: RequestInfo | URL, options: RequestInit = {}) => {
    const headers = new Headers(options.headers);
    
    // Always add Authorization header
    headers.set('Authorization', `Bearer ${clerkToken}`);
    
    // Log for debugging (only first few requests to avoid spam)
    const requestUrl = typeof url === 'string' ? url : url.toString();
    if (requestUrl.includes('supabase.co') && Math.random() < 0.1) { // Log ~10% of Supabase requests
      console.log('[Supabase] Request with JWT:', {
        url: requestUrl,
        hasAuth: headers.has('Authorization'),
        authPreview: headers.get('Authorization')?.substring(0, 30) + '...'
      });
    }
    
    return fetch(url, {
      ...options,
      headers,
    });
  };
  
  const client = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      fetch: customFetch,
    },
  });
  
  console.log('[Supabase] ✅ Authenticated client created, JWT will be sent in requests');
  return client;
};