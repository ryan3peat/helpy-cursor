-- ============================================================================
-- Fix Trigger Function Authentication
-- Description: Adds Authorization header to trigger function calls
-- 
-- Edge functions require authentication. This adds the anon key to the request.
-- 
-- HOW TO RUN:
-- 1. Get your Supabase anon key from Dashboard → Settings → API
-- 2. Replace 'YOUR_ANON_KEY' below with your actual anon key
-- 3. Run this script in Supabase SQL Editor
-- ============================================================================

DO $$
DECLARE
  project_ref TEXT := 'rnnqusevbnxnxmhlajlr';
  supabase_url TEXT;
  anon_key TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJubnF1c2V2Ym54bnhtaGxhamxyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMzNTU0OTMsImV4cCI6MjA3ODkzMTQ5M30.5tkZ112xOdk5VqtuI0cluTWszvYGK7zpW8oDJWiTKLw';  -- ⚠️ REPLACE WITH YOUR ACTUAL ANON KEY
BEGIN
  -- Build the full URL
  supabase_url := 'https://' || project_ref || '.supabase.co';
  
  -- Update the trigger function with Authorization header
  EXECUTE format('
    CREATE OR REPLACE FUNCTION notify_household_on_insert()
    RETURNS TRIGGER AS $func$
    DECLARE
      supabase_url TEXT;
      created_by_id UUID;
    BEGIN
      supabase_url := %L;
      
      -- Get who created this item
      created_by_id := NEW.created_by;

      -- Make async HTTP request to edge function using pg_net
      -- Add Authorization header with anon key for authentication
      PERFORM net.http_post(
        url := supabase_url || ''/functions/v1/send-notification'',
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
        RAISE WARNING ''Failed to send notification: %%'', SQLERRM;
        RETURN NEW;
    END;
    $func$ LANGUAGE plpgsql SECURITY DEFINER;
  ', supabase_url, anon_key);
  
  RAISE NOTICE 'Trigger function updated with Authorization header';
  RAISE NOTICE 'URL: %', supabase_url;
END $$;

-- Verify the update
SELECT 
  'Trigger Function Auth Check' as check_name,
  CASE 
    WHEN pg_get_functiondef((SELECT oid FROM pg_proc WHERE proname = 'notify_household_on_insert')) 
         LIKE '%Authorization%'
    THEN '✅ Authorization header added'
    WHEN pg_get_functiondef((SELECT oid FROM pg_proc WHERE proname = 'notify_household_on_insert')) 
         LIKE '%YOUR_ANON_KEY%'
    THEN '❌ Still has placeholder - Update anon_key variable and run again'
    ELSE '⚠️ Could not verify Authorization header'
  END as status;
