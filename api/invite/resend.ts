// api/invite/resend.ts
// Regenerates an invite link for a pending user
// Extends expiration and returns new shareable link

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Inline logger to avoid module resolution issues in Vercel serverless
const isDev = process.env.NODE_ENV !== 'production';
const logger = {
  log: (...args: unknown[]) => isDev && console.log(...args),
  error: (...args: unknown[]) => console.error(...args),
};

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
    // Always use app subdomain for invite links
    const appUrl = 'https://app.helpyfam.com';
    const inviteLink = `${appUrl}?invite=true&hid=${householdId}&uid=${userId}`;

    return res.status(200).json({
      success: true,
      inviteLink,
      expiresAt: newExpiry.toISOString(),
    });

  } catch (error: any) {
    logger.error('Resend invite error:', error);
    return res.status(500).json({ 
      error: error.message || 'Failed to resend invitation' 
    });
  }
}