-- ============================================================================
-- Find Your Supabase Project Reference
-- This script helps you find your Supabase URL from various sources
-- ============================================================================

-- Method 1: Check if there's a settings table or config
SELECT 'Checking for Supabase URL in database...' as info;

-- Method 2: Show you how to find it
SELECT 
  'How to find your Supabase Project Reference:' as instruction,
  '1. Check your .env file for VITE_SUPABASE_URL' as step1,
  '2. Or go to Supabase Dashboard and check the URL' as step2,
  '3. The URL format is: https://YOUR_PROJECT_REF.supabase.co' as step3,
  '4. Extract the part before .supabase.co' as step4;

-- Method 3: If you have access to current_setting, try to get it
-- (This usually won't work but worth trying)
SELECT 
  'Attempting to find URL from settings...' as method,
  current_setting('app.supabase_url', true) as supabase_url
WHERE current_setting('app.supabase_url', true) IS NOT NULL;

-- Method 4: Check your local .env file manually
-- The VITE_SUPABASE_URL should look like: https://xxxxx.supabase.co
-- Copy the 'xxxxx' part and use it in migration 010_fix_trigger_url.sql

SELECT 
  'Next Steps:' as instruction,
  '1. Open your .env file (or check Vercel environment variables for production)' as step1,
  '2. Find VITE_SUPABASE_URL' as step2,
  '3. Extract the project reference (the part before .supabase.co)' as step3,
  '4. Update migration 010_fix_trigger_url.sql with that value' as step4;
