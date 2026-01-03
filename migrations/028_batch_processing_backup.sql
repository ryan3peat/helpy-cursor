-- ============================================================================
-- Migration: 028_batch_processing_backup
-- Description: Add backup mechanism for batch notification processing
--
-- The current system processes batches after each insert, but if batch window
-- hasn't expired, nothing happens. This adds:
-- 1. pg_cron job (if extension available) to process every 5 minutes
-- 2. An RPC function that can be called from the client periodically
--
-- HOW TO RUN:
-- 1. Go to Supabase Dashboard → SQL Editor
-- 2. Paste this entire script
-- 3. Click "Run"
-- ============================================================================


-- ============================================================================
-- STEP 1: Create a public RPC function to trigger batch processing
-- This can be called from the client app periodically as a backup
-- ============================================================================

CREATE OR REPLACE FUNCTION public.trigger_notification_batches()
RETURNS JSONB
SECURITY DEFINER
AS $$
DECLARE
  pending_count INT;
  batches_processed INT := 0;
BEGIN
  -- Count pending items before processing
  SELECT COUNT(*) INTO pending_count 
  FROM notification_queue 
  WHERE processed = FALSE;
  
  -- If there are pending items, process them
  IF pending_count > 0 THEN
    PERFORM process_notification_batches();
    
    -- Count how many were actually processed
    SELECT pending_count - COUNT(*) INTO batches_processed
    FROM notification_queue
    WHERE processed = FALSE;
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'pending_before', pending_count,
    'processed', GREATEST(0, batches_processed),
    'timestamp', NOW()
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'timestamp', NOW()
  );
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.trigger_notification_batches() TO authenticated;
GRANT EXECUTE ON FUNCTION public.trigger_notification_batches() TO anon;


-- ============================================================================
-- STEP 2: Try to enable pg_cron (may fail if not available)
-- ============================================================================

DO $$
BEGIN
  -- Try to enable pg_cron extension
  CREATE EXTENSION IF NOT EXISTS pg_cron;
  RAISE NOTICE '✅ pg_cron extension enabled';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '⚠️ pg_cron not available: %. Using client-side backup instead.', SQLERRM;
END $$;


-- ============================================================================
-- STEP 3: Create pg_cron job if extension is available
-- ============================================================================

DO $$
BEGIN
  -- Check if pg_cron is available
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Schedule job to run every 5 minutes
    PERFORM cron.schedule(
      'process-notification-batches-backup',
      '*/5 * * * *',  -- Every 5 minutes
      'SELECT process_notification_batches();'
    );
    RAISE NOTICE '✅ pg_cron job scheduled: process-notification-batches-backup (every 5 minutes)';
  ELSE
    RAISE NOTICE '⚠️ pg_cron not available - client-side backup will be used';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '⚠️ Failed to schedule pg_cron job: %. Client-side backup will be used.', SQLERRM;
END $$;


-- ============================================================================
-- VERIFICATION
-- ============================================================================

SELECT 'RPC Function' as check_name,
  CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'trigger_notification_batches')
    THEN '✅ Created'
    ELSE '❌ Not created'
  END as status;

SELECT 'pg_cron Extension' as check_name,
  CASE WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
    THEN '✅ Available'
    ELSE '⚠️ Not available (use client-side backup)'
  END as status;


-- ============================================================================
-- DONE!
-- 
-- If pg_cron is available, batches will be processed every 5 minutes.
-- If not, the client should call trigger_notification_batches() periodically.
--
-- To test: SELECT public.trigger_notification_batches();
-- ============================================================================

