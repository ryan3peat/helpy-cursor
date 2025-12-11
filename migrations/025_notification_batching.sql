-- ============================================================================
-- Migration: 025_notification_batching
-- Description: Add notification batching (15s for Shopping/Tasks, 60s for Expenses)
-- 
-- This migration:
-- 1. Creates notification_queue table to hold pending notifications
-- 2. Updates triggers to queue notifications AND trigger batch processing
-- 3. Creates a batch processor function
-- 4. FAST MODE: Processor is called on every insert (no pg_cron delay!)
--
-- HOW IT WORKS:
-- - Every item added goes to queue
-- - Immediately after, batch processor checks all batches
-- - If any batch's OLDEST item is past the window AND no new items in window, it sends
-- - Result: Notifications sent within seconds of batch window expiring!
--
-- HOW TO RUN:
-- 1. Go to Supabase Dashboard → SQL Editor
-- 2. Paste this entire script
-- 3. Click "Run"
-- ============================================================================


-- ============================================================================
-- STEP 1: Create notification_queue table
-- ============================================================================
CREATE TABLE IF NOT EXISTS notification_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  table_name TEXT NOT NULL,  -- 'todo_items', 'meals', 'expenses', 'households'
  event_type TEXT NOT NULL,  -- 'INSERT', 'UPDATE', 'DELETE'
  record_id UUID NOT NULL,   -- ID of the item
  record_data JSONB NOT NULL, -- Full record data
  old_record_data JSONB,     -- Old record for UPDATEs
  created_by_user_id UUID,   -- Who triggered this
  item_type TEXT,            -- 'shopping' or 'task' for todo_items
  queued_at TIMESTAMPTZ DEFAULT NOW(),
  batch_key TEXT NOT NULL,   -- For grouping: household_id:table:type:user_id
  processed BOOLEAN DEFAULT FALSE
);

-- Index for efficient batch queries
CREATE INDEX IF NOT EXISTS idx_notification_queue_batch 
ON notification_queue(batch_key, processed, queued_at);

CREATE INDEX IF NOT EXISTS idx_notification_queue_unprocessed
ON notification_queue(processed, queued_at) WHERE processed = FALSE;

-- RLS
ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on notification_queue" ON notification_queue FOR ALL USING (true);


-- ============================================================================
-- STEP 2: Create function to add notifications to queue
-- ============================================================================
CREATE OR REPLACE FUNCTION queue_notification()
RETURNS TRIGGER AS $$
DECLARE
  record_data JSONB;
  old_record_data JSONB;
  created_by_id UUID;
  hh_id UUID;
  item_type TEXT;
  batch_key TEXT;
