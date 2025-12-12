/**
 * JWT Debug Service
 * 
 * Helps diagnose JWT token issues between Clerk and Supabase.
 * 
 * Usage: Call window.helpyDebugJwt() in the browser console
 */

import { supabase } from './supabase';
import { getAuthenticatedSupabaseClient } from '../contexts/SupabaseContext';

interface JwtDebugResult {
  step: string;
  status: 'OK' | 'WARNING' | 'ERROR';
  message: string;
  details?: any;
}

interface JwtClaims {
  sub?: string;
  aud?: string;
  exp?: number;
  iat?: number;
  iss?: string;
  clerk_id?: string;
  role?: string;
  [key: string]: any;
}

/**
 * Decode JWT token without verification (for debugging only)
 */
function decodeJwt(token: string): JwtClaims | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      console.error('[JWT Debug] Invalid JWT format - expected 3 parts, got', parts.length);
      return null;
    }
    
    // Decode the payload (middle part)
    const payload = parts[1];
    // Handle URL-safe base64
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error('[JWT Debug] Failed to decode JWT:', error);
    return null;
  }
}

/**
 * Check if JWT token has expired
 */
function isTokenExpired(claims: JwtClaims): boolean {
  if (!claims.exp) return false;
  const now = Math.floor(Date.now() / 1000);
  return claims.exp < now;
}

/**
 * Debug the current JWT setup
 */
