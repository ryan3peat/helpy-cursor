// api/save-push-subscription-v2.ts
// Server-side API route to save push subscriptions
// Handles both Clerk IDs and Supabase UUIDs
// AUTO-REPAIRS missing clerk_id when user is found by household lookup

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Check if string is a valid UUID
function isValidUuid(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

// Check if string is a Clerk ID format
function isClerkId(str: string): boolean {
  return str.startsWith('user_');
}

// CORS: Only allow helpyfam.com, localhost, and Vercel previews
const ALLOWED_ORIGINS = ['https://app.helpyfam.com', 'https://www.helpyfam.com'];
function setCorsHeaders(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin as string | undefined;
  if (origin && (ALLOWED_ORIGINS.includes(origin) || origin.startsWith('http://localhost:') || origin.endsWith('.vercel.app'))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { user_id, household_id, endpoint, p256dh_key, auth_key, user_agent, device_fingerprint, email } = req.body;

  console.log('[API] save-push-subscription-v2 called:', {
    user_id,
    user_id_type: isClerkId(user_id) ? 'clerk_id' : isValidUuid(user_id) ? 'uuid' : 'unknown',
    household_id,
    email: email ? email.substring(0, 3) + '***' : undefined,
    endpoint: endpoint?.substring(0, 50) + '...'
  });

  // Validate required fields
  if (!user_id || !household_id || !endpoint || !p256dh_key || !auth_key) {
    return res.status(400).json({ 
      error: 'Missing required fields: user_id, household_id, endpoint, p256dh_key, auth_key' 
    });
  }

  try {
    // STEP 1: Resolve user_id to Supabase UUID
    let supabaseUserId: string | null = null;
    let clerkIdRepaired = false;

    // ─────────────────────────────────────────────────────────────────
    // LOOKUP 1: Check if user_id is already a valid UUID
    // ─────────────────────────────────────────────────────────────────
    if (isValidUuid(user_id)) {
      const { data: user, error } = await supabase
        .from('users')
        .select('id')
        .eq('id', user_id)
        .eq('household_id', household_id)
        .maybeSingle();
      
      if (user && !error) {
        supabaseUserId = user_id;
        console.log('[API] User ID is valid UUID:', supabaseUserId);
      }
    }

    // ─────────────────────────────────────────────────────────────────
    // LOOKUP 2: Look up by clerk_id with household constraint
    // ─────────────────────────────────────────────────────────────────
    if (!supabaseUserId && isClerkId(user_id)) {
      const { data: user, error } = await supabase
        .from('users')
        .select('id')
        .eq('clerk_id', user_id)
        .eq('household_id', household_id)
        .maybeSingle();
      
      if (user && !error) {
        supabaseUserId = user.id;
        console.log('[API] Resolved Clerk ID to UUID:', user_id, '->', supabaseUserId);
      }
    }

    // ─────────────────────────────────────────────────────────────────
    // LOOKUP 3: Look up by clerk_id without household constraint
    // ─────────────────────────────────────────────────────────────────
    if (!supabaseUserId && isClerkId(user_id)) {
      const { data: user, error } = await supabase
        .from('users')
        .select('id, household_id')
        .eq('clerk_id', user_id)
        .maybeSingle();
      
      if (user && !error) {
        supabaseUserId = user.id;
        console.log('[API] Resolved Clerk ID (no household constraint):', user_id, '->', supabaseUserId);
      }
    }

    // ─────────────────────────────────────────────────────────────────
    // LOOKUP 4: FALLBACK - Look up by email if provided
    // This handles cases where clerk_id wasn't saved during signup
    // ─────────────────────────────────────────────────────────────────
    if (!supabaseUserId && email && isClerkId(user_id)) {
      console.log('[API] Clerk ID lookup failed, trying email lookup:', email);
      
      const { data: userByEmail, error: emailError } = await supabase
        .from('users')
        .select('id, clerk_id, email')
        .eq('email', email)
        .eq('household_id', household_id)
        .eq('status', 'active')
        .maybeSingle();
      
      if (userByEmail && !emailError) {
        console.log('[API] Found user by email:', userByEmail.id);
        supabaseUserId = userByEmail.id;
        
        // AUTO-REPAIR: Update the clerk_id if it's missing or different
        if (!userByEmail.clerk_id || userByEmail.clerk_id !== user_id) {
          console.log('[API] Auto-repairing clerk_id:', userByEmail.clerk_id, '->', user_id);
          const { error: updateError } = await supabase
            .from('users')
            .update({ clerk_id: user_id })
            .eq('id', userByEmail.id);
          
          if (updateError) {
            console.error('[API] Failed to auto-repair clerk_id:', updateError);
          } else {
            console.log('[API] Successfully auto-repaired clerk_id for user:', userByEmail.id);
            clerkIdRepaired = true;
          }
        }
      }
    }

    // ─────────────────────────────────────────────────────────────────
    // LOOKUP 5: FALLBACK - Look up admin/superadmin in household without clerk_id
    // This handles the case where the admin's clerk_id was never saved
    // ─────────────────────────────────────────────────────────────────
    if (!supabaseUserId && isClerkId(user_id)) {
      console.log('[API] Email lookup failed, trying admin fallback for household:', household_id);
      
      const { data: householdUsers, error: householdError } = await supabase
        .from('users')
        .select('id, email, clerk_id, role, status')
        .eq('household_id', household_id)
        .eq('status', 'active');
      
      if (householdUsers && !householdError && householdUsers.length > 0) {
        console.log('[API] Found', householdUsers.length, 'active users in household');
        
        // Find admin/superadmin user without clerk_id (or with NULL clerk_id)
        const adminWithoutClerkId = householdUsers.find(u => 
          (u.role === 'Admin' || u.role === 'SuperAdmin') && !u.clerk_id
        );
        
        if (adminWithoutClerkId) {
          console.log('[API] Found admin without clerk_id:', adminWithoutClerkId.id, 'role:', adminWithoutClerkId.role);
          
          // Update the clerk_id for this user
          const { error: updateError } = await supabase
            .from('users')
            .update({ clerk_id: user_id })
            .eq('id', adminWithoutClerkId.id);
          
          if (!updateError) {
            supabaseUserId = adminWithoutClerkId.id;
            clerkIdRepaired = true;
            console.log('[API] Auto-repaired clerk_id for admin:', supabaseUserId);
          } else {
            console.error('[API] Failed to update admin clerk_id:', updateError);
          }
        } else {
          // Log all users for debugging
          console.log('[API] No admin without clerk_id found. Users in household:');
          householdUsers.forEach(u => {
            console.log('[API]   -', u.role, '| clerk_id:', u.clerk_id ? 'SET' : 'NULL', '| id:', u.id);
          });
        }
      }
    }

    // ─────────────────────────────────────────────────────────────────
    // FINAL CHECK: If still not resolved, return error with helpful info
    // ─────────────────────────────────────────────────────────────────
    if (!supabaseUserId) {
      console.error('[API] Could not resolve user_id:', user_id);
      console.error('[API] Tried: UUID check, clerk_id lookup, email lookup, admin fallback');
      return res.status(404).json({ 
        error: 'User not found',
        user_id_received: user_id,
        user_id_type: isClerkId(user_id) ? 'clerk_id' : 'unknown',
        hint: 'The clerk_id may not be saved in the database. Try passing email parameter for fallback lookup, or check that the user exists in the household.'
      });
    }

    // ─────────────────────────────────────────────────────────────────
    // STEP 2: Save/update subscription
    // ─────────────────────────────────────────────────────────────────
    const { data, error } = await supabase
      .from('push_subscriptions')
      .upsert({
        user_id: supabaseUserId,
        household_id,
        endpoint,
        p256dh_key,
        auth_key,
        user_agent: user_agent || null,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,endpoint',
        ignoreDuplicates: false
      })
      .select()
      .single();

    if (error) {
      console.error('[API] Failed to save subscription:', error);
      return res.status(500).json({ 
        error: error.message || 'Failed to save subscription' 
      });
    }

    console.log('[API] Subscription saved successfully:', data?.id);

    return res.status(200).json({ 
      success: true, 
      data,
      resolved_user_id: supabaseUserId,
      clerk_id_repaired: clerkIdRepaired
    });

  } catch (error: any) {
    console.error('[API] Push subscription save error:', error);
    return res.status(500).json({ 
      error: error.message || 'Internal server error' 
    });
  }
}