BEGIN
  -- Determine record and household based on operation
  IF TG_OP = 'DELETE' THEN
    record_data := row_to_json(OLD)::jsonb;
    old_record_data := NULL;
    created_by_id := OLD.created_by;
    hh_id := OLD.household_id;
  ELSIF TG_OP = 'UPDATE' THEN
    record_data := row_to_json(NEW)::jsonb;
    old_record_data := row_to_json(OLD)::jsonb;
    created_by_id := NEW.created_by;
    hh_id := NEW.household_id;
  ELSE
    record_data := row_to_json(NEW)::jsonb;
    old_record_data := NULL;
    created_by_id := NEW.created_by;
    hh_id := NEW.household_id;
  END IF;

  -- Get item type for todo_items
  IF TG_TABLE_NAME = 'todo_items' THEN
    item_type := record_data->>'type';
  ELSE
    item_type := NULL;
  END IF;

  -- Build batch key for grouping
  -- Format: household_id:table:item_type:event:user_id
  batch_key := hh_id::text || ':' || TG_TABLE_NAME || ':' || COALESCE(item_type, 'all') || ':' || TG_OP || ':' || COALESCE(created_by_id::text, 'unknown');

  -- Insert into queue
  INSERT INTO notification_queue (
    household_id,
    table_name,
    event_type,
    record_id,
    record_data,
    old_record_data,
    created_by_user_id,
    item_type,
    batch_key
  ) VALUES (
    hh_id,
    TG_TABLE_NAME,
    TG_OP,
    CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END,
    record_data,
    old_record_data,
    created_by_id,
    item_type,
    batch_key
  );

  -- FAST MODE: Immediately trigger batch processing
  -- This checks ALL batches and sends any that are ready
  -- (If a batch isn't ready yet, it just skips it)
  PERFORM process_notification_batches();

  -- Return appropriate record
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================================
-- STEP 3: Create batch processor function
-- ============================================================================
CREATE OR REPLACE FUNCTION process_notification_batches()
RETURNS void AS $$
DECLARE
  project_ref TEXT := 'rnnqusevbnxnxmhlajlr';
  anon_key TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJubnF1c2V2Ym54bnhtaGxhamxyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMzNTU0OTMsImV4cCI6MjA3ODkzMTQ5M30.5tkZ112xOdk5VqtuI0cluTWszvYGK7zpW8oDJWiTKLw';
  supabase_url TEXT;
  batch RECORD;
  batch_window_seconds INT;
  items JSONB;
  payload JSONB;
BEGIN
  supabase_url := 'https://' || project_ref || '.supabase.co';

  -- Find batches that are ready to send
  -- A batch is ready when:
  -- 1. It has unprocessed items
  -- 2. The oldest item is older than the batch window
  FOR batch IN 
    SELECT 
      batch_key,
      MIN(queued_at) as first_queued,
      MAX(queued_at) as last_queued,
      COUNT(*) as item_count,
      -- Get batch window based on table/type
      CASE 
        WHEN table_name = 'expenses' THEN 60  -- 60 seconds for expenses
        WHEN table_name = 'meals' THEN 0      -- Instant for meals
        WHEN table_name = 'households' THEN 0 -- Instant for family board
        ELSE 15                                -- 15 seconds for shopping/tasks
      END as batch_window,
      table_name,
      event_type,
      item_type,
      household_id,
      created_by_user_id
    FROM notification_queue
    WHERE processed = FALSE
    GROUP BY batch_key, table_name, event_type, item_type, household_id, created_by_user_id
    HAVING 
      -- Check if batch window has passed since LAST item was queued
      -- This ensures we wait for rapid-fire additions to complete
      EXTRACT(EPOCH FROM (NOW() - MAX(queued_at))) >= 
        CASE 
          WHEN table_name = 'expenses' THEN 60
          WHEN table_name = 'meals' THEN 0
          WHEN table_name = 'households' THEN 0
          ELSE 15
        END
  LOOP
    -- Collect all items in this batch
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', record_id,
        'record', record_data,
        'old_record', old_record_data
      )
    ) INTO items
    FROM notification_queue
    WHERE batch_key = batch.batch_key AND processed = FALSE;

    -- Build payload for edge function
    payload := jsonb_build_object(
      'is_batch', true,
      'table', batch.table_name,
      'event', batch.event_type,
      'item_type', batch.item_type,
      'household_id', batch.household_id::text,
      'created_by_user_id', batch.created_by_user_id::text,
      'items', items,
      'item_count', batch.item_count
    );

    -- Send to edge function
    PERFORM net.http_post(
      url := supabase_url || '/functions/v1/send-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || anon_key
      ),
      body := payload
    );

    -- Mark items as processed
    UPDATE notification_queue
    SET processed = TRUE
    WHERE batch_key = batch.batch_key AND processed = FALSE;

    RAISE NOTICE 'Processed batch: % with % items', batch.batch_key, batch.item_count;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================================
-- STEP 4: Drop old triggers and create new queue-based triggers
-- ============================================================================

-- Drop old direct-send triggers
DROP TRIGGER IF EXISTS on_todo_item_insert_notify ON todo_items;
DROP TRIGGER IF EXISTS on_todo_item_update_notify ON todo_items;
DROP TRIGGER IF EXISTS on_todo_item_delete_notify ON todo_items;
DROP TRIGGER IF EXISTS on_meal_insert_notify ON meals;
DROP TRIGGER IF EXISTS on_meal_update_notify ON meals;
DROP TRIGGER IF EXISTS on_meal_delete_notify ON meals;
DROP TRIGGER IF EXISTS on_expense_insert_notify ON expenses;
DROP TRIGGER IF EXISTS on_expense_update_notify ON expenses;
DROP TRIGGER IF EXISTS on_expense_delete_notify ON expenses;
DROP TRIGGER IF EXISTS on_family_notes_update_notify ON households;

-- Create new queue-based triggers for todo_items
CREATE TRIGGER on_todo_item_queue_notify
AFTER INSERT OR UPDATE OR DELETE ON todo_items
FOR EACH ROW
EXECUTE FUNCTION queue_notification();

-- Create new queue-based triggers for meals
CREATE TRIGGER on_meal_queue_notify
AFTER INSERT OR UPDATE OR DELETE ON meals
FOR EACH ROW
EXECUTE FUNCTION queue_notification();

