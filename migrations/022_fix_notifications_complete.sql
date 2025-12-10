-- ============================================================================
-- COMPLETE NOTIFICATION FIX
-- Run this single script to fix all notification issues
-- 
-- This script:
-- 1. Enables pg_net extension (required for HTTP calls from triggers)
-- 2. Creates/updates the trigger function with correct URL and auth
-- 3. Ensures all table triggers exist
-- 4. Verifies everything is working
--
-- HOW TO RUN:
-- 1. Go to Supabase Dashboard → SQL Editor
-- 2. Paste this entire script
-- 3. Click "Run"
-- 4. Check the output at the bottom for status
-- ============================================================================


-- ============================================================================
-- STEP 1: Enable pg_net extension
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;


-- ============================================================================
-- STEP 2: Create/Update the trigger function
-- ============================================================================
DO $$
DECLARE
  -- Your Supabase project configuration
  project_ref TEXT := 'rnnqusevbnxnxmhlajlr';
  anon_key TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJubnF1c2V2Ym54bnhtaGxhamxyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMzNTU0OTMsImV4cCI6MjA3ODkzMTQ5M30.5tkZ112xOdk5VqtuI0cluTWszvYGK7zpW8oDJWiTKLw';
  supabase_url TEXT;
BEGIN
  supabase_url := 'https://' || project_ref || '.supabase.co';
  
  EXECUTE format('
    CREATE OR REPLACE FUNCTION notify_household_on_insert()
    RETURNS TRIGGER AS $func$
    DECLARE
      created_by_id UUID;
    BEGIN
      -- Get who created this item
      created_by_id := NEW.created_by;

      -- Make async HTTP request to edge function using pg_net
      PERFORM net.http_post(
        url := %L || ''/functions/v1/send-notification'',
        headers := jsonb_build_object(
          ''Content-Type'', ''application/json'',
          ''Authorization'', ''Bearer '' || %L
        ),
        body := jsonb_build_object(
          ''table'', TG_TABLE_NAME,
          ''record'', row_to_json(NEW),
          ''household_id'', NEW.household_id::text,
          ''created_by_user_id'', created_by_id::text
        )
      );

      RETURN NEW;
    EXCEPTION
      WHEN OTHERS THEN
        -- Log error but don''t fail the insert - notifications are non-critical
        RAISE WARNING ''Failed to send notification: %%'', SQLERRM;
        RETURN NEW;
    END;
    $func$ LANGUAGE plpgsql SECURITY DEFINER;
  ', supabase_url, anon_key);
  
  RAISE NOTICE '✅ Trigger function created/updated with URL: %', supabase_url;
END $$;


-- ============================================================================
-- STEP 3: Ensure all triggers exist
-- ============================================================================

-- Drop existing triggers (idempotent)
DROP TRIGGER IF EXISTS on_todo_item_insert_notify ON todo_items;
DROP TRIGGER IF EXISTS on_meal_insert_notify ON meals;
DROP TRIGGER IF EXISTS on_expense_insert_notify ON expenses;

-- Create triggers
CREATE TRIGGER on_todo_item_insert_notify
AFTER INSERT ON todo_items
FOR EACH ROW
EXECUTE FUNCTION notify_household_on_insert();

CREATE TRIGGER on_meal_insert_notify
AFTER INSERT ON meals
FOR EACH ROW
EXECUTE FUNCTION notify_household_on_insert();

CREATE TRIGGER on_expense_insert_notify
AFTER INSERT ON expenses
FOR EACH ROW
EXECUTE FUNCTION notify_household_on_insert();


-- ============================================================================
-- STEP 4: Ensure push_subscriptions table exists with correct structure
-- ============================================================================
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh_key TEXT NOT NULL,
  auth_key TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, endpoint)
);

-- Ensure indexes exist
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_household ON push_subscriptions(household_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id);

-- Ensure RLS is enabled with open policies (for authenticated users)
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow select on push_subscriptions" ON push_subscriptions;
DROP POLICY IF EXISTS "Allow insert on push_subscriptions" ON push_subscriptions;
DROP POLICY IF EXISTS "Allow update on push_subscriptions" ON push_subscriptions;
DROP POLICY IF EXISTS "Allow delete on push_subscriptions" ON push_subscriptions;

CREATE POLICY "Allow select on push_subscriptions" ON push_subscriptions FOR SELECT USING (true);
CREATE POLICY "Allow insert on push_subscriptions" ON push_subscriptions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update on push_subscriptions" ON push_subscriptions FOR UPDATE USING (true);
CREATE POLICY "Allow delete on push_subscriptions" ON push_subscriptions FOR DELETE USING (true);


-- ============================================================================
-- STEP 5: Ensure notifications_enabled column exists on users
-- ============================================================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS notifications_enabled BOOLEAN DEFAULT TRUE;


-- ============================================================================
-- STEP 6: Ensure created_by columns exist on all tables
-- ============================================================================
ALTER TABLE todo_items ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE meals ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;


-- ============================================================================
-- VERIFICATION: Run these queries to check everything
-- ============================================================================

-- Check 1: pg_net extension
SELECT 
  'pg_net Extension' as check_name,
  CASE WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net')
    THEN '✅ Enabled'
    ELSE '❌ NOT ENABLED - Enable it in Dashboard → Database → Extensions'
  END as status;

-- Check 2: Trigger function exists and has correct URL
SELECT 
  'Trigger Function' as check_name,
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'notify_household_on_insert')
    THEN CASE 
      WHEN pg_get_functiondef((SELECT oid FROM pg_proc WHERE proname = 'notify_household_on_insert')) 
           LIKE '%rnnqusevbnxnxmhlajlr.supabase.co%'
      THEN '✅ Exists with correct URL'
      ELSE '⚠️ Exists but URL might be wrong'
    END
    ELSE '❌ Function does not exist'
  END as status;

-- Check 3: Triggers exist on tables
SELECT 
  'Table Triggers' as check_name,
  CASE 
    WHEN (SELECT COUNT(*) FROM pg_trigger 
          WHERE tgname IN ('on_todo_item_insert_notify', 'on_meal_insert_notify', 'on_expense_insert_notify')) = 3
    THEN '✅ All 3 triggers exist'
    ELSE '⚠️ Some triggers missing'
  END as status;

-- Check 4: push_subscriptions table
SELECT 
  'Push Subscriptions Table' as check_name,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'push_subscriptions')
    THEN '✅ Table exists'
    ELSE '❌ Table does not exist'
  END as status;

-- Check 5: notifications_enabled column
SELECT 
  'notifications_enabled Column' as check_name,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'notifications_enabled'
  )
    THEN '✅ Column exists'
    ELSE '❌ Column does not exist'
  END as status;

-- Check 6: Count of subscriptions
SELECT 
  'Push Subscriptions Count' as check_name,
  (SELECT COUNT(*)::text FROM push_subscriptions) || ' subscription(s) saved' as status;

-- Check 7: Users with notifications enabled
SELECT 
  'Users with Notifications ON' as check_name,
  (SELECT COUNT(*)::text FROM users WHERE notifications_enabled = true) || ' user(s)' as status;


-- ============================================================================
-- DONE! 
-- 
-- Next steps if notifications still don't work:
-- 1. Check Supabase Dashboard → Edge Functions → Logs
-- 2. Verify VAPID keys are set in Edge Function secrets
-- 3. Make sure the Edge Function is deployed
-- ============================================================================

