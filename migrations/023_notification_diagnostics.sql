-- ============================================================================
-- NOTIFICATION DIAGNOSTICS
-- Run this to check why notifications might not be working for users
-- ============================================================================

-- Get your household_id first (replace 'Liko' with any user name)
WITH my_household AS (
  SELECT household_id FROM users WHERE name = 'Liko' LIMIT 1
)

-- Comprehensive user notification status
SELECT 
  u.name,
  u.role,
  
  -- Check 1: Is notification setting enabled?
  CASE WHEN u.notifications_enabled = true 
    THEN '✅ ON' 
    ELSE '❌ OFF' 
  END as "1. Setting",
  
  -- Check 2: Is role allowed? (Children are excluded)
  CASE WHEN u.role = 'Child' 
    THEN '❌ Child (excluded)' 
    ELSE '✅ ' || u.role 
  END as "2. Role",
  
  -- Check 3: Do they have a push subscription?
  CASE WHEN ps.id IS NOT NULL 
    THEN '✅ Yes' 
    ELSE '❌ No subscription' 
  END as "3. Has Subscription",
  
  -- Check 4: How old is their subscription? (stale = might be expired)
  CASE 
    WHEN ps.id IS NULL THEN '—'
    WHEN ps.updated_at > NOW() - INTERVAL '7 days' THEN '✅ Fresh'
    WHEN ps.updated_at > NOW() - INTERVAL '30 days' THEN '⚠️ ' || EXTRACT(DAY FROM NOW() - ps.updated_at)::int || ' days old'
    ELSE '❌ Stale (>30 days)'
  END as "4. Subscription Age",
  
  -- Check 5: What push service? (helps debug platform issues)
  CASE 
    WHEN ps.endpoint IS NULL THEN '—'
    WHEN ps.endpoint LIKE '%fcm.googleapis.com%' THEN '📱 Android/Chrome'
    WHEN ps.endpoint LIKE '%web.push.apple.com%' THEN '🍎 Apple/Safari'
    WHEN ps.endpoint LIKE '%mozilla.com%' THEN '🦊 Firefox'
    WHEN ps.endpoint LIKE '%windows.com%' THEN '🪟 Windows/Edge'
    ELSE '❓ Other'
  END as "5. Platform",
  
  -- Overall status
  CASE 
    WHEN u.role = 'Child' THEN '🚫 Excluded (Child)'
    WHEN u.notifications_enabled = false THEN '⚠️ Needs to enable in app'
    WHEN ps.id IS NULL THEN '⚠️ Needs to open app on device'
    WHEN ps.updated_at < NOW() - INTERVAL '30 days' THEN '⚠️ Subscription may be stale'
    ELSE '✅ Ready to receive!'
  END as "Status"

FROM users u
LEFT JOIN push_subscriptions ps ON ps.user_id = u.id
WHERE u.household_id = (SELECT household_id FROM my_household)
ORDER BY 
  CASE u.role 
    WHEN 'Admin' THEN 1 
    WHEN 'Spouse' THEN 2 
    WHEN 'Helper' THEN 3 
    WHEN 'Child' THEN 4 
    ELSE 5 
  END;


-- ============================================================================
-- ADDITIONAL CHECKS
-- ============================================================================

-- Check: Are triggers set up?
SELECT 
  '🔧 Database Triggers' as check_type,
  CASE 
    WHEN COUNT(*) = 3 THEN '✅ All 3 triggers exist'
    ELSE '❌ Missing triggers (' || COUNT(*) || '/3)'
  END as status
FROM pg_trigger 
WHERE tgname IN ('on_todo_item_insert_notify', 'on_meal_insert_notify', 'on_expense_insert_notify');

-- Check: Is pg_net enabled?
SELECT 
  '🌐 pg_net Extension' as check_type,
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') 
    THEN '✅ Enabled'
    ELSE '❌ Not enabled'
  END as status;

-- Check: How many subscriptions total in this household?
SELECT 
  '📱 Total Subscriptions' as check_type,
  COUNT(*)::text || ' device(s) registered' as status
FROM push_subscriptions ps
JOIN users u ON ps.user_id = u.id
WHERE u.household_id = (SELECT household_id FROM users WHERE name = 'Liko' LIMIT 1);

