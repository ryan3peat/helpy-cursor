// api/save-fcm-token.ts
// Server-side API route to save/remove FCM tokens for native Android push notifications.
// Handles Clerk ID → Supabase UUID resolution using service role.

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

// Check if string is a valid UUID
function isValidUuid(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

// Check if string is a Clerk ID format
function isClerkId(str: string): boolean {
  return str.startsWith('user_');
}

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

/**
 * Resolve a user_id (Clerk ID or UUID) to a Supabase UUID.
 */
async function resolveUserId(userId: string, householdId: string): Promise<string | null> {
  // If it's already a valid UUID, check it exists
  if (isValidUuid(userId)) {
    const { data } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .eq('household_id', householdId)
      .maybeSingle();
    if (data) return data.id;
  }

  // If it's a Clerk ID, look up by clerk_id
  if (isClerkId(userId)) {
    const { data } = await supabase
      .from('users')
      .select('id')
      .eq('clerk_id', userId)
      .eq('household_id', householdId)
      .maybeSingle();
    if (data) return data.id;

    // Try without household filter (in case of household mismatch)
    const { data: fallback } = await supabase
      .from('users')
      .select('id')
      .eq('clerk_id', userId)
      .maybeSingle();
    if (fallback) return fallback.id;
  }

  // Try direct lookup by household
  const { data: users } = await supabase
    .from('users')
    .select('id, clerk_id')
    .eq('household_id', householdId);
  
  if (users) {
    const match = users.find(u => u.id === userId || u.clerk_id === userId);
    if (match) return match.id;
  }

  return null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Handle DELETE - remove FCM token
  if (req.method === 'DELETE') {
    const { user_id, household_id, token } = req.body;

    if (!user_id || !household_id || !token) {
      return res.status(400).json({ error: 'Missing required fields: user_id, household_id, token' });
    }

    try {
      const supabaseUserId = await resolveUserId(user_id, household_id);
      if (!supabaseUserId) {
        return res.status(404).json({ error: 'User not found' });
      }

      const { error } = await supabase
        .from('fcm_tokens')
        .delete()
        .eq('user_id', supabaseUserId)
        .eq('token', token);

      if (error) {
        logger.error('[API] Failed to delete FCM token:', error);
        return res.status(500).json({ error: error.message });
      }

      return res.status(200).json({ success: true, message: 'Token removed' });
    } catch (err) {
      logger.error('[API] Error deleting FCM token:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Handle POST - save/update FCM token
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { user_id, household_id, token, platform, device_fingerprint, user_agent } = req.body;

  logger.log('[API] save-fcm-token called:', {
    user_id,
    user_id_type: isClerkId(user_id) ? 'clerk_id' : isValidUuid(user_id) ? 'uuid' : 'unknown',
    household_id,
    platform,
    token_preview: token?.substring(0, 20) + '...',
  });

  // Validate required fields
  if (!user_id || !household_id || !token) {
    return res.status(400).json({
      error: 'Missing required fields: user_id, household_id, token',
    });
  }

  try {
    // Resolve user ID to Supabase UUID
    const supabaseUserId = await resolveUserId(user_id, household_id);

    if (!supabaseUserId) {
      logger.error('[API] Could not resolve user ID:', user_id);
      return res.status(404).json({ error: 'User not found' });
    }

    logger.log('[API] Resolved user ID:', user_id, '→', supabaseUserId);

    // Upsert the FCM token
    // On conflict (same user + token), update the metadata
    const { data, error } = await supabase
      .from('fcm_tokens')
      .upsert(
        {
          user_id: supabaseUserId,
          household_id,
          token,
          platform: platform || 'android',
          device_fingerprint: device_fingerprint || null,
          user_agent: user_agent || null,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id,token',
          ignoreDuplicates: false,
        }
      )
      .select();

    if (error) {
      logger.error('[API] Failed to save FCM token:', error);
      return res.status(500).json({ error: error.message });
    }

    logger.log('[API] FCM token saved successfully:', data?.[0]?.id);

    return res.status(200).json({
      success: true,
      id: data?.[0]?.id,
      user_id: supabaseUserId,
    });
  } catch (err) {
    logger.error('[API] Unexpected error:', err);
    return res.status(500).json({
      error: err instanceof Error ? err.message : 'Internal server error',
    });
  }
}
