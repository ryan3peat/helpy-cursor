-- ============================================================================
-- Migration: 087_fix_notification_actor_and_batching
-- Description: Fix notification bugs:
--   1. Wrong actor attribution (shows creator instead of who did the action)
--   2. Mixing completions with regular edits in same batch
-- 
-- ROOT CAUSES:
--   Bug 1: Migration 086 regressed migration 080's fix by using created_by
--          instead of last_modified_by for UPDATE/DELETE operations
--   Bug 2: All UPDATE operations share the same batch key, so "buy item A"
--          and "edit item B" get batched as "A, B bought" (wrong!)
--
-- FIXES:
--   1. Use COALESCE(last_modified_by, created_by) to get the actual actor
--   2. Add update_subtype to batch key: _COMPLETE, _DELETE, _UNCOMPLETE, or empty
--
-- HOW TO RUN:
-- 1. Go to Supabase Dashboard → SQL Editor
-- 2. Paste this entire script
-- 3. Click "Run"
-- ============================================================================


-- ============================================================================
-- Update the queue_notification function with both fixes
-- ============================================================================
CREATE OR REPLACE FUNCTION queue_notification()
RETURNS TRIGGER AS $$
DECLARE
  record_data JSONB;
  old_record_data JSONB;
  actor_id UUID;  -- Who performed this action (not necessarily who created the item)
  hh_id UUID;
  item_type TEXT;
  batch_key TEXT;
  update_subtype TEXT;  -- For distinguishing completions from regular edits
  old_without_meta JSONB;
  new_without_meta JSONB;
BEGIN
  -- =========================================================================
  -- FIX (from migration 086): Skip "attribution-only" updates for meals/expenses
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

  -- =========================================================================
  -- Determine record data and WHO PERFORMED THE ACTION
  -- FIX Bug 1: Use last_modified_by (who did the action), not created_by (who added)
  -- =========================================================================
  IF TG_OP = 'DELETE' THEN
    record_data := row_to_json(OLD)::jsonb;
    old_record_data := NULL;
    -- For DELETE: prefer last_modified_by if set, fallback to created_by
    actor_id := COALESCE(OLD.last_modified_by, OLD.created_by);
    hh_id := OLD.household_id;
    update_subtype := '';  -- DELETE doesn't need subtype
    
  ELSIF TG_OP = 'UPDATE' THEN
    record_data := row_to_json(NEW)::jsonb;
    old_record_data := row_to_json(OLD)::jsonb;
    -- For UPDATE: prefer last_modified_by (who did this action), fallback to created_by
    actor_id := COALESCE(NEW.last_modified_by, NEW.created_by);
    hh_id := NEW.household_id;
    
    -- =========================================================================
    -- FIX Bug 2: Detect what KIND of update this is for proper batching
    -- This ensures "buy item" and "edit item" don't get batched together
    -- =========================================================================
    IF TG_TABLE_NAME = 'todo_items' THEN
      -- Check for COMPLETION (completed changed from false/null to true)
      IF NEW.completed = TRUE AND (OLD.completed IS NULL OR OLD.completed = FALSE) THEN
        update_subtype := '_COMPLETE';
      -- Check for SOFT DELETE (deleted_at being set)
      ELSIF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
        update_subtype := '_DELETE';
      -- Check for UN-COMPLETION (completed changed from true to false/null)
      ELSIF (NEW.completed IS NULL OR NEW.completed = FALSE) AND OLD.completed = TRUE THEN
        update_subtype := '_UNCOMPLETE';
      ELSE
        -- Regular edit (name, quantity, category, etc.)
        update_subtype := '';
      END IF;
    ELSE
      -- For non-todo_items (meals, expenses), no subtype needed
      update_subtype := '';
    END IF;
    
  ELSE
    -- INSERT: use created_by (correct - they are adding the item)
    record_data := row_to_json(NEW)::jsonb;
    old_record_data := NULL;
    actor_id := NEW.created_by;
    hh_id := NEW.household_id;
    update_subtype := '';  -- INSERT doesn't need subtype
  END IF;

  -- Get item type for todo_items (shopping vs task)
  IF TG_TABLE_NAME = 'todo_items' THEN
    item_type := record_data->>'type';
  ELSE
    item_type := NULL;
  END IF;

  -- =========================================================================
  -- Build batch key WITH update subtype
  -- Format: household:table:item_type:OP[_SUBTYPE]:actor
  -- 
  -- Examples:
  --   {hh}:todo_items:shopping:INSERT:{user}        - Adding shopping items
  --   {hh}:todo_items:shopping:UPDATE_COMPLETE:{user} - Buying items
  --   {hh}:todo_items:shopping:UPDATE:{user}        - Editing items
  --   {hh}:todo_items:shopping:UPDATE_DELETE:{user} - Deleting items
  --   {hh}:todo_items:task:UPDATE_COMPLETE:{user}   - Completing tasks
  -- =========================================================================
  batch_key := hh_id::text || ':' || TG_TABLE_NAME || ':' || 
               COALESCE(item_type, 'all') || ':' || TG_OP || update_subtype || ':' || 
               COALESCE(actor_id::text, 'unknown');

  -- Insert into queue
  INSERT INTO notification_queue (
    household_id,
    table_name,
    event_type,
    record_id,
    record_data,
    old_record_data,
    created_by_user_id,  -- Column name kept for compatibility, but now holds actor_id
    item_type,
    batch_key
  ) VALUES (
    hh_id,
    TG_TABLE_NAME,
    TG_OP,
    CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END,
    record_data,
    old_record_data,
    actor_id,  -- Now correctly uses who performed the action
    item_type,
    batch_key
  );

  -- FAST MODE: Immediately trigger batch processing
  -- This checks ALL batches and sends any that are ready
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
  'Bug 1: Now uses last_modified_by for actor attribution' as fix1,
  'Bug 2: Now separates completions/deletes/edits into different batches' as fix2;


-- ============================================================================
-- DONE!
-- 
-- WHAT'S FIXED:
--
-- Bug 1 - Wrong Actor:
--   Before: "Milk bought by [Wife]" (even though YOU bought it)
--   After:  "Milk bought by [You]" ✅
--
-- Bug 2 - Mixed Actions:
--   Before: "Milk, Bread bought by [You]" (but Bread was just edited!)
--   After:  Separate notifications:
--           - "Milk bought by [You]"
--           - "Bread changed by [You]"
--
-- HOW IT WORKS:
--   1. Uses last_modified_by (set by frontend) to determine who did the action
--   2. Creates different batch keys for completions vs edits:
--      - UPDATE_COMPLETE - for buying/completing items
--      - UPDATE_DELETE - for soft deleting items
--      - UPDATE_UNCOMPLETE - for marking items as not done
--      - UPDATE - for regular edits (name, quantity, etc.)
--
-- NO CODE CHANGES NEEDED:
--   The frontend already sets lastModifiedBy correctly.
--   The edge function already handles the actor_id correctly.
--   This fix only changes which column the trigger reads.
-- ============================================================================