export async function debugJwt(clerkGetToken?: () => Promise<string | null>): Promise<JwtDebugResult[]> {
  const results: JwtDebugResult[] = [];
  
  console.log('\n========================================');
  console.log('🔍 JWT DEBUG - Diagnosing Clerk/Supabase Integration');
  console.log('========================================\n');

  // Step 1: Check if authenticated client exists
  const authClient = getAuthenticatedSupabaseClient();
  if (!authClient) {
    results.push({
      step: '1. Authenticated Client',
      status: 'ERROR',
      message: 'No authenticated Supabase client found',
      details: 'The SupabaseContext has not created an authenticated client. This means no JWT is being sent with requests.'
    });
  } else {
    results.push({
      step: '1. Authenticated Client',
      status: 'OK',
      message: 'Authenticated Supabase client exists'
    });
  }

  // Step 2: Try to get JWT token from Clerk (if getToken function provided)
  let jwtToken: string | null = null;
  let jwtClaims: JwtClaims | null = null;
  
  if (clerkGetToken) {
    try {
      // Try with template
      const templateName = import.meta.env.VITE_CLERK_JWT_TEMPLATE_NAME || 'supabase';
      console.log(`[JWT Debug] Attempting to get token with template: ${templateName}`);
      
      try {
        jwtToken = await clerkGetToken({ template: templateName } as any);
        if (jwtToken) {
          results.push({
            step: `2a. JWT Template Token (${templateName})`,
            status: 'OK',
            message: `Token received from template "${templateName}"`,
            details: { tokenLength: jwtToken.length, tokenPreview: jwtToken.substring(0, 50) + '...' }
          });
        } else {
          results.push({
            step: `2a. JWT Template Token (${templateName})`,
            status: 'WARNING',
            message: `Template "${templateName}" returned null - template may not exist`,
            details: 'Go to Clerk Dashboard > Configure > JWT Templates to create it'
          });
          
          // Try basic token
          jwtToken = await clerkGetToken();
          if (jwtToken) {
            results.push({
              step: '2b. Basic JWT Token',
              status: 'WARNING',
              message: 'Using basic token (no template). This may not have clerk_id claim.',
              details: { tokenLength: jwtToken.length }
            });
          }
        }
      } catch (templateError: any) {
        results.push({
          step: `2a. JWT Template Token (${templateName})`,
          status: 'ERROR',
          message: `Template error: ${templateError.message}`,
          details: templateError
        });
        
        // Try basic token as fallback
        try {
          jwtToken = await clerkGetToken();
          if (jwtToken) {
            results.push({
              step: '2b. Basic JWT Token (Fallback)',
              status: 'WARNING',
              message: 'Using basic token as fallback',
              details: { tokenLength: jwtToken.length }
            });
          }
        } catch (basicError) {
          results.push({
            step: '2b. Basic JWT Token',
            status: 'ERROR',
            message: 'Could not get any JWT token from Clerk',
            details: basicError
          });
        }
      }
    } catch (error: any) {
      results.push({
        step: '2. JWT Token',
        status: 'ERROR',
        message: `Failed to get JWT: ${error.message}`,
        details: error
      });
    }
  } else {
    results.push({
      step: '2. JWT Token',
      status: 'WARNING',
      message: 'No getToken function provided - cannot verify token retrieval',
      details: 'Call window.helpyDebugJwt() from a component that has access to useAuth()'
    });
  }

  // Step 3: Decode and analyze JWT claims
  if (jwtToken) {
    jwtClaims = decodeJwt(jwtToken);
    
    if (jwtClaims) {
      console.log('[JWT Debug] Decoded JWT claims:', jwtClaims);
      
      // Check for clerk_id claim (required for RLS)
      if (jwtClaims.clerk_id) {
        results.push({
          step: '3a. clerk_id Claim',
          status: 'OK',
          message: `clerk_id present: ${jwtClaims.clerk_id}`,
          details: { clerk_id: jwtClaims.clerk_id }
        });
      } else {
        results.push({
          step: '3a. clerk_id Claim',
          status: 'ERROR',
          message: 'clerk_id claim is MISSING from JWT!',
          details: {
            problem: 'RLS policies use get_clerk_id() which reads this claim',
            fix: 'Add { "clerk_id": "{{user.id}}" } to your Clerk JWT template',
            currentClaims: Object.keys(jwtClaims)
          }
        });
      }

      // Check sub claim
      if (jwtClaims.sub) {
        results.push({
          step: '3b. sub Claim',
          status: 'OK',
          message: `sub (subject): ${jwtClaims.sub}`,
          details: { sub: jwtClaims.sub }
        });
      }

      // Check expiration
      if (jwtClaims.exp) {
        const isExpired = isTokenExpired(jwtClaims);
        const expDate = new Date(jwtClaims.exp * 1000);
        results.push({
          step: '3c. Token Expiration',
          status: isExpired ? 'ERROR' : 'OK',
          message: isExpired ? `Token EXPIRED at ${expDate.toISOString()}` : `Token valid until ${expDate.toISOString()}`,
          details: { exp: jwtClaims.exp, expDate: expDate.toISOString(), isExpired }
        });
      }

      // Check issuer
      if (jwtClaims.iss) {
        const isClerkIssuer = jwtClaims.iss.includes('clerk');
        results.push({
          step: '3d. Token Issuer',
          status: isClerkIssuer ? 'OK' : 'WARNING',
          message: `Issuer: ${jwtClaims.iss}`,
          details: { iss: jwtClaims.iss, isClerkIssuer }
        });
      }

      // List all claims
      results.push({
        step: '3e. All Claims',
        status: 'OK',
        message: `JWT contains ${Object.keys(jwtClaims).length} claims`,
        details: jwtClaims
      });
    } else {
      results.push({
        step: '3. JWT Claims',
        status: 'ERROR',
        message: 'Failed to decode JWT token',
        details: 'Token may be malformed'
      });
    }
  }

  // Step 4: Test Supabase RLS with JWT
  console.log('[JWT Debug] Testing Supabase RLS...');
  
  try {
    // Use the authenticated client if available
    const client = authClient || supabase;
    
    // First, test the get_clerk_id() function
    const { data: clerkIdResult, error: clerkIdError } = await client.rpc('get_clerk_id');
    
    if (clerkIdError) {
      results.push({
        step: '4a. Supabase get_clerk_id()',
        status: 'ERROR',
        message: `Function error: ${clerkIdError.message}`,
        details: clerkIdError
      });
    } else {
      const hasClerkId = clerkIdResult !== null;
      results.push({
        step: '4a. Supabase get_clerk_id()',
        status: hasClerkId ? 'OK' : 'ERROR',
        message: hasClerkId ? `get_clerk_id() returns: ${clerkIdResult}` : 'get_clerk_id() returns NULL - JWT not reaching Supabase!',
        details: { 
          result: clerkIdResult,
          implication: hasClerkId ? 'JWT is being sent correctly' : 'Either no JWT sent, or clerk_id claim missing from JWT'
        }
      });
    }

    // Test get_user_household_id() function
    const { data: householdResult, error: householdError } = await client.rpc('get_user_household_id');
    
    if (householdError) {
      results.push({
        step: '4b. Supabase get_user_household_id()',
        status: 'ERROR',
        message: `Function error: ${householdError.message}`,
        details: householdError
      });
    } else {
      const hasHousehold = householdResult !== null;
      results.push({
        step: '4b. Supabase get_user_household_id()',
        status: hasHousehold ? 'OK' : 'WARNING',
        message: hasHousehold ? `User's household: ${householdResult}` : 'get_user_household_id() returns NULL',
        details: { 
          result: householdResult,
          implication: hasHousehold 
            ? 'User exists in database and is linked to a household' 
            : 'User may not exist in database OR not linked to a household'
        }
      });
    }

  } catch (error: any) {
    results.push({
      step: '4. Supabase RLS Test',
      status: 'ERROR',
      message: `RLS test failed: ${error.message}`,
      details: error
    });
  }

  // Step 5: Test actual data access
  try {
    const client = authClient || supabase;
    const { data: usersData, error: usersError } = await client
      .from('users')
      .select('id, clerk_id, household_id')
      .limit(1);

    if (usersError) {
      results.push({
        step: '5. Data Access Test (users)',
        status: 'ERROR',
        message: `Query failed: ${usersError.message}`,
        details: usersError
      });
    } else {
      const hasAccess = usersData && usersData.length > 0;
      results.push({
        step: '5. Data Access Test (users)',
        status: hasAccess ? 'OK' : 'WARNING',
        message: hasAccess ? `Can read ${usersData.length} user(s)` : 'No users readable (RLS may be blocking)',
        details: { 
          rowCount: usersData?.length || 0,
          sample: usersData?.[0] ? { id: usersData[0].id, clerk_id: usersData[0].clerk_id } : null
        }
      });
    }
  } catch (error: any) {
    results.push({
      step: '5. Data Access Test',
      status: 'ERROR',
      message: `Test failed: ${error.message}`,
      details: error
    });
  }

  // Print summary
  console.log('\n========================================');
  console.log('📊 JWT DEBUG SUMMARY');
  console.log('========================================\n');

  const errors = results.filter(r => r.status === 'ERROR');
  const warnings = results.filter(r => r.status === 'WARNING');

  results.forEach(r => {
    const icon = r.status === 'OK' ? '✅' : r.status === 'WARNING' ? '⚠️' : '❌';
    console.log(`${icon} ${r.step}: ${r.message}`);
    if (r.details && r.status !== 'OK') {
      console.log('   Details:', r.details);
    }
  });

  console.log('\n----------------------------------------');
  console.log(`Total: ${results.length} checks | ${errors.length} errors | ${warnings.length} warnings`);
  
  if (errors.length > 0) {
    console.log('\n🔴 CRITICAL ISSUES FOUND:');
    errors.forEach(e => console.log(`   - ${e.step}: ${e.message}`));
    
    // Provide specific fix suggestions
    const hasClerkIdError = errors.some(e => e.step.includes('clerk_id'));
    if (hasClerkIdError) {
      console.log('\n📋 FIX: Add clerk_id to your Clerk JWT template:');
      console.log('   1. Go to Clerk Dashboard → Configure → JWT Templates');
      console.log('   2. Find or create template named "supabase"');
      console.log('   3. Add custom claim: { "clerk_id": "{{user.id}}" }');
      console.log('   4. Save and sign out/in to get new token');
    }
  }

  console.log('========================================\n');

  return results;
}

// Make debug function available globally in browser console
if (typeof window !== 'undefined') {
  (window as any).helpyDebugJwtService = debugJwt;
  console.log('[JWT Debug] 💡 TIP: Use window.helpyDebugJwt() from App.tsx for full diagnostics');
}

export default debugJwt;
