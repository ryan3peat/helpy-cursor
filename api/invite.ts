// api/invite.ts
// Creates a pending user and returns a shareable invite link
// NO email required, NO Clerk invitation - just a simple link

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

const PLAN_LIMITS = {
  free: { maxFamily: 3, maxHelpers: 1 },
  core: { maxFamily: 4, maxHelpers: 1 },
  pro: { maxFamily: 8, maxHelpers: 4 },
  test: { maxFamily: 4, maxHelpers: 1 },
} as const;

const isHelperRole = (role?: string | null) => (role || '').toLowerCase() === 'helper';

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

  const { name, role, householdId, inviterId } = req.body;

  // Validate required fields (email NOT required)
  if (!name || !householdId || !role) {
    return res.status(400).json({ 
      error: 'Missing required fields: name, householdId, role' 
    });
  }

  try {
    // Verify inviter is Admin or SuperAdmin
    if (inviterId) {
      logger.log('[Invite API] Looking up inviter:', { inviterId, householdId });
      
      // Check if inviterId looks like a UUID (Supabase ID) or Clerk ID
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(inviterId);
      
      let inviter, inviterError;
      if (isUUID) {
        // Query by Supabase UUID
        const result = await supabase
          .from('users')
          .select('id, household_id, role, clerk_id')
          .eq('id', inviterId)
          .eq('household_id', householdId)
          .maybeSingle();
        inviter = result.data;
        inviterError = result.error;
      } else {
        // Query by Clerk ID
        const result = await supabase
          .from('users')
          .select('id, household_id, role, clerk_id')
          .eq('clerk_id', inviterId)
          .eq('household_id', householdId)
          .maybeSingle();
        inviter = result.data;
        inviterError = result.error;
      }

      logger.log('[Invite API] Inviter lookup result:', { inviter, error: inviterError, isUUID });

      if (inviterError) {
        logger.error('[Invite API] Supabase inviter lookup error:', inviterError);
        return res.status(500).json({ error: `Database error looking up inviter: ${inviterError.message}` });
      }

      if (!inviter) {
        logger.error('[Invite API] Inviter not found for:', { inviterId, householdId });
        return res.status(403).json({ error: `Inviter not found (id: ${inviterId})` });
      }

      if (inviter.role !== 'Admin' && inviter.role !== 'SuperAdmin') {
        logger.error('[Invite API] Inviter is not admin:', { role: inviter.role });
        return res.status(403).json({ error: 'Only admins can invite family members' });
      }
      
      logger.log('[Invite API] Inviter verified as admin');
    }
    // ─────────────────────────────────────────────────────────────
    // Enforce household limits before creating the pending user
    // ─────────────────────────────────────────────────────────────
    const { data: household, error: householdError } = await supabase
      .from('households')
      .select('subscription_plan, max_family_members, max_helpers')
      .eq('id', householdId)
      .single();

    if (householdError) {
      logger.error('Supabase household fetch error:', householdError);
      return res.status(500).json({ error: 'Unable to verify subscription limits' });
    }

    const planKey = (household?.subscription_plan || 'free') as keyof typeof PLAN_LIMITS;
    const defaults = PLAN_LIMITS[planKey] || PLAN_LIMITS.free;
    const limits = {
      maxFamily: household?.max_family_members ?? defaults.maxFamily,
      maxHelpers: household?.max_helpers ?? defaults.maxHelpers,
    };

    const { data: existingUsers, error: usersError } = await supabase
      .from('users')
      .select('role, status')
      .eq('household_id', householdId);

    if (usersError) {
      logger.error('Supabase users fetch error:', usersError);
      return res.status(500).json({ error: 'Unable to check current household members' });
    }

    const activeUsers = (existingUsers || []).filter(u => u?.status !== 'inactive');
    const helperCount = activeUsers.filter(u => isHelperRole(u.role)).length;
    const familyCount = activeUsers.filter(u => !isHelperRole(u.role)).length;

    if (isHelperRole(role) && helperCount >= limits.maxHelpers) {
      return res.status(403).json({
        error: `Helper limit reached for your plan (${limits.maxHelpers} allowed). Please upgrade to add more helpers.`,
      });
    }

    if (!isHelperRole(role) && familyCount >= limits.maxFamily) {
      return res.status(403).json({
        error: `Family member limit reached for your plan (${limits.maxFamily} allowed). Please upgrade to add more family members.`,
      });
    }

    // 1. Create user in Supabase (no email needed)
    // Children are added as 'active', others as 'pending' with invite link
    const isChild = role?.toLowerCase() === 'child';
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const { data: newUser, error: userError } = await supabase
      .from('users')
      .insert({
        household_id: householdId,
        name,
        email: null, // Email will be filled when they sign up
        role,
        status: isChild ? 'active' : 'pending',
        invite_expires_at: isChild ? null : expiresAt.toISOString(),
        avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`,
        allergies: [],
        preferences: [],
        notifications_enabled: true, // Enable notifications by default for new users
      })
      .select()
      .single();

    if (userError) {
      logger.error('Supabase insert error:', userError);
      return res.status(500).json({ 
        error: `Failed to create user: ${userError.message}` 
      });
    }

    // 2. Generate simple invite link (no Clerk involved) - only for non-child users
    // Always use app subdomain for invite links
    const appUrl = 'https://app.helpyfam.com';
    const inviteLink = isChild ? null : `${appUrl}?invite=true&hid=${householdId}&uid=${newUser.id}`;

    // 3. Return success
    return res.status(200).json({
      success: true,
      user: {
        id: newUser.id,
        householdId: newUser.household_id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        status: newUser.status,
        avatar: newUser.avatar,
        expiresAt: newUser.invite_expires_at,
      },
      inviteLink,
    });

  } catch (error: any) {
    logger.error('Invite creation error:', error);
    return res.status(500).json({ 
      error: error.message || 'Internal server error' 
    });
  }
}