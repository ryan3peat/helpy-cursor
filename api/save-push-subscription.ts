// api/save-push-subscription.ts
// Server-side API route to save push subscriptions using service role (bypasses RLS)
// This is a temporary solution until Supabase JWT verification is configured

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { logger } from './_logger';

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

  const { user_id, household_id, endpoint, p256dh_key, auth_key, user_agent } = req.body;

  // Validate required fields
  if (!user_id || !household_id || !endpoint || !p256dh_key || !auth_key) {
    return res.status(400).json({ 
      error: 'Missing required fields: user_id, household_id, endpoint, p256dh_key, auth_key' 
    });
  }

  // Validate user_id is a UUID
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(user_id)) {
    return res.status(400).json({ 
      error: 'user_id must be a valid UUID' 
    });
  }

  try {
    // Verify user exists and belongs to the household (authorization check)
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, household_id')
      .eq('id', user_id)
      .eq('household_id', household_id)
      .single();

    if (userError || !user) {
      return res.status(403).json({ 
        error: 'User not found or does not belong to household' 
      });
    }

    // Save subscription using service role (bypasses RLS)
    const { data, error } = await supabase
      .from('push_subscriptions')
      .upsert({
        user_id,
        household_id,
        endpoint,
        p256dh_key,
        auth_key,
        user_agent: user_agent || null,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,endpoint',
        ignoreDuplicates: false
      })
      .select()
      .single();

    if (error) {
      logger.error('Failed to save push subscription:', error);
      return res.status(500).json({ 
        error: error.message || 'Failed to save subscription' 
      });
    }

    return res.status(200).json({ 
      success: true, 
      data 
    });

  } catch (error: any) {
    logger.error('Push subscription save error:', error);
    return res.status(500).json({ 
      error: error.message || 'Internal server error' 
    });
  }
}





