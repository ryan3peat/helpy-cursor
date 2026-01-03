-- ============================================================================
-- Migration: 029_push_retry_queue
-- Description: Add retry mechanism for failed push notifications
--
-- When a push notification fails (server error, not 410/404), we queue it
-- for retry with exponential backoff.
--
-- HOW TO RUN:
-- 1. Go to Supabase Dashboard → SQL Editor
-- 2. Paste this entire script
-- 3. Click "Run"
-- ============================================================================


-- ============================================================================
-- STEP 1: Create push_retry_queue table
-- ============================================================================

CREATE TABLE IF NOT EXISTS push_retry_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES push_subscriptions(id) ON DELETE CASCADE,
  payload JSONB NOT NULL,  -- The notification payload to retry
  error_message TEXT,      -- Last error message
  retry_count INT DEFAULT 0,
  max_retries INT DEFAULT 3,
  next_retry_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_attempt_at TIMESTAMPTZ
);

-- Index for efficient retry queries
CREATE INDEX IF NOT EXISTS idx_push_retry_queue_next_retry
ON push_retry_queue(next_retry_at) 
WHERE retry_count < max_retries;

-- RLS
ALTER TABLE push_retry_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on push_retry_queue" ON push_retry_queue FOR ALL USING (true);


-- ============================================================================
-- STEP 2: Create function to add failed push to retry queue
-- ============================================================================

CREATE OR REPLACE FUNCTION queue_push_for_retry(
  p_subscription_id UUID,
  p_payload JSONB,
  p_error_message TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  result_id UUID;
  delay_seconds INT;
BEGIN
  -- Calculate delay using exponential backoff (60s, 300s, 900s)
  SELECT 60 * POWER(5, COALESCE(
    (SELECT retry_count FROM push_retry_queue 
     WHERE subscription_id = p_subscription_id 
     ORDER BY created_at DESC LIMIT 1), 
    0
  )) INTO delay_seconds;
  
  -- Cap at 15 minutes
  delay_seconds := LEAST(delay_seconds, 900);
  
  INSERT INTO push_retry_queue (
    subscription_id,
    payload,
    error_message,
    next_retry_at
  ) VALUES (
    p_subscription_id,
    p_payload,
    p_error_message,
    NOW() + (delay_seconds || ' seconds')::INTERVAL
  )
  RETURNING id INTO result_id;
  
  RETURN result_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================================
-- STEP 3: Create function to process retry queue
-- This should be called periodically (by pg_cron or client)
-- ============================================================================

CREATE OR REPLACE FUNCTION process_push_retry_queue()
RETURNS TABLE(processed INT, failed INT, remaining INT) AS $$
DECLARE
  retry_record RECORD;
  processed_count INT := 0;
  failed_count INT := 0;
  remaining_count INT;
BEGIN
  -- Get items ready for retry
  FOR retry_record IN 
    SELECT rq.*, ps.endpoint, ps.p256dh_key, ps.auth_key
    FROM push_retry_queue rq
    JOIN push_subscriptions ps ON rq.subscription_id = ps.id
    WHERE rq.next_retry_at <= NOW()
      AND rq.retry_count < rq.max_retries
    ORDER BY rq.next_retry_at
    LIMIT 10  -- Process max 10 at a time
  LOOP
    -- Note: Actual push sending happens in edge function
    -- Here we just mark as attempted and update retry count
    
    UPDATE push_retry_queue
    SET 
      retry_count = retry_count + 1,
      last_attempt_at = NOW(),
      next_retry_at = NOW() + (60 * POWER(5, retry_count + 1) || ' seconds')::INTERVAL
    WHERE id = retry_record.id;
    
    processed_count := processed_count + 1;
  END LOOP;
  
  -- Clean up exhausted retries (max retries reached)
  DELETE FROM push_retry_queue
  WHERE retry_count >= max_retries;
  
  GET DIAGNOSTICS failed_count = ROW_COUNT;
  
  -- Count remaining
  SELECT COUNT(*) INTO remaining_count 
  FROM push_retry_queue 
  WHERE retry_count < max_retries;
  
  RETURN QUERY SELECT processed_count, failed_count, remaining_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================================
-- STEP 4: Make the function accessible via RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION public.trigger_push_retries()
RETURNS JSONB
SECURITY DEFINER
AS $$
DECLARE
  result RECORD;
BEGIN
  SELECT * INTO result FROM process_push_retry_queue();
  
  RETURN jsonb_build_object(
    'success', true,
    'processed', result.processed,
    'failed', result.failed,
    'remaining', result.remaining,
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

GRANT EXECUTE ON FUNCTION public.trigger_push_retries() TO authenticated;
GRANT EXECUTE ON FUNCTION public.trigger_push_retries() TO anon;


-- ============================================================================
-- STEP 5: Schedule with pg_cron if available
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'process-push-retries',
      '*/2 * * * *',  -- Every 2 minutes
      'SELECT process_push_retry_queue();'
    );
    RAISE NOTICE '✅ pg_cron job scheduled for push retries (every 2 minutes)';
  ELSE
    RAISE NOTICE '⚠️ pg_cron not available - use client-side trigger';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '⚠️ Failed to schedule pg_cron job: %', SQLERRM;
END $$;


-- ============================================================================
-- STEP 6: Cleanup old entries
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_push_retry_queue()
RETURNS INT AS $$
DECLARE
  deleted_count INT;
BEGIN
  -- Delete entries older than 24 hours or exhausted retries
  DELETE FROM push_retry_queue
  WHERE created_at < NOW() - INTERVAL '24 hours'
     OR retry_count >= max_retries;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- VERIFICATION
-- ============================================================================

SELECT 'push_retry_queue table' as check_name,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'push_retry_queue')
    THEN '✅ Created'
    ELSE '❌ Not created'
  END as status;

SELECT 'queue_push_for_retry function' as check_name,
  CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'queue_push_for_retry')
    THEN '✅ Created'
    ELSE '❌ Not created'
  END as status;

SELECT 'trigger_push_retries RPC' as check_name,
  CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'trigger_push_retries')
    THEN '✅ Created'
    ELSE '❌ Not created'
  END as status;


-- ============================================================================
-- DONE!
--
-- To queue a failed push for retry (from Edge Function):
--   SELECT queue_push_for_retry(subscription_id, payload, error_message);
--
-- To process retry queue manually:
--   SELECT * FROM process_push_retry_queue();
--   OR
--   SELECT public.trigger_push_retries();
--
-- The Edge Function needs to be updated to call queue_push_for_retry
-- when a push fails with a 5xx error.
-- ============================================================================

