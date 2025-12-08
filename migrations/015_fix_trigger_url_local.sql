-- ============================================================================
-- Fix Trigger Function URL for Local Development
-- Description: Updates the notify_household_on_insert function to use localhost
-- 
-- Use this when running Supabase locally (supabase start)
-- For production, use migration 010_fix_trigger_url.sql instead
-- ============================================================================

DO $$
DECLARE
  supabase_url TEXT := 'http://localhost:9999';  -- Local Supabase URL
  anon_key TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJubnF1c2V2Ym54bnhtaGxhamxyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMzNTU0OTMsImV4cCI6MjA3ODkzMTQ5M30.5tkZ112xOdk5VqtuI0cluTWszvYGK7zpW8oDJWiTKLw';  -- ⚠️ Get from: supabase status (or .env)
BEGIN
  -- Update the trigger function with localhost URL
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
  
  RAISE NOTICE 'Trigger function updated for LOCAL development';
  RAISE NOTICE 'URL: %', supabase_url;
END $$;

-- Verify the update
SELECT 
  'Trigger Function URL Check (Local)' as check_name,
  CASE 
    WHEN pg_get_functiondef((SELECT oid FROM pg_proc WHERE proname = 'notify_household_on_insert')) 
         LIKE '%localhost:9999%'
    THEN '✅ URL configured for local development'
    WHEN pg_get_functiondef((SELECT oid FROM pg_proc WHERE proname = 'notify_household_on_insert')) 
         LIKE '%YOUR_LOCAL_ANON_KEY%'
    THEN '❌ Still has placeholder - Update anon_key variable and run again'
    ELSE '⚠️ Could not verify URL'
  END as status;
