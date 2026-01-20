-- ============================================================================
-- Migration: 086_fix_duplicate_meal_notifications
-- Description: Fix duplicate notifications when deleting meals/expenses
-- 
-- PROBLEM:
-- When deleting a meal, the code first does an UPDATE (to set last_modified_by
-- for notification attribution), then a DELETE. Both operations trigger
-- notifications, resulting in "changed" + "removed" notifications.
--
-- FIX:
-- Detect "attribution-only" updates where ONLY last_modified_by changed,
-- and skip the notification for those. The DELETE will still send properly.
--
-- HOW TO RUN:
-- 1. Go to Supabase Dashboard → SQL Editor
-- 2. Paste this entire script
-- 3. Click "Run"
-- ============================================================================


-- ============================================================================
-- Update the queue_notification function to skip attribution-only updates
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
  old_without_meta JSONB;
  new_without_meta JSONB;
BEGIN
  -- =========================================================================
  -- FIX: Skip "attribution-only" updates for meals and expenses
  -- These are updates where ONLY last_modified_by (and updated_at) changed.
  -- This happens right before a DELETE to set who deleted the item.
  -- We skip these to avoid duplicate notifications (UPDATE + DELETE).
  -- =========================================================================
  IF TG_OP = 'UPDATE' AND TG_TABLE_NAME IN ('meals', 'expenses') THEN
    -- Remove metadata fields that auto-update or are for attribution only
    old_without_meta := row_to_json(OLD)::jsonb - 'last_modified_by' - 'updated_at';
    new_without_meta := row_to_json(NEW)::jsonb - 'last_modified_by' - 'updated_at';
    
    -- If records are identical after removing metadata, this is attribution-only
    IF old_without_meta = new_without_meta THEN
      -- Skip notification - just return without queueing
      RETURN NEW;
    END IF;
  END IF;

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
-- VERIFICATION
-- ============================================================================
SELECT 'queue_notification function updated' as status,
  'Attribution-only updates will now be skipped for meals/expenses' as description;


-- ============================================================================
-- DONE!
-- 
-- Now when you delete a meal:
-- 1. UPDATE to set last_modified_by → SKIPPED (attribution-only)
-- 2. DELETE → Sends "removed by [Name]" notification
--
-- Only ONE notification will be sent!
-- ============================================================================
