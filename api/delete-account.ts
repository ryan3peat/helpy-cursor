// api/delete-account.ts
// Handles account deletion and deactivation for users
// - Non-admin users: Delete their own account
// - Admin users: Deactivate (transfer ownership) or Delete (entire household)

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase with service role (bypasses RLS)
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type ActionType = 'delete_self' | 'deactivate_admin' | 'delete_household';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId, householdId, action, newOwnerId } = req.body as {
    userId: string;
    householdId: string;
    action: ActionType;
    newOwnerId?: string; // Required for deactivate_admin
  };

  // Validate required fields
  if (!userId || !householdId || !action) {
    return res.status(400).json({ 
      error: 'Missing required fields: userId, householdId, action' 
    });
  }

  // Validate action type
  const validActions: ActionType[] = ['delete_self', 'deactivate_admin', 'delete_household'];
  if (!validActions.includes(action)) {
    return res.status(400).json({ 
      error: 'Invalid action. Must be: delete_self, deactivate_admin, or delete_household' 
    });
  }

  try {
    // Get the user making the request
    const { data: currentUser, error: userError } = await supabase
      .from('users')
      .select('id, household_id, role, name, clerk_id')
      .eq('id', userId)
      .eq('household_id', householdId)
      .single();

    if (userError || !currentUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isAdmin = currentUser.role?.toLowerCase() === 'admin' || currentUser.role?.toLowerCase() === 'master';

    // Handle different actions
    switch (action) {
      case 'delete_self': {
        // Non-admin users can delete their own account
        if (isAdmin) {
          return res.status(403).json({ 
            error: 'Admin users must use deactivate_admin or delete_household action' 
          });
        }

        // Delete push subscriptions first
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('user_id', userId);

        // Delete the user
        const { error: deleteError } = await supabase
          .from('users')
          .delete()
          .eq('id', userId);

        if (deleteError) {
          console.error('Error deleting user:', deleteError);
          return res.status(500).json({ error: 'Failed to delete user' });
        }

        console.log(`✅ User ${currentUser.name} (${userId}) deleted their account`);
        
        return res.status(200).json({
          success: true,
          message: 'Account deleted successfully',
          action: 'delete_self'
        });
      }

      case 'deactivate_admin': {
        // Admin can deactivate by transferring ownership to another user
        if (!isAdmin) {
          return res.status(403).json({ 
            error: 'Only admin users can use deactivate action' 
          });
        }

        if (!newOwnerId) {
          return res.status(400).json({ 
            error: 'newOwnerId is required for deactivate_admin action' 
          });
        }

        // Verify new owner exists and is in the same household
        const { data: newOwner, error: newOwnerError } = await supabase
          .from('users')
          .select('id, household_id, role, name')
          .eq('id', newOwnerId)
          .eq('household_id', householdId)
          .single();

        if (newOwnerError || !newOwner) {
          return res.status(404).json({ error: 'New owner not found in household' });
        }

        // Cannot transfer to self
        if (newOwnerId === userId) {
          return res.status(400).json({ error: 'Cannot transfer ownership to yourself' });
        }

        // Transfer ownership - update new owner's role to Admin
        const { error: updateNewOwnerError } = await supabase
          .from('users')
          .update({ role: 'Admin' })
          .eq('id', newOwnerId);

        if (updateNewOwnerError) {
          console.error('Error updating new owner:', updateNewOwnerError);
          return res.status(500).json({ error: 'Failed to transfer ownership' });
        }

        // Delete push subscriptions for the departing admin
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('user_id', userId);

        // Delete the old admin's user record
        const { error: deleteAdminError } = await supabase
          .from('users')
          .delete()
          .eq('id', userId);

        if (deleteAdminError) {
          // Try to rollback the role change
          await supabase
            .from('users')
            .update({ role: newOwner.role })
            .eq('id', newOwnerId);
          
          console.error('Error deleting admin:', deleteAdminError);
          return res.status(500).json({ error: 'Failed to remove admin account' });
        }

        console.log(`✅ Admin ${currentUser.name} deactivated, ownership transferred to ${newOwner.name}`);

        return res.status(200).json({
          success: true,
          message: `Ownership transferred to ${newOwner.name}`,
          action: 'deactivate_admin',
          newOwner: {
            id: newOwner.id,
            name: newOwner.name
          }
        });
      }

      case 'delete_household': {
        // Admin can delete entire household including all members
        if (!isAdmin) {
          return res.status(403).json({ 
            error: 'Only admin users can delete the entire household' 
          });
        }

        // Get all users in the household
        const { data: allUsers, error: usersError } = await supabase
          .from('users')
          .select('id, name, clerk_id')
          .eq('household_id', householdId);

        if (usersError) {
          console.error('Error fetching household users:', usersError);
          return res.status(500).json({ error: 'Failed to fetch household members' });
        }

        const userCount = allUsers?.length || 0;

        // Delete push subscriptions for all users
        for (const user of allUsers || []) {
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('user_id', user.id);
        }

        // Delete all users in the household
        const { error: deleteUsersError } = await supabase
          .from('users')
          .delete()
          .eq('household_id', householdId);

        if (deleteUsersError) {
          console.error('Error deleting users:', deleteUsersError);
          return res.status(500).json({ error: 'Failed to delete household members' });
        }

        // Delete the household (this will cascade delete related data)
        const { error: deleteHouseholdError } = await supabase
          .from('households')
          .delete()
          .eq('id', householdId);

        if (deleteHouseholdError) {
          console.error('Error deleting household:', deleteHouseholdError);
          return res.status(500).json({ error: 'Failed to delete household' });
        }

        console.log(`✅ Household ${householdId} deleted with ${userCount} members`);

        return res.status(200).json({
          success: true,
          message: `Household and all ${userCount} members deleted permanently`,
          action: 'delete_household',
          deletedCount: userCount
        });
      }

      default:
        return res.status(400).json({ error: 'Invalid action' });
    }

  } catch (error: any) {
    console.error('Delete account error:', error);
    return res.status(500).json({ 
      error: error.message || 'Internal server error' 
    });
  }
}

