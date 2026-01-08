// api/sync-clerk-id.ts
// Syncs clerk_id when a user logs in with a different Clerk account but same email
// Uses service role to bypass RLS (fixes chicken-and-egg problem)

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Service role client bypasses RLS
const supabaseAdmin = createClient(supabaseUrl!, serviceRoleKey!);

export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request) {
  // Only allow POST
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json();
    const { email, newClerkId } = body;

    // Validate required fields
    if (!email || !newClerkId) {
      return new Response(JSON.stringify({ error: 'Missing email or newClerkId' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Validate newClerkId format (should be user_xxx)
    if (!newClerkId.startsWith('user_')) {
      return new Response(JSON.stringify({ error: 'Invalid clerk_id format' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    console.log(`[sync-clerk-id] Syncing clerk_id for email: ${email}`);

    // Find user by email (active users only)
    const { data: user, error: findError } = await supabaseAdmin
      .from('users')
      .select('id, clerk_id, household_id, name, role, avatar, allergies, preferences, status, notifications_enabled, onboarding_status')
      .eq('email', email)
      .eq('status', 'active')
      .maybeSingle();

    if (findError) {
      console.error('[sync-clerk-id] Error finding user:', findError);
      return new Response(JSON.stringify({ error: 'Database error', details: findError.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!user) {
      console.log(`[sync-clerk-id] No active user found for email: ${email}`);
      return new Response(JSON.stringify({ error: 'User not found', notFound: true }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // If clerk_id already matches, nothing to do
    if (user.clerk_id === newClerkId) {
      console.log(`[sync-clerk-id] clerk_id already matches for ${email}`);
      return new Response(JSON.stringify({ 
        success: true, 
        user,
        alreadySynced: true 
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Log the sync for audit purposes
    console.log(`[sync-clerk-id] Updating clerk_id for ${email}:`);
    console.log(`  Old: ${user.clerk_id || '(null)'}`);
    console.log(`  New: ${newClerkId}`);

    // Update clerk_id using service role (bypasses RLS)
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({ clerk_id: newClerkId })
      .eq('id', user.id);

    if (updateError) {
      console.error('[sync-clerk-id] Failed to update clerk_id:', updateError);
      return new Response(JSON.stringify({ error: 'Failed to sync clerk_id', details: updateError.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    console.log(`[sync-clerk-id] Successfully synced clerk_id for ${email}`);

    // Return updated user data
    return new Response(JSON.stringify({ 
      success: true, 
      user: { ...user, clerk_id: newClerkId },
      synced: true 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('[sync-clerk-id] Unexpected error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error', details: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

