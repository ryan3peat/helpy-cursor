-- ============================================================================
-- Migration: 024_notification_improvements
-- Description: Add UPDATE/DELETE triggers and Family Board notifications
-- 
-- This migration:
-- 1. Creates a new trigger function that handles INSERT/UPDATE/DELETE
-- 2. Adds UPDATE and DELETE triggers to todo_items, meals, expenses
-- 3. Adds trigger for Family Board (households.family_notes)
-- 
-- SAFE: This extends existing functionality without breaking INSERT triggers
--
-- HOW TO RUN:
-- 1. Go to Supabase Dashboard → SQL Editor
-- 2. Paste this entire script
-- 3. Click "Run"
-- ============================================================================


-- ============================================================================
-- STEP 1: Create new trigger function that handles all event types
-- ============================================================================
-- This function passes event type (INSERT/UPDATE/DELETE) and old_record to edge function

DO $$
DECLARE
  project_ref TEXT := 'rnnqusevbnxnxmhlajlr';
  anon_key TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJubnF1c2V2Ym54bnhtaGxhamxyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMzNTU0OTMsImV4cCI6MjA3ODkzMTQ5M30.5tkZ112xOdk5VqtuI0cluTWszvYGK7zpW8oDJWiTKLw';
  supabase_url TEXT;
BEGIN
  supabase_url := 'https://' || project_ref || '.supabase.co';
  
  -- Create new function that handles INSERT, UPDATE, DELETE
  EXECUTE format('
    CREATE OR REPLACE FUNCTION notify_household_on_change()
    RETURNS TRIGGER AS $func$
    DECLARE
      created_by_id UUID;
      payload JSONB;
      record_data JSONB;
      old_record_data JSONB;
    BEGIN
      -- Determine which record to use based on operation
      IF TG_OP = ''DELETE'' THEN
        record_data := row_to_json(OLD)::jsonb;
        old_record_data := NULL;
        created_by_id := OLD.created_by;
      ELSIF TG_OP = ''UPDATE'' THEN
        record_data := row_to_json(NEW)::jsonb;
        old_record_data := row_to_json(OLD)::jsonb;
        created_by_id := NEW.created_by;
      ELSE
        -- INSERT
        record_data := row_to_json(NEW)::jsonb;
        old_record_data := NULL;
        created_by_id := NEW.created_by;
      END IF;

      -- Build the payload
      payload := jsonb_build_object(
        ''table'', TG_TABLE_NAME,
        ''event'', TG_OP,
        ''record'', record_data,
        ''old_record'', old_record_data,
        ''household_id'', CASE 
          WHEN TG_OP = ''DELETE'' THEN OLD.household_id::text 
          ELSE NEW.household_id::text 
        END,
        ''created_by_user_id'', created_by_id::text
      );

      -- Make async HTTP request to edge function
      PERFORM net.http_post(
        url := %L || ''/functions/v1/send-notification'',
        headers := jsonb_build_object(
          ''Content-Type'', ''application/json'',
          ''Authorization'', ''Bearer '' || %L
        ),
        body := payload
      );

      -- Return appropriate record
      IF TG_OP = ''DELETE'' THEN
        RETURN OLD;
      ELSE
        RETURN NEW;
      END IF;
      
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING ''Failed to send notification: %%'', SQLERRM;
        IF TG_OP = ''DELETE'' THEN
          RETURN OLD;
        ELSE
          RETURN NEW;
        END IF;
    END;
    $func$ LANGUAGE plpgsql SECURITY DEFINER;
  ', supabase_url, anon_key);
  
  RAISE NOTICE '✅ notify_household_on_change function created';
END $$;


-- ============================================================================
-- STEP 2: Update existing INSERT triggers to use new function
-- ============================================================================

-- Drop old triggers
DROP TRIGGER IF EXISTS on_todo_item_insert_notify ON todo_items;
DROP TRIGGER IF EXISTS on_meal_insert_notify ON meals;
DROP TRIGGER IF EXISTS on_expense_insert_notify ON expenses;

-- Create new INSERT triggers using the new function
CREATE TRIGGER on_todo_item_insert_notify
AFTER INSERT ON todo_items
FOR EACH ROW
EXECUTE FUNCTION notify_household_on_change();

CREATE TRIGGER on_meal_insert_notify
AFTER INSERT ON meals
FOR EACH ROW
EXECUTE FUNCTION notify_household_on_change();

CREATE TRIGGER on_expense_insert_notify
AFTER INSERT ON expenses
FOR EACH ROW
EXECUTE FUNCTION notify_household_on_change();


-- ============================================================================
-- STEP 3: Add UPDATE triggers
-- ============================================================================

DROP TRIGGER IF EXISTS on_todo_item_update_notify ON todo_items;
DROP TRIGGER IF EXISTS on_meal_update_notify ON meals;
DROP TRIGGER IF EXISTS on_expense_update_notify ON expenses;

CREATE TRIGGER on_todo_item_update_notify
AFTER UPDATE ON todo_items
FOR EACH ROW
EXECUTE FUNCTION notify_household_on_change();

CREATE TRIGGER on_meal_update_notify
AFTER UPDATE ON meals
FOR EACH ROW
EXECUTE FUNCTION notify_household_on_change();

CREATE TRIGGER on_expense_update_notify
AFTER UPDATE ON expenses
FOR EACH ROW
EXECUTE FUNCTION notify_household_on_change();


-- ============================================================================
-- STEP 4: Add DELETE triggers
-- ============================================================================

DROP TRIGGER IF EXISTS on_todo_item_delete_notify ON todo_items;
DROP TRIGGER IF EXISTS on_meal_delete_notify ON meals;
DROP TRIGGER IF EXISTS on_expense_delete_notify ON expenses;

CREATE TRIGGER on_todo_item_delete_notify
AFTER DELETE ON todo_items
FOR EACH ROW
EXECUTE FUNCTION notify_household_on_change();

CREATE TRIGGER on_meal_delete_notify
AFTER DELETE ON meals
FOR EACH ROW
EXECUTE FUNCTION notify_household_on_change();

CREATE TRIGGER on_expense_delete_notify
AFTER DELETE ON expenses
FOR EACH ROW
EXECUTE FUNCTION notify_household_on_change();


-- ============================================================================
-- STEP 5: Add Family Board trigger (households table)
-- ============================================================================
-- This trigger ONLY fires when family_notes column changes

DROP TRIGGER IF EXISTS on_family_notes_update_notify ON households;

-- Create special function for Family Board that only triggers on family_notes change
CREATE OR REPLACE FUNCTION notify_family_board_on_change()
RETURNS TRIGGER AS $$
DECLARE
  project_ref TEXT := 'rnnqusevbnxnxmhlajlr';
  anon_key TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJubnF1c2V2Ym54bnhtaGxhamxyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMzNTU0OTMsImV4cCI6MjA3ODkzMTQ5M30.5tkZ112xOdk5VqtuI0cluTWszvYGK7zpW8oDJWiTKLw';
  supabase_url TEXT;
  payload JSONB;
BEGIN
  supabase_url := 'https://' || project_ref || '.supabase.co';
  
  -- Only trigger if family_notes actually changed
  IF OLD.family_notes IS DISTINCT FROM NEW.family_notes THEN
    -- Build payload
    payload := jsonb_build_object(
      'table', 'households',
      'event', 'UPDATE',
      'record', jsonb_build_object(
        'id', NEW.id,
        'family_notes', NEW.family_notes,
        'household_id', NEW.id  -- For households, id IS the household_id
      ),
      'old_record', jsonb_build_object(
        'id', OLD.id,
        'family_notes', OLD.family_notes
      ),
      'household_id', NEW.id::text,
      'created_by_user_id', NULL  -- Will need to be passed separately if tracking who edited
    );

    -- Make async HTTP request
    PERFORM net.http_post(
      url := supabase_url || '/functions/v1/send-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || anon_key
      ),
      body := payload
    );
    
    RAISE NOTICE '📌 Family Board notification triggered';
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to send Family Board notification: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on households table
CREATE TRIGGER on_family_notes_update_notify
AFTER UPDATE ON households
FOR EACH ROW
EXECUTE FUNCTION notify_family_board_on_change();


