// api/invite/resend.ts
// Regenerates an invite link for a pending user
// Extends expiration and returns new shareable link

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

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

  const { userId, householdId } = req.body;

  if (!userId || !householdId) {
    return res.status(400).json({ 
      error: 'Missing required fields: userId, householdId' 
    });
  }

  try {
    // 1. Verify pending user exists
    const { data: pendingUser, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .eq('household_id', householdId)
      .eq('status', 'pending')
      .single();

    if (fetchError || !pendingUser) {
      return res.status(404).json({ 
        error: 'Pending user not found or already activated' 
      });
    }

    // 2. Extend expiration by 7 more days
    const newExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    
    await supabase
      .from('users')
      .update({ invite_expires_at: newExpiry.toISOString() })
      .eq('id', userId);

    // 3. Generate new invite link
    const appUrl = process.env.VITE_APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://helpy-psi.vercel.app';
    const inviteLink = `${appUrl}?invite=true&hid=${householdId}&uid=${userId}`;

    return res.status(200).json({
      success: true,
      inviteLink,
      expiresAt: newExpiry.toISOString(),
    });

  } catch (error: any) {
    console.error('Resend invite error:', error);
    return res.status(500).json({ 
      error: error.message || 'Failed to resend invitation' 
    });
  }
}