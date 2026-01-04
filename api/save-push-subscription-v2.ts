// api/save-push-subscription-v2.ts
// Server-side API route to save push subscriptions
// Handles both Clerk IDs and Supabase UUIDs

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { user_id, household_id, endpoint, p256dh_key, auth_key, user_agent, device_fingerprint } = req.body;

  console.log('[API] save-push-subscription-v2 called:', {
    user_id,
    user_id_type: isClerkId(user_id) ? 'clerk_id' : isValidUuid(user_id) ? 'uuid' : 'unknown',
    household_id,
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

    if (isValidUuid(user_id)) {
      // Already a UUID - verify it exists
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

    if (!supabaseUserId && isClerkId(user_id)) {
      // It's a Clerk ID - look up the Supabase UUID
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

    if (!supabaseUserId) {
      // Try one more lookup - just by clerk_id without household constraint
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

    if (!supabaseUserId) {
      console.error('[API] Could not resolve user_id:', user_id);
      return res.status(404).json({ 
        error: 'User not found',
        user_id_received: user_id,
        user_id_type: isClerkId(user_id) ? 'clerk_id' : 'unknown'
      });
    }

    // STEP 2: Save/update subscription
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

    console.log('[API] ✅ Subscription saved successfully:', data?.id);

    return res.status(200).json({ 
      success: true, 
      data,
      resolved_user_id: supabaseUserId
    });

  } catch (error: any) {
    console.error('[API] Push subscription save error:', error);
    return res.status(500).json({ 
      error: error.message || 'Internal server error' 
    });
  }
}

