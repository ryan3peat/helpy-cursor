// api/accept-invite.ts
// Activates a pending user when they complete signup via invite link
// Uses service role to bypass RLS (new users don't have household claims yet)

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

  const { pendingUserId, householdId, clerkId, email, name, avatar } = req.body;

  logger.log('[Accept Invite API] Request:', { pendingUserId, householdId, clerkId, email, name });

  // Validate required fields
  if (!pendingUserId || !householdId || !clerkId) {
    return res.status(400).json({ 
      error: 'Missing required fields: pendingUserId, householdId, clerkId' 
    });
  }

  try {
    // 1. Check if user already exists with this clerk_id
    const { data: existingUser, error: existingError } = await supabase
      .from('users')
      .select('*')
      .eq('clerk_id', clerkId)
      .maybeSingle();

    if (existingUser) {
      logger.log('[Accept Invite API] User already exists with clerk_id:', existingUser.id);
      
      // Check if they're already in the INVITED household (same invite was processed)
      if (existingUser.household_id === householdId && existingUser.id === pendingUserId) {
        logger.log('[Accept Invite API] User already activated for THIS invite');
        return res.status(200).json({
          success: true,
          user: existingUser,
          message: 'User already activated',
          alreadyActivated: true
        });
      }
      
      // User exists but in a DIFFERENT household - this is a household switch scenario
      // Return a special response so the frontend can handle it
      logger.log('[Accept Invite API] User exists in different household:', existingUser.household_id);
      return res.status(409).json({
        error: 'User already belongs to another household',
        existingHouseholdId: existingUser.household_id,
        invitedHouseholdId: householdId,
        requiresSwitch: true
      });
    }

    // 1b. Check if another user already has this email (duplicate email constraint)
    if (email) {
      const { data: userWithEmail } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .neq('id', pendingUserId) // Exclude the pending user we're about to update
        .maybeSingle();

      if (userWithEmail) {
        logger.log('[Accept Invite API] Another user already has this email:', email);
        logger.log('[Accept Invite API] Existing user with email:', userWithEmail.id, 'household:', userWithEmail.household_id);
        
        // This email is already used by another account
        return res.status(409).json({
          error: 'This email is already associated with another account. Please sign in with that account or use a different email.',
          emailConflict: true,
          existingHouseholdId: userWithEmail.household_id
        });
      }
    }

    // 2. Fetch the pending user
    const { data: pendingUser, error: pendingError } = await supabase
      .from('users')
      .select('*')
      .eq('id', pendingUserId)
      .eq('household_id', householdId)
      .eq('status', 'pending')
      .maybeSingle();

    if (pendingError) {
      logger.error('[Accept Invite API] Error fetching pending user:', pendingError);
      return res.status(500).json({ error: 'Failed to fetch pending user' });
    }

    if (!pendingUser) {
      logger.log('[Accept Invite API] No pending user found:', { pendingUserId, householdId });
      return res.status(404).json({ 
        error: 'Invitation not found or already accepted',
        notFound: true
      });
    }

    // 3. Check if invite has expired
    const expiresAt = pendingUser.invite_expires_at;
    if (expiresAt && new Date(expiresAt) < new Date()) {
      logger.log('[Accept Invite API] Invite expired:', expiresAt);
      return res.status(410).json({ 
        error: 'This invitation has expired',
        expired: true
      });
    }

    // 4. Activate the pending user
    const { data: activatedUser, error: activateError } = await supabase
      .from('users')
      .update({ 
        status: 'active',
        clerk_id: clerkId,
        email: email || pendingUser.email,
        name: name || pendingUser.name,
        avatar: avatar || pendingUser.avatar,
        invite_expires_at: null,
      })
      .eq('id', pendingUserId)
      .eq('household_id', householdId)
      .select()
      .single();

    if (activateError) {
      logger.error('[Accept Invite API] Error activating user:', activateError);
      return res.status(500).json({ 
        error: `Failed to activate user: ${activateError.message}` 
      });
    }

    logger.log('[Accept Invite API] User activated successfully:', activatedUser.id);

    return res.status(200).json({
      success: true,
      user: activatedUser,
      message: 'User activated successfully'
    });

  } catch (error: any) {
    logger.error('[Accept Invite API] Unexpected error:', error);
    return res.status(500).json({ 
      error: error.message || 'Internal server error' 
    });
  }
}






