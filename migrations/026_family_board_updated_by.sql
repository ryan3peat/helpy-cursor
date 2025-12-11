-- ============================================================================
-- Migration: 026_family_board_updated_by
-- Description: Add tracking for who updated family notes
-- ============================================================================

-- Step 1: Add column to track who updated family notes
ALTER TABLE households 
ADD COLUMN IF NOT EXISTS family_notes_updated_by UUID REFERENCES users(id);

-- Step 2: Update the Family Board trigger to use this field
CREATE OR REPLACE FUNCTION queue_family_board_notification()
RETURNS TRIGGER AS $$
DECLARE
  batch_key TEXT;
  updater_id UUID;
BEGIN
  -- Only trigger if family_notes changed
  IF OLD.family_notes IS DISTINCT FROM NEW.family_notes THEN
    -- Get the user who updated (may be NULL if not set yet)
    updater_id := NEW.family_notes_updated_by;
    
    batch_key := NEW.id::text || ':households:family_board:UPDATE:' || COALESCE(updater_id::text, 'unknown');
    
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
      NEW.id,
      'households',
      'UPDATE',
      NEW.id,
      jsonb_build_object('id', NEW.id, 'family_notes', NEW.family_notes, 'household_id', NEW.id),
      jsonb_build_object('id', OLD.id, 'family_notes', OLD.family_notes),
      updater_id,  -- Now we track who updated!
      'family_board',
      batch_key
    );
    
    -- FAST MODE: Immediately trigger batch processing
    PERFORM process_notification_batches();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- DONE!
-- Now run this migration, then update the frontend code.
-- ============================================================================

