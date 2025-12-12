// api/delete-user.ts
// Deletes a user from a household using service role (bypasses RLS)

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase with service role (bypasses RLS)
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST' && req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId, householdId, requesterId } = req.body;

  // Validate required fields
  if (!userId || !householdId) {
    return res.status(400).json({ 
      error: 'Missing required fields: userId, householdId' 
    });
  }

  try {
    // Verify the requester is part of the same household and has permission
    if (requesterId) {
      const { data: requester, error: requesterError } = await supabase
        .from('users')
        .select('id, household_id, role')
        .eq('id', requesterId)
        .single();

      if (requesterError || !requester) {
        return res.status(403).json({ error: 'Requester not found' });
      }

      if (requester.household_id !== householdId) {
        return res.status(403).json({ error: 'Not authorized to delete users from this household' });
      }

      // Only master, admin, or parent roles can delete users
      const allowedRoles = ['master', 'admin', 'parent'];
      if (!allowedRoles.includes(requester.role?.toLowerCase() || '')) {
        return res.status(403).json({ error: 'Only admins, parents, and household owners can delete members' });
      }
    }

    // Get user to delete (verify they exist and are in the correct household)
    const { data: userToDelete, error: fetchError } = await supabase
      .from('users')
      .select('id, household_id, role, name')
      .eq('id', userId)
      .eq('household_id', householdId)
      .single();

    if (fetchError || !userToDelete) {
      return res.status(404).json({ error: 'User not found in this household' });
    }

    // Prevent deleting the master user
    if (userToDelete.role?.toLowerCase() === 'master') {
      return res.status(403).json({ error: 'Cannot delete the household owner' });
    }

    // Delete the user
    const { error: deleteError } = await supabase
      .from('users')
      .delete()
      .eq('id', userId)
      .eq('household_id', householdId);

    if (deleteError) {
      console.error('Supabase delete error:', deleteError);
      return res.status(500).json({ 
        error: `Failed to delete user: ${deleteError.message}` 
      });
    }

    console.log(`✅ Successfully deleted user ${userToDelete.name} (${userId}) from household ${householdId}`);

    return res.status(200).json({
      success: true,
      message: `User ${userToDelete.name} has been removed from the household`,
      deletedUser: {
        id: userToDelete.id,
        name: userToDelete.name,
        role: userToDelete.role,
      }
    });

  } catch (error: any) {
    console.error('Delete user error:', error);
    return res.status(500).json({ 
      error: error.message || 'Internal server error' 
    });
  }
}

