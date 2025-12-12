-- ============================================================================
-- Debug JWT and RLS Issues - Specific Analysis
-- Run this in Supabase Dashboard > SQL Editor
-- ============================================================================

-- ============================================================================
-- 1. Check JWT extraction and user lookup
-- ============================================================================
SELECT
  'JWT Analysis' as test,
  get_clerk_id() as clerk_id_from_jwt,
  CASE WHEN get_clerk_id() IS NULL THEN '❌ NO JWT TOKEN' ELSE '✅ JWT present' END as jwt_status,
  get_user_household_id() as household_from_function;

-- ============================================================================
-- 2. Check if user exists with this clerk_id
-- ============================================================================
SELECT
  'User Lookup' as test,
  COUNT(*) as user_count,
  CASE WHEN COUNT(*) = 0 THEN '❌ User not found in database'
       ELSE '✅ User exists' END as user_status
FROM users
WHERE clerk_id = get_clerk_id();

-- ============================================================================
-- 3. Show user details if they exist
-- ============================================================================
SELECT
  'User Details' as test,
  id,
  clerk_id,
  household_id,
  email,
  created_at
FROM users
WHERE clerk_id = get_clerk_id();

-- ============================================================================
-- 4. Check if target household exists
-- ============================================================================
SELECT
  'Household Check' as test,
  id,
  subscription_plan,
  subscription_status,
  max_family_members,
  max_helpers,
  CASE WHEN id IS NULL THEN '❌ Household not found'
       ELSE '✅ Household exists' END as household_status
FROM households
WHERE id = 'ecb34564-470c-41ea-a7ef-ed7446dd853d'

UNION ALL

SELECT
  'Household Check' as test,
  NULL as id,
  NULL as subscription_plan,
  NULL as subscription_status,
  NULL as max_family_members,
  NULL as max_helpers,
  '❌ Household not found' as household_status
WHERE NOT EXISTS (
  SELECT 1 FROM households
  WHERE id = 'ecb34564-470c-41ea-a7ef-ed7446dd853d'
);

-- ============================================================================
-- 5. Test the exact policy logic for the failing household
-- ============================================================================
SELECT
  'Policy Logic Test' as test,
  get_clerk_id() as jwt_clerk_id,
  get_clerk_id() IS NOT NULL as jwt_present,
  EXISTS (
    SELECT 1
    FROM users
    WHERE users.clerk_id = get_clerk_id()
    AND users.household_id = 'ecb34564-470c-41ea-a7ef-ed7446dd853d'
    AND users.household_id IS NOT NULL
  ) as user_can_access_household,
  CASE
    WHEN get_clerk_id() IS NULL THEN '❌ BLOCKED: No JWT token'
    WHEN NOT EXISTS (
      SELECT 1 FROM users
      WHERE users.clerk_id = get_clerk_id()
      AND users.household_id = 'ecb34564-470c-41ea-a7ef-ed7446dd853d'
      AND users.household_id IS NOT NULL
    ) THEN '❌ BLOCKED: User not in household or user missing'
    ELSE '✅ ALLOWED: Access granted'
  END as policy_result;

-- ============================================================================
-- 6. Show all users in the target household (for debugging)
-- ============================================================================
SELECT
  'Household Members' as test,
  u.id,
  u.clerk_id,
  u.email,
  u.household_id,
  CASE WHEN u.clerk_id = get_clerk_id() THEN '👤 THIS IS YOU' ELSE '' END as is_current_user
FROM users u
WHERE u.household_id = 'ecb34564-470c-41ea-a7ef-ed7446dd853d';

-- ============================================================================
-- 7. Test if the query would work without RLS (for comparison)
-- ============================================================================
-- Temporarily disable RLS to test if data exists
ALTER TABLE households DISABLE ROW LEVEL SECURITY;

SELECT
  'Without RLS' as test,
  COUNT(*) as households_found,
  'If this returns 1, data exists but RLS blocks it' as explanation
FROM households
WHERE id = 'ecb34564-470c-41ea-a7ef-ed7446dd853d';

-- Re-enable RLS
ALTER TABLE households ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- DIAGNOSIS SUMMARY
-- ============================================================================
-- Based on the results above, the issue is likely one of:
--
-- 1. ❌ JWT not sent (406 error) - Check Network tab for Authorization header
-- 2. ❌ JWT missing clerk_id claim - Check Clerk JWT template
-- 3. ❌ User not in users table - User needs to be created/imported
-- 4. ❌ User's household_id mismatch - User belongs to different household
-- 5. ❌ Household doesn't exist - Check if household was deleted
--
-- Next steps: Check browser Network tab, then run the fix migration