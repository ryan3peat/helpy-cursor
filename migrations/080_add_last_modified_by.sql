-- ============================================================================
-- Migration: 080_add_last_modified_by
-- Description: Add last_modified_by column to track WHO performed actions
--              for correct notification attribution
-- 
-- PROBLEM: Notifications show "bought by [user]" but currently show the user
--          who ADDED the item, not who COMPLETED it.
--
-- SOLUTION: Add last_modified_by column that gets updated on every modification.
--           The trigger uses this for UPDATE notifications instead of created_by.
--
-- ID HANDLING:
--   - Column stores Supabase UUIDs (not Clerk IDs)
--   - App passes Clerk ID -> supabaseService.ts converts to UUID
--   - Same pattern as created_by and assignee_id
-- ============================================================================


-- ============================================================================
-- STEP 1: Add last_modified_by column to relevant tables
-- ============================================================================

-- Add to todo_items (shopping + tasks)
ALTER TABLE todo_items 
ADD COLUMN IF NOT EXISTS last_modified_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- Add to meals
ALTER TABLE meals 
ADD COLUMN IF NOT EXISTS last_modified_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- Add to expenses
ALTER TABLE expenses 
ADD COLUMN IF NOT EXISTS last_modified_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- Add comments for documentation
COMMENT ON COLUMN todo_items.last_modified_by IS 'User ID who last modified this item (for notification attribution)';
COMMENT ON COLUMN meals.last_modified_by IS 'User ID who last modified this meal (for notification attribution)';
COMMENT ON COLUMN expenses.last_modified_by IS 'User ID who last modified this expense (for notification attribution)';


-- ============================================================================
-- STEP 2: Update queue_notification() function
-- ============================================================================
-- Key change: For UPDATE operations, use last_modified_by instead of created_by
-- This ensures "bought by" / "done by" notifications show the correct user

CREATE OR REPLACE FUNCTION queue_notification()
RETURNS TRIGGER AS $$
DECLARE
  record_data JSONB;
  old_record_data JSONB;
  actor_id UUID;  -- Renamed from created_by_id for clarity
  hh_id UUID;
  item_type TEXT;
  batch_key TEXT;
BEGIN
  -- Determine record and household based on operation
  IF TG_OP = 'DELETE' THEN
    record_data := row_to_json(OLD)::jsonb;
    old_record_data := NULL;
    -- For DELETE: prefer last_modified_by if set, fallback to created_by
    -- Note: For hard deletes, last_modified_by should be set before deleting
    actor_id := COALESCE(OLD.last_modified_by, OLD.created_by);
    hh_id := OLD.household_id;
  ELSIF TG_OP = 'UPDATE' THEN
    record_data := row_to_json(NEW)::jsonb;
    old_record_data := row_to_json(OLD)::jsonb;
    -- For UPDATE: prefer last_modified_by (who did this action), fallback to created_by
    actor_id := COALESCE(NEW.last_modified_by, NEW.created_by);
    hh_id := NEW.household_id;
  ELSE
    -- INSERT: use created_by (the person adding the item)
    record_data := row_to_json(NEW)::jsonb;
    old_record_data := NULL;
    actor_id := NEW.created_by;
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
  batch_key := hh_id::text || ':' || TG_TABLE_NAME || ':' || COALESCE(item_type, 'all') || ':' || TG_OP || ':' || COALESCE(actor_id::text, 'unknown');

  -- Insert into queue
  INSERT INTO notification_queue (
    household_id,
    table_name,
    event_type,
    record_id,
    record_data,
    old_record_data,
    created_by_user_id,  -- Keep column name for compatibility, but it now holds actor_id
    item_type,
    batch_key
  ) VALUES (
    hh_id,
    TG_TABLE_NAME,
    TG_OP,
    CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END,
    record_data,
    old_record_data,
    actor_id,  -- This is now the person who performed the action
    item_type,
    batch_key
  );

  -- FAST MODE: Immediately trigger batch processing
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
SELECT 'last_modified_by on todo_items' as check_name,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'todo_items' AND column_name = 'last_modified_by'
  )
    THEN '✅ Added'
    ELSE '❌ Not added'
  END as status;

SELECT 'last_modified_by on meals' as check_name,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'meals' AND column_name = 'last_modified_by'
  )
    THEN '✅ Added'
    ELSE '❌ Not added'
  END as status;

SELECT 'last_modified_by on expenses' as check_name,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'expenses' AND column_name = 'last_modified_by'
  )
    THEN '✅ Added'
    ELSE '❌ Not added'
  END as status;


-- ============================================================================
-- DONE!
-- 
-- WHAT THIS CHANGES:
-- - INSERT notifications: Still show "added by [creator]" ✅
-- - UPDATE notifications: Now show "bought by [modifier]" or "done by [modifier]" ✅
-- - DELETE notifications: Show "[modifier]" if last_modified_by was set before delete
--
-- NEXT STEPS:
-- 1. Update types.ts to add lastModifiedBy field
-- 2. Update supabaseService.ts to convert Clerk ID -> UUID
-- 3. Update App.tsx to pass lastModifiedBy on updates/deletes
-- ============================================================================
