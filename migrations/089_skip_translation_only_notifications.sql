-- ============================================================================
-- Migration: 089_skip_translation_only_notifications
-- Description: Skip notifications when only translation fields are updated
-- 
-- PROBLEM: When a user changes their language, AI translations are cached
--          by updating *_translations fields. This triggers notifications
--          like "Milk changed by Ryan" even though it's just a translation
--          cache update, not a real user edit.
--
-- SOLUTION: Detect translation-only updates and skip notification queueing.
--           Translation fields to check:
--           - todo_items: name_translations
--           - meals: description_translations  
--           - expenses: merchant_translations
--
-- HOW TO RUN:
-- 1. Go to Supabase Dashboard → SQL Editor
-- 2. Paste this entire script
-- 3. Click "Run"
-- ============================================================================


-- ============================================================================
-- Update the queue_notification function to skip translation-only updates
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
  -- SKIP: Translation-only updates for todo_items
  -- These happen when a user changes language and AI translation is cached.
  -- We compare records after removing translation and metadata fields.
  -- =========================================================================
  IF TG_OP = 'UPDATE' AND TG_TABLE_NAME = 'todo_items' THEN
    -- Remove translation fields and auto-update metadata
    old_without_meta := row_to_json(OLD)::jsonb 
      - 'name_translations' 
      - 'updated_at';
    new_without_meta := row_to_json(NEW)::jsonb 
      - 'name_translations' 
      - 'updated_at';
    
    -- If records are identical after removing translation fields, skip notification
    IF old_without_meta = new_without_meta THEN
      RETURN NEW;
    END IF;
  END IF;

  -- =========================================================================
  -- SKIP: Translation-only updates AND attribution-only updates for meals
  -- Translation: only description_translations changed
  -- Attribution: only last_modified_by changed (pre-delete attribution)
  -- =========================================================================
  IF TG_OP = 'UPDATE' AND TG_TABLE_NAME = 'meals' THEN
    -- Remove translation fields, attribution, and auto-update metadata
    old_without_meta := row_to_json(OLD)::jsonb 
      - 'description_translations' 
      - 'last_modified_by' 
      - 'updated_at';
    new_without_meta := row_to_json(NEW)::jsonb 
      - 'description_translations' 
      - 'last_modified_by' 
      - 'updated_at';
    
    -- If records are identical after removing these fields, skip notification
    IF old_without_meta = new_without_meta THEN
      RETURN NEW;
    END IF;
  END IF;

  -- =========================================================================
  -- SKIP: Translation-only updates AND attribution-only updates for expenses
  -- Translation: only merchant_translations changed
  -- Attribution: only last_modified_by changed (pre-delete attribution)
  -- =========================================================================
  IF TG_OP = 'UPDATE' AND TG_TABLE_NAME = 'expenses' THEN
    -- Remove translation fields, attribution, and auto-update metadata
    old_without_meta := row_to_json(OLD)::jsonb 
      - 'merchant_translations' 
      - 'last_modified_by' 
      - 'updated_at';
    new_without_meta := row_to_json(NEW)::jsonb 
      - 'merchant_translations' 
      - 'last_modified_by' 
      - 'updated_at';
    
    -- If records are identical after removing these fields, skip notification
    IF old_without_meta = new_without_meta THEN
      RETURN NEW;
    END IF;
  END IF;

  -- =========================================================================
  -- Determine record data and WHO PERFORMED THE ACTION
  -- Use last_modified_by (who did the action), not created_by (who added)
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
    -- Detect what KIND of update this is for proper batching
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
  'Translation-only updates now skip notifications for:' as fix,
  '- todo_items (name_translations)' as table1,
  '- meals (description_translations)' as table2,
  '- expenses (merchant_translations)' as table3;


-- ============================================================================
-- DONE!
-- 
-- WHAT'S FIXED:
--
-- Before: User changes language → AI translation cached → "Milk changed by Ryan"
-- After:  User changes language → AI translation cached → No notification
--
-- HOW IT WORKS:
--   1. For UPDATE operations, compare OLD and NEW records
--   2. Remove translation fields (*_translations) and metadata (updated_at, last_modified_by)
--   3. If records are identical after removal, it's a translation-only update
--   4. Skip notification queueing for these updates
--
-- FIELDS IGNORED (not counted as "real" changes):
--   - todo_items: name_translations, updated_at
--   - meals: description_translations, last_modified_by, updated_at
--   - expenses: merchant_translations, last_modified_by, updated_at
--
-- NOTE: This also covers the "attribution-only" fix from migration 086/087
--       for meals and expenses (when only last_modified_by changed before DELETE)
-- ============================================================================
