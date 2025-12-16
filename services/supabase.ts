import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Default client (for backward compatibility during migration)
// Note: This client won't have JWT tokens, so RLS policies won't work until migration is complete
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Global token refresh function (set by SupabaseContext)
let globalTokenRefresh: (() => Promise<void>) | null = null;
let currentToken: string | null = null;

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

// Function to create authenticated client with Clerk JWT token
// This client will include the JWT in headers, allowing RLS policies to work
export const createAuthenticatedClient = async (clerkToken: string | null, tokenRefresh?: () => Promise<void>): Promise<SupabaseClient> => {
  if (!clerkToken) {
    console.warn('[Supabase] No JWT token provided, creating client without authentication');
    return createClient(supabaseUrl, supabaseAnonKey);
  }
  
  console.log('[Supabase] Creating authenticated client with JWT token');
  console.log('[Supabase] Token preview:', clerkToken.substring(0, 50) + '...');
  
  // Store token refresh function globally
  if (tokenRefresh) {
    setTokenRefresh(tokenRefresh, clerkToken);
  }
  
  // Use custom fetch to ensure JWT is sent with EVERY request
  // This is more reliable than global.headers which may not persist
  // Also handles token refresh on 401 errors
  const customFetch = async (url: RequestInfo | URL, options: RequestInit = {}) => {
    const headers = new Headers(options.headers);
    
    // Always add Authorization header with current token
    const token = currentToken || clerkToken;
    headers.set('Authorization', `Bearer ${token}`);
    
    // Log for debugging (only first few requests to avoid spam)
    const requestUrl = typeof url === 'string' ? url : url.toString();
    if (requestUrl.includes('supabase.co') && Math.random() < 0.1) { // Log ~10% of Supabase requests
      console.log('[Supabase] Request with JWT:', {
        url: requestUrl,
        hasAuth: headers.has('Authorization'),
        authPreview: headers.get('Authorization')?.substring(0, 30) + '...'
      });
    }
    
    let response = await fetch(url, {
      ...options,
      headers,
    });
    
    // Handle JWT expiration (401 Unauthorized or PGRST303 error)
    if (response.status === 401 && requestUrl.includes('supabase.co')) {
      // Check response body for JWT expired error
      const clonedResponse = response.clone();
      try {
        const responseText = await clonedResponse.text();
        const responseData = responseText ? JSON.parse(responseText) : {};
        
        // Check for JWT expired error codes
        if (responseData.code === 'PGRST303' || 
            responseData.message?.includes('JWT expired') ||
            (responseData.message?.includes('JWT') && responseData.message?.includes('expired'))) {
          console.warn('[Supabase] ⚠️ JWT expired, refreshing token...');
          
          // Refresh token if available
          if (globalTokenRefresh) {
            try {
              await globalTokenRefresh();
              
              // Retry request with new token
              const newToken = currentToken;
              if (newToken) {
                headers.set('Authorization', `Bearer ${newToken}`);
                console.log('[Supabase] 🔄 Retrying request with refreshed token');
                response = await fetch(url, {
                  ...options,
                  headers,
                });
              } else {
                console.error('[Supabase] ❌ Token refresh did not update current token');
              }
            } catch (refreshError) {
              console.error('[Supabase] ❌ Token refresh failed:', refreshError);
              // Return original 401 response
            }
          } else {
            console.warn('[Supabase] ⚠️ No token refresh function available');
          }
        } else {
          // 401 but not a JWT expiration error - try refresh anyway as fallback
          console.warn('[Supabase] ⚠️ 401 Unauthorized, attempting token refresh...');
          
          if (globalTokenRefresh) {
            try {
              await globalTokenRefresh();
              
              // Retry request with new token
              const newToken = currentToken;
              if (newToken) {
                headers.set('Authorization', `Bearer ${newToken}`);
                console.log('[Supabase] 🔄 Retrying request with refreshed token');
                response = await fetch(url, {
                  ...options,
                  headers,
                });
              }
            } catch (refreshError) {
              console.error('[Supabase] ❌ Token refresh failed:', refreshError);
            }
          }
        }
      } catch (parseError) {
        // If response is not JSON or can't be parsed, try refresh anyway
        console.warn('[Supabase] ⚠️ 401 Unauthorized, attempting token refresh...');
        
        if (globalTokenRefresh) {
          try {
            await globalTokenRefresh();
            
            // Retry request with new token
            const newToken = currentToken;
            if (newToken) {
              headers.set('Authorization', `Bearer ${newToken}`);
              console.log('[Supabase] 🔄 Retrying request with refreshed token');
              response = await fetch(url, {
                ...options,
                headers,
              });
            }
          } catch (refreshError) {
            console.error('[Supabase] ❌ Token refresh failed:', refreshError);
          }
        }
      }
    }
    
    return response;
  };
  
  const client = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      fetch: customFetch,
    },
  });
  
  console.log('[Supabase] ✅ Authenticated client created, JWT will be sent in requests');
  return client;
};