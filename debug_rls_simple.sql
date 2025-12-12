-- ============================================================================
-- Simple RLS Debug - One Query at a Time
-- Run each section separately in Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- STEP 1: Check JWT
-- ============================================================================
SELECT
  'STEP 1: JWT Check' as step,
  get_clerk_id() as clerk_id,
  CASE WHEN get_clerk_id() IS NULL THEN '❌ PROBLEM: No JWT token'
       ELSE '✅ OK: JWT present' END as status;

-- ============================================================================
-- STEP 2: Check if user exists
-- ============================================================================
SELECT
  'STEP 2: User Check' as step,
  COUNT(*) as user_count,
  CASE WHEN COUNT(*) = 0 THEN '❌ PROBLEM: User not in database'
       WHEN COUNT(*) = 1 THEN '✅ OK: User exists'
       ELSE '⚠️ WARNING: Multiple users with same clerk_id' END as status
FROM users
WHERE clerk_id = get_clerk_id();

-- ============================================================================
-- STEP 3: Check user details
-- ============================================================================
SELECT
  'STEP 3: User Details' as step,
  id,
  clerk_id,
  household_id,
  email
FROM users
WHERE clerk_id = get_clerk_id();

-- ============================================================================
-- STEP 4: Check household exists
-- ============================================================================
SELECT
  'STEP 4: Household Check' as step,
  COUNT(*) as household_count,
  CASE WHEN COUNT(*) = 0 THEN '❌ PROBLEM: Household not found'
       ELSE '✅ OK: Household exists' END as status
FROM households
WHERE id = 'ecb34564-470c-41ea-a7ef-ed7446dd853d';

-- ============================================================================
-- STEP 5: Test policy logic
-- ============================================================================
SELECT
  'STEP 5: Policy Test' as step,
  get_clerk_id() as your_clerk_id,
  get_clerk_id() IS NOT NULL as jwt_ok,
  EXISTS (
    SELECT 1 FROM users
    WHERE clerk_id = get_clerk_id()
    AND household_id = 'ecb34564-470c-41ea-a7ef-ed7446dd853d'
  ) as user_in_household,
  CASE
    WHEN get_clerk_id() IS NULL THEN '❌ BLOCKED: No JWT'
    WHEN NOT EXISTS (
      SELECT 1 FROM users
      WHERE clerk_id = get_clerk_id()
      AND household_id = 'ecb34564-470c-41ea-a7ef-ed7446dd853d'
    ) THEN '❌ BLOCKED: User not in household'
    ELSE '✅ ALLOWED: Should work'
  END as access_status;

-- ============================================================================
-- STEP 6: Check household members
-- ============================================================================
SELECT
  'STEP 6: Household Members' as step,
  u.id,
  u.clerk_id,
  u.email,
  CASE WHEN u.clerk_id = get_clerk_id() THEN '👤 YOU' ELSE '' END as is_you
FROM users u
WHERE u.household_id = 'ecb34564-470c-41ea-a7ef-ed7446dd853d';

-- ============================================================================
-- STEP 7: Test without RLS
-- ============================================================================
ALTER TABLE households DISABLE ROW LEVEL SECURITY;

SELECT
  'STEP 7: Without RLS' as step,
  h.id,
  h.subscription_plan,
  h.subscription_status,
  '✅ Data exists, RLS is blocking access' as explanation
FROM households h
WHERE h.id = 'ecb34564-470c-41ea-a7ef-ed7446dd853d';

ALTER TABLE households ENABLE ROW LEVEL SECURITY;