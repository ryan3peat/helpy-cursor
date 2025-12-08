-- ============================================================================
-- Check Edge Function Configuration
-- This script helps verify if the edge function is properly configured
-- Note: Some checks require Supabase Dashboard access
-- ============================================================================

-- This script provides SQL queries to check database-side configuration
-- For edge function deployment status, check Supabase Dashboard → Edge Functions

SELECT 
  'Edge Function Configuration Check' as check_type,
  'Note: Edge function deployment status must be checked in Dashboard' as info,
  'Go to: Supabase Dashboard → Edge Functions → send-notification' as location;

-- Check if trigger function can reach the edge function URL
SELECT 
  'Trigger Function URL' as check_name,
  CASE 
    WHEN pg_get_functiondef((SELECT oid FROM pg_proc WHERE proname = 'notify_household_on_insert')) 
         LIKE '%https://rnnqusevbnxnxmhlajlr.supabase.co%'
    THEN '✅ URL configured correctly'
    WHEN pg_get_functiondef((SELECT oid FROM pg_proc WHERE proname = 'notify_household_on_insert')) 
         LIKE '%YOUR_PROJECT_REF%'
    THEN '❌ Still has placeholder - Run migration 010_fix_trigger_url.sql'
    ELSE '⚠️ URL format unclear - Check manually'
  END as status;

-- Check recent trigger activity (if any items were created)
SELECT 
  'Recent Item Creation Activity' as check_name,
  COUNT(*) as total_items,
  COUNT(created_by) as items_with_creator,
  CASE 
    WHEN COUNT(*) > 0 AND COUNT(created_by) = 0 
    THEN '⚠️ Items created but created_by not set'
    WHEN COUNT(*) > 0 AND COUNT(created_by) > 0
    THEN '✅ Items have created_by set'
    ELSE 'ℹ️ No items yet'
  END as status
FROM todo_items
WHERE created_at > NOW() - INTERVAL '24 hours';

-- Check for notification records (indicates edge function was called)
SELECT 
  'Notification History' as check_name,
  COUNT(*) as total_notifications,
  COUNT(CASE WHEN read = false THEN 1 END) as unread,
  MAX(created_at) as last_notification,
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ Edge function has been called'
    ELSE 'ℹ️ No notifications yet (normal if no items created or no recipients)'
  END as status
FROM notifications;

-- Summary of what to check in Dashboard
SELECT 
  'Manual Checks Required' as check_type,
  '1. Edge Function Deployment: Dashboard → Edge Functions → send-notification exists' as check1,
  '2. Edge Function Secrets: Dashboard → Edge Functions → send-notification → Settings → Secrets' as check2,
  '3. Required Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT' as check3,
  '4. Edge Function Logs: Dashboard → Edge Functions → send-notification → Logs' as check4;
