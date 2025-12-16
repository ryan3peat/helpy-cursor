-- ============================================================================
-- Migration: 049_fix_push_subscriptions_rls_complete
-- Description: Fix ALL push_subscriptions RLS policies to restore functionality
-- 
-- PROBLEM:
-- Migration 027 created restrictive INSERT/UPDATE/DELETE policies that require
-- clerk_id matching. Migration 048 only fixed the SELECT policy, leaving
-- INSERT/UPDATE/DELETE broken. This caused:
-- 1. Push notifications to stop working (can't save subscriptions)
-- 2. Notification toggles in Settings to fail silently
-- 
-- SOLUTION:
-- Restore permissive INSERT/UPDATE/DELETE policies while keeping the
-- household-level SELECT policy from migration 048.
-- 
-- Users should be able to:
-- - View all push subscriptions in their household (for status indicators)
-- - Insert/update/delete their own subscriptions
-- ============================================================================

-- ============================================================================
-- STEP 1: Drop ALL existing push_subscriptions policies
-- ============================================================================
DROP POLICY IF EXISTS "Users can view push subscriptions in their household" ON push_subscriptions;
DROP POLICY IF EXISTS "Users can manage their own push subscriptions" ON push_subscriptions;
DROP POLICY IF EXISTS "Users can insert their own push subscriptions" ON push_subscriptions;
DROP POLICY IF EXISTS "Users can update their own push subscriptions" ON push_subscriptions;
DROP POLICY IF EXISTS "Users can delete their own push subscriptions" ON push_subscriptions;
DROP POLICY IF EXISTS "Allow select on push_subscriptions" ON push_subscriptions;
DROP POLICY IF EXISTS "Allow insert on push_subscriptions" ON push_subscriptions;
DROP POLICY IF EXISTS "Allow update on push_subscriptions" ON push_subscriptions;
DROP POLICY IF EXISTS "Allow delete on push_subscriptions" ON push_subscriptions;


-- ============================================================================
-- STEP 2: Create new policies that balance security and functionality
-- ============================================================================

-- SELECT: Allow viewing all subscriptions in household (for status indicators)
-- This uses the safer household-level check via clerk_id
CREATE POLICY "push_subs_select_household"
ON push_subscriptions FOR SELECT
USING (
  household_id IN (
    SELECT household_id FROM users 
    WHERE clerk_id = get_clerk_id()
  )
  OR 
  -- Fallback: allow if no JWT (for service role access)
  get_clerk_id() IS NULL
);

-- INSERT: Allow inserting subscriptions for own user_id or with service role
-- The user_id must match the authenticated user's UUID
CREATE POLICY "push_subs_insert_own"
ON push_subscriptions FOR INSERT
WITH CHECK (
  user_id IN (
    SELECT id FROM users 
    WHERE clerk_id = get_clerk_id()
  )
  OR
  -- Fallback: allow if no JWT (for API route with service role)
  get_clerk_id() IS NULL
);

-- UPDATE: Allow updating own subscriptions or with service role
CREATE POLICY "push_subs_update_own"
ON push_subscriptions FOR UPDATE
USING (
  user_id IN (
    SELECT id FROM users 
    WHERE clerk_id = get_clerk_id()
  )
  OR
  get_clerk_id() IS NULL
);

-- DELETE: Allow deleting own subscriptions or with service role
CREATE POLICY "push_subs_delete_own"
ON push_subscriptions FOR DELETE
USING (
  user_id IN (
    SELECT id FROM users 
    WHERE clerk_id = get_clerk_id()
  )
  OR
  get_clerk_id() IS NULL
);


-- ============================================================================
-- STEP 3: Verify policies were created correctly
-- ============================================================================
SELECT 
  policyname as "Policy Name",
  cmd as "Command",
  CASE 
    WHEN qual IS NOT NULL THEN 'USING: ' || LEFT(qual::text, 50) || '...'
    ELSE NULL 
  END as "USING Expression",
  CASE 
    WHEN with_check IS NOT NULL THEN 'CHECK: ' || LEFT(with_check::text, 50) || '...'
    ELSE NULL 
  END as "WITH CHECK Expression"
FROM pg_policies 
WHERE tablename = 'push_subscriptions'
ORDER BY 
  CASE cmd 
    WHEN 'SELECT' THEN 1 
    WHEN 'INSERT' THEN 2 
    WHEN 'UPDATE' THEN 3 
    WHEN 'DELETE' THEN 4 
  END;


-- ============================================================================
-- STEP 4: Quick sanity check - count existing subscriptions
-- ============================================================================
SELECT 
  '📊 Push Subscriptions Status' as check_name,
  (SELECT COUNT(*)::text FROM push_subscriptions) || ' total subscriptions' as total,
  (SELECT COUNT(DISTINCT user_id)::text FROM push_subscriptions) || ' unique users' as unique_users,
  (SELECT COUNT(DISTINCT household_id)::text FROM push_subscriptions) || ' households' as households;


-- ============================================================================
-- DONE!
-- 
-- After running this migration:
-- 1. Users should be able to toggle notifications ON/OFF in Settings
-- 2. Push subscriptions should save correctly to the database
-- 3. Push notifications should resume working
-- 
-- To test:
-- 1. Go to Profile > Account > Settings
-- 2. Toggle "Enable Notifications" OFF then ON
-- 3. Check browser console for "[Push] ✅ Subscription saved to database successfully"
-- 4. Add a todo item - other household members should receive notifications
-- ============================================================================
