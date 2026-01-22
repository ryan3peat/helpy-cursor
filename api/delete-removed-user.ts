// api/delete-removed-user.ts
// Deletes a user who has been removed from a household (has null household_id)
// This is used when users choose to permanently delete their account after being removed

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase with service role (bypasses RLS)
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

  const { clerkId } = req.body;

  // Validate required fields
  if (!clerkId) {
    return res.status(400).json({ 
      error: 'Missing required field: clerkId' 
    });
  }

  try {
    // Find the user by clerk_id
    const { data: userToDelete, error: fetchError } = await supabase
      .from('users')
      .select('id, household_id, name, clerk_id')
      .eq('clerk_id', clerkId)
      .single();

    if (fetchError || !userToDelete) {
      console.error('User lookup failed:', { clerkId, error: fetchError });
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify the user has been removed from household (household_id should be null)
    if (userToDelete.household_id !== null) {
      return res.status(403).json({ 
        error: 'User is still part of a household. Cannot delete via this endpoint.' 
      });
    }

    const dbUserId = userToDelete.id;

    // Delete push subscriptions first
    const { error: pushDeleteError } = await supabase
      .from('push_subscriptions')
      .delete()
      .eq('user_id', dbUserId);

    if (pushDeleteError) {
      console.warn('Warning: Failed to delete push subscriptions:', pushDeleteError);
      // Continue with user deletion anyway
    }

    // Delete the user from Supabase
    const { error: deleteError } = await supabase
      .from('users')
      .delete()
      .eq('id', dbUserId);

    if (deleteError) {
      console.error('Supabase delete error:', deleteError);
      return res.status(500).json({
        error: `Failed to delete user: ${deleteError.message}`
      });
    }

    console.log(`✅ Successfully deleted removed user ${userToDelete.name} (${dbUserId})`);

    return res.status(200).json({
      success: true,
      message: `User ${userToDelete.name} has been permanently deleted`,
      deletedUser: {
        id: userToDelete.id,
        name: userToDelete.name,
      }
    });

  } catch (error: any) {
    console.error('Delete removed user error:', error);
    return res.status(500).json({ 
      error: error.message || 'Internal server error' 
    });
  }
}


