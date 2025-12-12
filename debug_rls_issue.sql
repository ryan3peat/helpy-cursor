-- ============================================================================
-- Debug RLS Issue: Household access failing with 406/PGRST116 errors
-- ============================================================================

-- 1. Check current user and their household
SELECT
  'Current user check' as test,
  get_clerk_id() as clerk_id_from_jwt,
  get_user_household_id() as household_id_from_function;

-- 2. Check if household exists
SELECT
  'Household exists check' as test,
  id,
  subscription_plan,
  subscription_status,
  max_family_members,
  max_helpers
FROM households
WHERE id = 'ecb34564-470c-41ea-a7ef-ed7446dd853d';

-- 3. Check if user exists and has correct household_id
SELECT
  'User exists check' as test,
  id,
  clerk_id,
  household_id,
  email
FROM users
WHERE clerk_id = get_clerk_id();

-- 4. Test the exact policy logic
SELECT
  'Policy logic test' as test,
  get_clerk_id() IS NOT NULL as jwt_present,
  EXISTS (
    SELECT 1
    FROM users
    WHERE users.clerk_id = get_clerk_id()
    AND users.household_id = 'ecb34564-470c-41ea-a7ef-ed7446dd853d'
    AND users.household_id IS NOT NULL
  ) as user_can_access_household;

-- 5. Check RLS policies on households
SELECT
  policyname as "Policy Name",
  cmd as "Command",
  qual as "USING Expression"
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'households'
ORDER BY cmd, policyname;