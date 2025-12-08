-- ============================================================================
-- Fix Trigger Function URL
-- Description: Updates the notify_household_on_insert function with your actual Supabase URL
-- 
-- INSTRUCTIONS:
-- 1. Find your Supabase project reference:
--    - Go to your Supabase Dashboard
--    - Look at the URL: https://supabase.com/dashboard/project/YOUR_PROJECT_REF
--    - OR check your .env file for VITE_SUPABASE_URL (it will be like https://xxxxx.supabase.co)
-- 2. Replace 'YOUR_PROJECT_REF' below with your actual project reference
-- 3. Run this script in Supabase SQL Editor
-- ============================================================================

-- IMPORTANT: Replace 'YOUR_PROJECT_REF' with your actual Supabase project reference
-- Example: If your URL is https://abcdefghijklmnop.supabase.co, then use 'abcdefghijklmnop'
DO $$
DECLARE
  project_ref TEXT := 'rnnqusevbnxnxmhlajlr';  -- Your Supabase project reference
  supabase_url TEXT;
BEGIN
  -- Build the full URL
  supabase_url := 'https://' || project_ref || '.supabase.co';
  
  -- Update the trigger function
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
      PERFORM net.http_post(
        url := supabase_url || ''/functions/v1/send-notification'',
        headers := jsonb_build_object(
          ''Content-Type'', ''application/json''
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
  ', supabase_url);
  
  RAISE NOTICE 'Trigger function updated with URL: %', supabase_url;
END $$;

-- Verify the update
SELECT 
  'Trigger Function URL Check' as check_name,
  CASE 
    WHEN pg_get_functiondef((SELECT oid FROM pg_proc WHERE proname = 'notify_household_on_insert')) LIKE '%YOUR_PROJECT_REF%'
    THEN '❌ Still has placeholder - Update project_ref variable above and run again'
    WHEN pg_get_functiondef((SELECT oid FROM pg_proc WHERE proname = 'notify_household_on_insert')) LIKE '%https://%.supabase.co%'
    THEN '✅ URL appears to be configured'
    ELSE '⚠️ Could not verify URL'
  END as status;