-- ============================================================================
-- VERIFICATION: Check all triggers exist
-- ============================================================================

SELECT 
  'Notification Triggers' as check_name,
  (SELECT COUNT(*) FROM pg_trigger WHERE tgname LIKE '%_notify') || ' trigger(s) active' as status;

-- List all notification triggers
SELECT 
  tgname as trigger_name,
  tgrelid::regclass as table_name,
  CASE 
    WHEN tgtype & 2 = 2 THEN 'BEFORE'
    WHEN tgtype & 64 = 64 THEN 'INSTEAD OF'
    ELSE 'AFTER'
  END as timing,
  CASE 
    WHEN tgtype & 4 = 4 THEN 'INSERT'
    WHEN tgtype & 8 = 8 THEN 'DELETE'
    WHEN tgtype & 16 = 16 THEN 'UPDATE'
    ELSE 'UNKNOWN'
  END as event
FROM pg_trigger
WHERE tgname LIKE '%_notify'
ORDER BY tgrelid::regclass::text, tgname;


-- ============================================================================
-- DONE!
-- 
-- New capabilities:
-- ✅ INSERT notifications (was working, still works)
-- ✅ UPDATE notifications (new - detects completed/bought)
-- ✅ DELETE notifications (new)
-- ✅ Family Board notifications (new - triggers on family_notes change)
-- ✅ Helper role excluded from others' expenses
-- ✅ New 3-line message format with emojis
--
-- IMPORTANT: After running this, deploy the updated edge function:
-- 1. cd to your project
-- 2. supabase functions deploy send-notification
-- ============================================================================

