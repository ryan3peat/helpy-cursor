-- ============================================================================
-- Verification Script: Push Notifications System
-- Description: Comprehensive check of notification system setup
-- 
-- HOW TO RUN:
-- 1. Go to Supabase Dashboard
-- 2. Navigate to SQL Editor
-- 3. Paste this entire file
-- 4. Click "Run"
-- 
-- This script checks:
-- 1. Required extensions (pg_net)
-- 2. Database tables (push_subscriptions, notifications)
-- 3. Schema columns (created_by, notifications_enabled)
-- 4. Database triggers
-- 5. Trigger function configuration
-- 6. Sample data and statistics
-- ============================================================================

-- Create a temporary function to check and return results
CREATE OR REPLACE FUNCTION verify_notification_system()
RETURNS TABLE (
  category TEXT,
  check_name TEXT,
  status TEXT,
  message TEXT,
  priority TEXT
) AS $$
DECLARE
  pg_net_exists BOOLEAN;
  trigger_url TEXT;
BEGIN
  -- Check 1: pg_net Extension
  SELECT EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_net'
  ) INTO pg_net_exists;
  
  IF pg_net_exists THEN
    RETURN QUERY SELECT 'Extensions'::TEXT, 'pg_net'::TEXT, 'PASS'::TEXT, 'pg_net extension is enabled'::TEXT, 'INFO'::TEXT;
  ELSE
    RETURN QUERY SELECT 'Extensions'::TEXT, 'pg_net'::TEXT, 'FAIL'::TEXT, 'pg_net extension is missing. Enable it in Database > Extensions'::TEXT, 'CRITICAL'::TEXT;
  END IF;

  -- Check 2: push_subscriptions table
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'push_subscriptions') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'push_subscriptions' AND column_name = 'endpoint') THEN
      RETURN QUERY SELECT 'Tables'::TEXT, 'push_subscriptions'::TEXT, 'PASS'::TEXT, 'Table exists with required columns'::TEXT, 'INFO'::TEXT;
    ELSE
      RETURN QUERY SELECT 'Tables'::TEXT, 'push_subscriptions'::TEXT, 'FAIL'::TEXT, 'Table exists but missing required columns'::TEXT, 'CRITICAL'::TEXT;
    END IF;
  ELSE
    RETURN QUERY SELECT 'Tables'::TEXT, 'push_subscriptions'::TEXT, 'FAIL'::TEXT, 'Table does not exist. Run migration 007_push_notifications.sql'::TEXT, 'CRITICAL'::TEXT;
  END IF;

  -- Check 3: notifications table
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications') THEN
    RETURN QUERY SELECT 'Tables'::TEXT, 'notifications'::TEXT, 'PASS'::TEXT, 'Table exists'::TEXT, 'INFO'::TEXT;
  ELSE
    RETURN QUERY SELECT 'Tables'::TEXT, 'notifications'::TEXT, 'FAIL'::TEXT, 'Table does not exist. Run migration 007_push_notifications.sql'::TEXT, 'CRITICAL'::TEXT;
  END IF;

  -- Check 4: created_by columns
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'todo_items' AND column_name = 'created_by') THEN
    RETURN QUERY SELECT 'Columns'::TEXT, 'todo_items.created_by'::TEXT, 'PASS'::TEXT, 'Column exists'::TEXT, 'INFO'::TEXT;
  ELSE
    RETURN QUERY SELECT 'Columns'::TEXT, 'todo_items.created_by'::TEXT, 'FAIL'::TEXT, 'Column does not exist. Run migration 007_push_notifications.sql'::TEXT, 'CRITICAL'::TEXT;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'meals' AND column_name = 'created_by') THEN
    RETURN QUERY SELECT 'Columns'::TEXT, 'meals.created_by'::TEXT, 'PASS'::TEXT, 'Column exists'::TEXT, 'INFO'::TEXT;
  ELSE
    RETURN QUERY SELECT 'Columns'::TEXT, 'meals.created_by'::TEXT, 'FAIL'::TEXT, 'Column does not exist. Run migration 007_push_notifications.sql'::TEXT, 'CRITICAL'::TEXT;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'expenses' AND column_name = 'created_by') THEN
    RETURN QUERY SELECT 'Columns'::TEXT, 'expenses.created_by'::TEXT, 'PASS'::TEXT, 'Column exists'::TEXT, 'INFO'::TEXT;
  ELSE
    RETURN QUERY SELECT 'Columns'::TEXT, 'expenses.created_by'::TEXT, 'WARN'::TEXT, 'Column does not exist (may be intentional per code)'::TEXT, 'WARNING'::TEXT;
  END IF;

  -- Check 5: notifications_enabled column
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'users' AND column_name = 'notifications_enabled') THEN
    RETURN QUERY SELECT 'Columns'::TEXT, 'users.notifications_enabled'::TEXT, 'PASS'::TEXT, 'Column exists'::TEXT, 'INFO'::TEXT;
  ELSE
    RETURN QUERY SELECT 'Columns'::TEXT, 'users.notifications_enabled'::TEXT, 'FAIL'::TEXT, 'Column does not exist. Run migration 007_push_notifications.sql'::TEXT, 'CRITICAL'::TEXT;
  END IF;

  -- Check 6: Triggers
  IF EXISTS (SELECT 1 FROM pg_trigger 
             WHERE tgname = 'on_todo_item_insert_notify' 
             AND tgrelid = 'todo_items'::regclass) THEN
    RETURN QUERY SELECT 'Triggers'::TEXT, 'on_todo_item_insert_notify'::TEXT, 'PASS'::TEXT, 'Trigger exists on todo_items'::TEXT, 'INFO'::TEXT;
  ELSE
    RETURN QUERY SELECT 'Triggers'::TEXT, 'on_todo_item_insert_notify'::TEXT, 'FAIL'::TEXT, 'Trigger does not exist. Run migration 007_push_notifications.sql'::TEXT, 'CRITICAL'::TEXT;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_trigger 
             WHERE tgname = 'on_meal_insert_notify' 
             AND tgrelid = 'meals'::regclass) THEN
    RETURN QUERY SELECT 'Triggers'::TEXT, 'on_meal_insert_notify'::TEXT, 'PASS'::TEXT, 'Trigger exists on meals'::TEXT, 'INFO'::TEXT;
  ELSE
    RETURN QUERY SELECT 'Triggers'::TEXT, 'on_meal_insert_notify'::TEXT, 'FAIL'::TEXT, 'Trigger does not exist. Run migration 007_push_notifications.sql'::TEXT, 'CRITICAL'::TEXT;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_trigger 
             WHERE tgname = 'on_expense_insert_notify' 
             AND tgrelid = 'expenses'::regclass) THEN
    RETURN QUERY SELECT 'Triggers'::TEXT, 'on_expense_insert_notify'::TEXT, 'PASS'::TEXT, 'Trigger exists on expenses'::TEXT, 'INFO'::TEXT;
  ELSE
    RETURN QUERY SELECT 'Triggers'::TEXT, 'on_expense_insert_notify'::TEXT, 'FAIL'::TEXT, 'Trigger does not exist. Run migration 007_push_notifications.sql'::TEXT, 'CRITICAL'::TEXT;
  END IF;

  -- Check 7: Trigger function
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'notify_household_on_insert') THEN
    SELECT pg_get_functiondef(oid) INTO trigger_url
    FROM pg_proc 
    WHERE proname = 'notify_household_on_insert';
    
    IF trigger_url LIKE '%YOUR_PROJECT_REF%' THEN
      RETURN QUERY SELECT 'Function'::TEXT, 'notify_household_on_insert URL'::TEXT, 'FAIL'::TEXT, 'Trigger function still has placeholder URL (YOUR_PROJECT_REF). Update it with your actual Supabase project reference'::TEXT, 'CRITICAL'::TEXT;
    ELSIF trigger_url LIKE '%https://%.supabase.co%' THEN
      RETURN QUERY SELECT 'Function'::TEXT, 'notify_household_on_insert URL'::TEXT, 'PASS'::TEXT, 'Trigger function URL appears configured'::TEXT, 'INFO'::TEXT;
    ELSE
      RETURN QUERY SELECT 'Function'::TEXT, 'notify_household_on_insert URL'::TEXT, 'WARN'::TEXT, 'Could not verify trigger function URL. Check manually'::TEXT, 'WARNING'::TEXT;
    END IF;
  ELSE
    RETURN QUERY SELECT 'Function'::TEXT, 'notify_household_on_insert'::TEXT, 'FAIL'::TEXT, 'Function does not exist. Run migration 007_push_notifications.sql'::TEXT, 'CRITICAL'::TEXT;
  END IF;

  -- Statistics
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'push_subscriptions') THEN
    DECLARE
      sub_count INTEGER;
    BEGIN
      SELECT COUNT(*) INTO sub_count FROM push_subscriptions;
      IF sub_count = 0 THEN
        RETURN QUERY SELECT 'Statistics'::TEXT, 'Push Subscriptions'::TEXT, 'WARN'::TEXT, format('No push subscriptions found (%s total). Users need to enable notifications in the app', sub_count)::TEXT, 'WARNING'::TEXT;
      ELSE
        RETURN QUERY SELECT 'Statistics'::TEXT, 'Push Subscriptions'::TEXT, 'PASS'::TEXT, format('%s push subscription(s) found', sub_count)::TEXT, 'INFO'::TEXT;
      END IF;
    END;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications') THEN
    DECLARE
      notif_count INTEGER;
      unread_count INTEGER;
    BEGIN
      SELECT COUNT(*) INTO notif_count FROM notifications;
      SELECT COUNT(*) INTO unread_count FROM notifications WHERE read = false;
      RETURN QUERY SELECT 'Statistics'::TEXT, 'Notifications'::TEXT, 'PASS'::TEXT, format('%s total notifications (%s unread)', notif_count, unread_count)::TEXT, 'INFO'::TEXT;
    END;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'users' AND column_name = 'notifications_enabled') THEN
    DECLARE
      enabled_count INTEGER;
      total_users INTEGER;
    BEGIN
      SELECT COUNT(*) INTO enabled_count FROM users WHERE notifications_enabled = true;
      SELECT COUNT(*) INTO total_users FROM users;
      RETURN QUERY SELECT 'Statistics'::TEXT, 'Users with notifications'::TEXT, 'PASS'::TEXT, format('%s / %s users have notifications enabled', enabled_count, total_users)::TEXT, 'INFO'::TEXT;
    END;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'todo_items' AND column_name = 'created_by') THEN
    DECLARE
      todo_with_creator INTEGER;
      total_todos INTEGER;
    BEGIN
      SELECT COUNT(*) INTO todo_with_creator FROM todo_items WHERE created_by IS NOT NULL;
      SELECT COUNT(*) INTO total_todos FROM todo_items;
      IF total_todos > 0 AND todo_with_creator = 0 THEN
        RETURN QUERY SELECT 'Data Quality'::TEXT, 'todo_items.created_by'::TEXT, 'WARN'::TEXT, format('No todo items have created_by set (%s total). Check if frontend is passing createdBy field', total_todos)::TEXT, 'WARNING'::TEXT;
      ELSIF total_todos > 0 THEN
        RETURN QUERY SELECT 'Data Quality'::TEXT, 'todo_items.created_by'::TEXT, 'PASS'::TEXT, format('%s / %s todo items have created_by set', todo_with_creator, total_todos)::TEXT, 'INFO'::TEXT;
      ELSE
        RETURN QUERY SELECT 'Data Quality'::TEXT, 'todo_items.created_by'::TEXT, 'PASS'::TEXT, 'No todo items yet (cannot verify)'::TEXT, 'INFO'::TEXT;
      END IF;
    END;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'meals' AND column_name = 'created_by') THEN
    DECLARE
      meals_with_creator INTEGER;
      total_meals INTEGER;
    BEGIN
      SELECT COUNT(*) INTO meals_with_creator FROM meals WHERE created_by IS NOT NULL;
      SELECT COUNT(*) INTO total_meals FROM meals;
      IF total_meals > 0 AND meals_with_creator = 0 THEN
        RETURN QUERY SELECT 'Data Quality'::TEXT, 'meals.created_by'::TEXT, 'WARN'::TEXT, format('No meals have created_by set (%s total). Check if frontend is passing createdBy field', total_meals)::TEXT, 'WARNING'::TEXT;
      ELSIF total_meals > 0 THEN
        RETURN QUERY SELECT 'Data Quality'::TEXT, 'meals.created_by'::TEXT, 'PASS'::TEXT, format('%s / %s meals have created_by set', meals_with_creator, total_meals)::TEXT, 'INFO'::TEXT;
      ELSE
        RETURN QUERY SELECT 'Data Quality'::TEXT, 'meals.created_by'::TEXT, 'PASS'::TEXT, 'No meals yet (cannot verify)'::TEXT, 'INFO'::TEXT;
      END IF;
    END;
  END IF;

END;
$$ LANGUAGE plpgsql;

-- Run the verification and return results
SELECT * FROM verify_notification_system()
ORDER BY 
  CASE priority
    WHEN 'CRITICAL' THEN 1
    WHEN 'WARNING' THEN 2
    WHEN 'INFO' THEN 3
    ELSE 4
  END,
  category,
  check_name;

-- Clean up
DROP FUNCTION IF EXISTS verify_notification_system();
