// api/cron/process-batches.ts
// Vercel Cron Job to process notification batches
// This runs every minute to ensure batched notifications are sent
// even when no user has their app open.
//
// NO USER ID HANDLING - just triggers existing Postgres function

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Verify this is a cron request (optional security check)
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;
  
  // If CRON_SECRET is set, validate it
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.log('[Cron] Unauthorized request - missing or invalid CRON_SECRET');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    console.log('[Cron] Processing notification batches...');
    
    // Call the existing Postgres function
    // This function already handles everything:
    // - Finding batches where window has expired
    // - Sending notifications via Edge Function
    // - Marking batches as processed
    const { data, error } = await supabase.rpc('process_notification_batches');
    
    if (error) {
      // Function might not exist - log but don't fail
      if (error.code === '42883') {
        console.log('[Cron] process_notification_batches RPC not found (migration may not be run)');
        return res.status(200).json({ success: true, message: 'RPC not available' });
      }
      
      console.error('[Cron] Error processing batches:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
    
    console.log('[Cron] Batch processing complete');
    
    return res.status(200).json({ 
      success: true, 
      processed_at: new Date().toISOString()
    });
    
  } catch (err) {
    console.error('[Cron] Unexpected error:', err);
    return res.status(500).json({ 
      success: false, 
      error: err instanceof Error ? err.message : 'Unknown error' 
    });
  }
}
