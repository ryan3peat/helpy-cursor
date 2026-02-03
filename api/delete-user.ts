// api/delete-user.ts
// Deletes a user from a household using service role (bypasses RLS)

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Inline logger to avoid module resolution issues in Vercel serverless
const isDev = process.env.NODE_ENV !== 'production';
const logger = {
  log: (...args: unknown[]) => isDev && console.log(...args),
  error: (...args: unknown[]) => console.error(...args),
};

// Initialize Supabase with service role (bypasses RLS)
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// CORS: Only allow helpyfam.com, localhost, and Vercel previews
const ALLOWED_ORIGINS = ['https://app.helpyfam.com', 'https://www.helpyfam.com'];
function setCorsHeaders(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin as string | undefined;
  if (origin && (ALLOWED_ORIGINS.includes(origin) || origin.startsWith('http://localhost:') || origin.startsWith('https://localhost') || origin.endsWith('.vercel.app'))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

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
      // Note: requesterId from frontend could be clerk_id OR database id
      // First try clerk_id, then fall back to id
      let requester = null;
      
      const { data: requesterByClerkId } = await supabase
        .from('users')
        .select('id, household_id, role, clerk_id')
        .eq('clerk_id', requesterId)
        .eq('household_id', householdId)
        .maybeSingle();
      
      if (requesterByClerkId) {
        requester = requesterByClerkId;
      } else {
        // Fall back to lookup by database id
        const { data: requesterById } = await supabase
          .from('users')
          .select('id, household_id, role, clerk_id')
          .eq('id', requesterId)
          .eq('household_id', householdId)
          .maybeSingle();
        
        requester = requesterById;
      }

      if (!requester) {
        logger.error('Requester lookup failed:', { requesterId, householdId });
        return res.status(403).json({ error: 'Requester not found' });
      }

      if (requester.household_id !== householdId) {
        return res.status(403).json({ error: 'Not authorized to delete users from this household' });
      }

      // Only Admin, SuperAdmin, Spouse, or Helper roles can delete users
      const allowedRoles = ['Admin', 'SuperAdmin', 'Spouse', 'Helper'];
      if (!allowedRoles.includes(requester.role || '')) {
        return res.status(403).json({ error: 'Only admins, spouses, and helpers can delete members' });
      }
    }

    // Get user to delete (verify they exist and are in the correct household)
    // Note: userId from frontend could be clerk_id OR database id
    let userToDelete = null;
    
    const { data: userByClerkId } = await supabase
      .from('users')
      .select('id, household_id, role, name, clerk_id')
      .eq('clerk_id', userId)
      .eq('household_id', householdId)
      .maybeSingle();
    
    if (userByClerkId) {
      userToDelete = userByClerkId;
    } else {
      // Fall back to lookup by database id
      const { data: userById } = await supabase
        .from('users')
        .select('id, household_id, role, name, clerk_id')
        .eq('id', userId)
        .eq('household_id', householdId)
        .maybeSingle();
      
      userToDelete = userById;
    }

    if (!userToDelete) {
      logger.error('User to delete lookup failed:', { userId, householdId });
      return res.status(404).json({ error: 'User not found in this household' });
    }

    // Use the actual database ID for operations
    const dbUserId = userToDelete.id;

    // Prevent deleting the master user (Admin or SuperAdmin role)
    if (userToDelete.role === 'Admin' || userToDelete.role === 'SuperAdmin') {
      return res.status(403).json({ error: 'Cannot delete the household owner' });
    }

    const userRole = userToDelete.role;
    const isChild = userRole === 'Child';
    const isSpouseOrHelper = ['Spouse', 'Helper'].includes(userRole || '');

    let operationResult;
    let operationMessage;

    if (isChild) {
      // Delete child entirely from the database
      const { error: deleteError } = await supabase
        .from('users')
        .delete()
        .eq('id', dbUserId)
        .eq('household_id', householdId);

      if (deleteError) {
        logger.error('Supabase delete error:', deleteError);
        return res.status(500).json({
          error: `Failed to delete user: ${deleteError.message}`
        });
      }

      operationResult = 'deleted';
      operationMessage = `User ${userToDelete.name} has been completely removed from the system`;
      logger.log(`✅ Successfully deleted child user ${userToDelete.name} (${dbUserId}) entirely from database`);

    } else if (isSpouseOrHelper) {
      // Remove spouse/helper from household but keep their account
      const { error: updateError } = await supabase
        .from('users')
        .update({ household_id: null })
        .eq('id', dbUserId)
        .eq('household_id', householdId);

      if (updateError) {
        logger.error('Supabase update error:', updateError);
        return res.status(500).json({
          error: `Failed to remove user from household: ${updateError.message}`
        });
      }

      operationResult = 'removed';
      operationMessage = `User ${userToDelete.name} has been removed from the household but their account is preserved`;
      logger.log(`✅ Successfully removed spouse/helper user ${userToDelete.name} (${dbUserId}) from household ${householdId}, account preserved`);

    } else {
      // For other roles (e.g., 'Other'), default to removing from household (keep account)
      const { error: updateError } = await supabase
        .from('users')
        .update({ household_id: null })
        .eq('id', dbUserId)
        .eq('household_id', householdId);

      if (updateError) {
        logger.error('Supabase update error:', updateError);
        return res.status(500).json({
          error: `Failed to remove user from household: ${updateError.message}`
        });
      }

      operationResult = 'removed';
      operationMessage = `User ${userToDelete.name} has been removed from the household`;
      logger.log(`✅ Successfully removed user ${userToDelete.name} (${dbUserId}) from household ${householdId}`);
    }

    return res.status(200).json({
      success: true,
      message: operationMessage,
      operation: operationResult, // 'deleted' or 'removed'
      removedUser: {
        id: userToDelete.id,
        name: userToDelete.name,
        role: userToDelete.role,
      }
    });

  } catch (error: any) {
    logger.error('Delete user error:', error);
    return res.status(500).json({ 
      error: error.message || 'Internal server error' 
    });
  }
}

