-- Debug JWT and household access
-- Run this while logged in to see what's happening

-- Check if JWT exists
SELECT
  'JWT Check' as test,
  get_clerk_id() as clerk_id,
  CASE WHEN get_clerk_id() IS NULL THEN '❌ NO JWT - This is the problem!'
       ELSE '✅ JWT present' END as status;

-- Check user with this clerk_id
SELECT
  'User Check' as test,
  COUNT(*) as user_count,
  CASE WHEN COUNT(*) = 0 THEN '❌ User not found in database'
       WHEN COUNT(*) = 1 THEN '✅ User exists'
       ELSE '⚠️ Multiple users' END as status
FROM users
WHERE clerk_id = get_clerk_id();

-- Show user details
SELECT
  'User Details' as test,
  id,
  clerk_id,
  household_id,
  name,
  email
FROM users
WHERE clerk_id = get_clerk_id();

-- Check if target household exists
SELECT
  'Household Exists' as test,
  COUNT(*) as count,
  CASE WHEN COUNT(*) = 0 THEN '❌ Household not found'
       ELSE '✅ Household exists' END as status
FROM households
WHERE id = 'ecb34564-470c-41ea-a7ef-ed7446dd853d';

-- Show household details
SELECT
  'Household Details' as test,
  id,
  subscription_plan,
  subscription_status
FROM households
WHERE id = 'ecb34564-470c-41ea-a7ef-ed7446dd853d';

-- Test the exact policy logic
SELECT
  'Policy Logic Test' as test,
  get_clerk_id() as jwt_clerk_id,
  get_clerk_id() IS NOT NULL as jwt_ok,
  EXISTS (
    SELECT 1 FROM users
    WHERE clerk_id = get_clerk_id()
    AND household_id = 'ecb34564-470c-41ea-a7ef-ed7446dd853d'
    AND household_id IS NOT NULL
  ) as user_can_access,
  CASE
    WHEN get_clerk_id() IS NULL THEN '❌ BLOCKED: No JWT token sent'
    WHEN NOT EXISTS (
      SELECT 1 FROM users
      WHERE clerk_id = get_clerk_id()
      AND household_id = 'ecb34564-470c-41ea-a7ef-ed7446dd853d'
      AND household_id IS NOT NULL
    ) THEN '❌ BLOCKED: User not in household or user missing'
    ELSE '✅ ALLOWED: Should work'
  END as access_result;