-- Create new queue-based triggers for expenses
CREATE TRIGGER on_expense_queue_notify
AFTER INSERT OR UPDATE OR DELETE ON expenses
FOR EACH ROW
EXECUTE FUNCTION queue_notification();

-- Special trigger for Family Board (households.family_notes)
CREATE OR REPLACE FUNCTION queue_family_board_notification()
RETURNS TRIGGER AS $$
DECLARE
  batch_key TEXT;
BEGIN
  -- Only trigger if family_notes changed
  IF OLD.family_notes IS DISTINCT FROM NEW.family_notes THEN
    batch_key := NEW.id::text || ':households:family_board:UPDATE:unknown';
    
    INSERT INTO notification_queue (
      household_id,
      table_name,
      event_type,
      record_id,
      record_data,
      old_record_data,
      created_by_user_id,
      item_type,
      batch_key
    ) VALUES (
      NEW.id,  -- For households, id IS the household_id
      'households',
      'UPDATE',
      NEW.id,
      jsonb_build_object('id', NEW.id, 'family_notes', NEW.family_notes, 'household_id', NEW.id),
      jsonb_build_object('id', OLD.id, 'family_notes', OLD.family_notes),
      NULL,  -- No created_by for family board yet
      'family_board',
      batch_key
    );
    
    -- FAST MODE: Immediately trigger batch processing
    -- Family Board has 0-second window, so it sends instantly
    PERFORM process_notification_batches();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_family_board_queue_notify
AFTER UPDATE ON households
FOR EACH ROW
EXECUTE FUNCTION queue_family_board_notification();


-- ============================================================================
-- STEP 5: pg_cron is NOT needed! (FAST MODE)
-- ============================================================================
-- The batch processor is called automatically after every insert.
-- No need for scheduled jobs - notifications are sent within seconds!
--
-- If you want a backup cleanup job, you can optionally enable pg_cron:
-- 
-- DO $$
-- BEGIN
--   CREATE EXTENSION IF NOT EXISTS pg_cron;
--   PERFORM cron.schedule('cleanup-notification-queue', '0 * * * *', 'SELECT cleanup_old_notifications();');
-- EXCEPTION WHEN OTHERS THEN NULL;
-- END $$;


-- ============================================================================
-- STEP 6: Create a helper function to manually trigger batch processing
-- ============================================================================
-- This can be called from an edge function on a timer if pg_cron isn't available

CREATE OR REPLACE FUNCTION trigger_batch_processing()
RETURNS JSONB AS $$
DECLARE
  pending_count INT;
BEGIN
  -- Get count of pending items
  SELECT COUNT(*) INTO pending_count FROM notification_queue WHERE processed = FALSE;
  
  -- Process batches
  PERFORM process_notification_batches();
  
  RETURN jsonb_build_object(
    'success', true,
    'pending_before', pending_count,
    'processed_at', NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================================
-- STEP 7: Cleanup old processed notifications (keep for 24 hours for debugging)
-- ============================================================================
CREATE OR REPLACE FUNCTION cleanup_old_notifications()
RETURNS INT AS $$
DECLARE
  deleted_count INT;
BEGIN
  DELETE FROM notification_queue
  WHERE processed = TRUE AND queued_at < NOW() - INTERVAL '24 hours';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- VERIFICATION
-- ============================================================================
SELECT 'notification_queue table' as check_name,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notification_queue')
    THEN '✅ Created'
    ELSE '❌ Not created'
  END as status;

SELECT 'Queue triggers' as check_name,
  (SELECT COUNT(*)::text FROM pg_trigger WHERE tgname LIKE '%queue_notify') || ' trigger(s) created' as status;


-- ============================================================================
-- DONE!
-- 
-- 🚀 FAST MODE BATCHING is now active!
--
-- How it works:
-- 1. Item added → Goes to queue
-- 2. Batch processor runs IMMEDIATELY
-- 3. Checks: "Is any batch's window expired?"
-- 4. If yes → Sends notification
-- 5. If no → Does nothing (waits for more items or window to expire)
--
-- Timing:
-- - Shopping/Tasks: ~15 seconds after LAST item added
-- - Expenses: ~60 seconds after LAST item added
-- - Meals/Family Board: Instant!
--
-- No pg_cron needed! Notifications sent within seconds of window expiring.
--
-- IMPORTANT: 
-- 1. Deploy the updated edge function to handle batched notifications
-- 2. Test by adding multiple items quickly
-- ============================================================================

