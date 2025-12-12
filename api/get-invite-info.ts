// api/get-invite-info.ts
// Fetches invite details without requiring authentication
// Used to show welcome page before user signs up

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
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { hid, uid } = req.query;

  if (!hid || !uid || typeof hid !== 'string' || typeof uid !== 'string') {
    return res.status(400).json({ 
      error: 'Missing required parameters: hid and uid' 
    });
  }

  try {
    // 1. Fetch user (pending or active)
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, name, role, household_id, status, invite_expires_at, clerk_id')
      .eq('id', uid)
      .eq('household_id', hid)
      .maybeSingle();

    if (userError || !user) {
      return res.status(404).json({ 
        error: 'Invitation not found',
        isValid: false
      });
    }

    // If user is already active, return that info so frontend can handle it
    if (user.status === 'active') {
      return res.status(200).json({
        isValid: true,
        alreadyActive: true,
        pendingUserName: user.name,
        pendingUserRole: user.role,
        status: 'active'
      });
    }

    // Use the user as pendingUser for the rest of the flow
    const pendingUser = user;

    // 2. Check if invite has expired
    const expiresAt = pendingUser.invite_expires_at;
    const isExpired = expiresAt && new Date(expiresAt) < new Date();

    if (isExpired) {
      return res.status(410).json({ 
        error: 'This invitation has expired',
        isValid: false,
        expired: true
      });
    }

    // 3. Fetch household info
    const { data: household, error: householdError } = await supabase
      .from('households')
      .select('id, name')
      .eq('id', hid)
      .maybeSingle();

    if (householdError || !household) {
      return res.status(404).json({ 
        error: 'Household not found',
        isValid: false
      });
    }

    // 4. Fetch admin user (the one who sent the invite)
    const { data: adminUser, error: adminError } = await supabase
      .from('users')
      .select('id, name, role')
      .eq('household_id', hid)
      .eq('role', 'Admin')
      .eq('status', 'active')
      .maybeSingle();

    if (adminError || !adminUser) {
      // If no admin found, use household name as fallback
      return res.status(200).json({
        isValid: true,
        pendingUserName: pendingUser.name,
        pendingUserRole: pendingUser.role,
        householdName: household.name,
        adminName: null, // No admin found, will use household name
        expiresAt: expiresAt
      });
    }

    // 5. Return invite info
    return res.status(200).json({
      isValid: true,
      pendingUserName: pendingUser.name,
      pendingUserRole: pendingUser.role,
      householdName: household.name,
      adminName: adminUser.name,
      expiresAt: expiresAt
    });

  } catch (error: any) {
    console.error('Get invite info error:', error);
    return res.status(500).json({ 
      error: error.message || 'Internal server error',
      isValid: false
    });
  }
}






