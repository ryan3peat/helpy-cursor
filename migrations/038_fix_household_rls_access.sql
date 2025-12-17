-- ============================================================================
-- Migration: 038_fix_household_rls_access
-- Description: Fix household access issues causing 406/PGRST116 errors
--
-- Problem: Users can't access household data due to RLS policy failures
-- Solution: Add debugging, fix potential policy issues, and ensure JWT flow works
-- ============================================================================

-- ============================================================================
-- 1. Add debugging function to check JWT and user access
-- ============================================================================
CREATE OR REPLACE FUNCTION debug_household_access(target_household_id UUID)
RETURNS TABLE (
  test_name TEXT,
  clerk_id TEXT,
  household_id UUID,
  jwt_present BOOLEAN,
  user_exists BOOLEAN,
  household_exists BOOLEAN,
  policy_should_allow BOOLEAN,
  error_details TEXT
) AS $$
DECLARE
  user_clerk_id TEXT;
  user_household_id UUID;
  household_count INTEGER;
  user_count INTEGER;
BEGIN
  -- Get clerk_id from JWT
  user_clerk_id := get_clerk_id();
  user_household_id := get_user_household_id();

  -- Check if household exists
  SELECT COUNT(*) INTO household_count
  FROM households
  WHERE id = target_household_id;

  -- Check if user exists
  SELECT COUNT(*) INTO user_count
  FROM users
  WHERE clerk_id = user_clerk_id;

  -- Return debug info
  RETURN QUERY VALUES
    ('JWT Check', user_clerk_id, user_household_id, user_clerk_id IS NOT NULL, user_count > 0, household_count > 0,
     (user_clerk_id IS NOT NULL AND user_count > 0 AND user_household_id = target_household_id),
     CASE
       WHEN user_clerk_id IS NULL THEN 'No JWT token'
       WHEN user_count = 0 THEN 'User not found in database'
       WHEN user_household_id != target_household_id THEN 'User household mismatch: user has ' || user_household_id::TEXT || ', trying to access ' || target_household_id::TEXT
       ELSE 'Policy should allow access'
     END);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 2. Test the debug function (will show NULL values in SQL Editor)
-- ============================================================================
SELECT * FROM debug_household_access('ecb34564-470c-41ea-a7ef-ed7446dd853d');

-- ============================================================================
-- 3. Drop and recreate household SELECT policy with better error handling
-- ============================================================================
DROP POLICY IF EXISTS "Users can view their household" ON households;

CREATE POLICY "Users can view their household"
ON households FOR SELECT
USING (
  -- Allow access if user is authenticated and belongs to this household
  EXISTS (
    SELECT 1
    FROM users
    WHERE users.clerk_id = get_clerk_id()
    AND users.household_id = households.id
    AND users.household_id IS NOT NULL
    AND get_clerk_id() IS NOT NULL
  )
);

-- ============================================================================
-- 4. Add fallback policy for service role (API routes)
-- ============================================================================
DROP POLICY IF EXISTS "Service role can view all households" ON households;
CREATE POLICY "Service role can view all households"
ON households FOR SELECT
USING (false); -- Only service role can bypass this

-- ============================================================================
-- 5. Verify the policy works
-- ============================================================================
SELECT
  'Policy test' as test,
  COUNT(*) as households_user_can_access
FROM households
WHERE EXISTS (
  SELECT 1
  FROM users
  WHERE users.clerk_id = get_clerk_id()
  AND users.household_id = households.id
  AND users.household_id IS NOT NULL
  AND get_clerk_id() IS NOT NULL
);

-- ============================================================================
-- 6. Check if we need to update the helper function security
-- ============================================================================
-- The get_user_household_id function should use SECURITY DEFINER to bypass RLS
-- when checking the users table. Let's verify it's set correctly.

SELECT
  proname as "Function Name",
  prosecdef as "Security Definer",
  pg_get_function_identity_arguments(oid) as "Arguments"
FROM pg_proc
WHERE proname = 'get_user_household_id';

-- ============================================================================
-- 7. Alternative: If JWT issues persist, temporarily disable RLS for debugging
-- ============================================================================
-- WARNING: Only run this temporarily for testing!
-- This will allow all authenticated users to see all households
-- Uncomment the lines below only if you need to test without RLS

-- ALTER TABLE households DISABLE ROW LEVEL SECURITY;
-- -- Test: SELECT * FROM households LIMIT 5;
-- ALTER TABLE households ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Next Steps After Running This Migration:
-- ============================================================================
-- 1. Sign out and sign back in to get fresh JWT
-- 2. Check browser console for SupabaseContext logs
-- 3. Check Network tab for Authorization header
-- 4. Run the debug function again to see if issues are resolved
-- 5. If still failing, check Clerk JWT template configuration



