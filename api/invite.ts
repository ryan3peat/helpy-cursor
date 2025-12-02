// api/invite.ts
// Creates a pending user and returns a shareable invite link
// NO email required, NO Clerk invitation - just a simple link

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
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

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
    // 1. Create pending user in Supabase (no email needed)
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const { data: newUser, error: userError } = await supabase
      .from('users')
      .insert({
        household_id: householdId,
        name,
        email: null, // Email will be filled when they sign up
        role,
        status: 'pending',
        invite_expires_at: expiresAt.toISOString(),
        avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`,
        allergies: [],
        preferences: [],
      })
      .select()
      .single();

    if (userError) {
      console.error('Supabase insert error:', userError);
      return res.status(500).json({ 
        error: `Failed to create user: ${userError.message}` 
      });
    }

    // 2. Generate simple invite link (no Clerk involved)
    const appUrl = process.env.VITE_APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://helpy-psi.vercel.app';
    const inviteLink = `${appUrl}?invite=true&hid=${householdId}&uid=${newUser.id}`;

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
    console.error('Invite creation error:', error);
    return res.status(500).json({ 
      error: error.message || 'Internal server error' 
    });
  }
}