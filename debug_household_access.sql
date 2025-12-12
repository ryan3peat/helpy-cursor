-- Debug household access issue
SELECT
  'Current user check' as test,
  get_clerk_id() as clerk_id_from_jwt,
  CASE WHEN get_clerk_id() IS NULL THEN '❌ No JWT' ELSE '✅ JWT present' END as jwt_status;

-- Check if user exists with this clerk_id
SELECT
  'User lookup' as test,
  COUNT(*) as user_count,
  CASE WHEN COUNT(*) = 0 THEN '❌ User not found'
       ELSE '✅ User exists' END as status
FROM users
WHERE clerk_id = get_clerk_id();

-- Get user details
SELECT
  'User details' as test,
  id,
  clerk_id,
  household_id,
  name,
  email
FROM users
WHERE clerk_id = get_clerk_id();

-- Check if target household exists
SELECT
  'Household check' as test,
  id,
  subscription_plan,
  subscription_status
FROM households
WHERE id = 'ecb34564-470c-41ea-a7ef-ed7446dd853d';

-- Test the RLS policy logic manually
SELECT
  'Policy test' as test,
  get_clerk_id() as jwt_clerk_id,
  get_clerk_id() IS NOT NULL as jwt_present,
  EXISTS (
    SELECT 1 FROM users
    WHERE clerk_id = get_clerk_id()
    AND household_id = 'ecb34564-470c-41ea-a7ef-ed7446dd853d'
  ) as user_can_access,
  CASE
    WHEN get_clerk_id() IS NULL THEN '❌ BLOCKED: No JWT'
    WHEN NOT EXISTS (
      SELECT 1 FROM users
      WHERE clerk_id = get_clerk_id()
      AND household_id = 'ecb34564-470c-41ea-a7ef-ed7446dd853d'
    ) THEN '❌ BLOCKED: User not in household'
    ELSE '✅ ALLOWED'
  END as access_status;