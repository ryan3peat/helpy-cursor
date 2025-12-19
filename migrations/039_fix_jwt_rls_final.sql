-- ============================================================================
-- Migration: 039_fix_jwt_rls_final
-- Description: Final fix for JWT/RLS household access issues
--
-- Based on diagnostic results, this addresses:
-- 1. JWT authentication issues
-- 2. RLS policy logic problems
-- 3. User-household relationship issues
-- ============================================================================

-- ============================================================================
-- 1. Fix INSERT policy (was showing as null, should use WITH CHECK)
-- ============================================================================
DROP POLICY IF EXISTS "Authenticated users can create households" ON households;

CREATE POLICY "Authenticated users can create households"
ON households FOR INSERT
WITH CHECK (get_clerk_id() IS NOT NULL);

-- ============================================================================
-- 2. Fix UPDATE policy to avoid circular dependency
-- ============================================================================
DROP POLICY IF EXISTS "Users can update their household" ON households;

CREATE POLICY "Users can update their household"
ON households FOR UPDATE
USING (
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
-- 3. Ensure helper function is robust
-- ============================================================================
CREATE OR REPLACE FUNCTION get_user_household_id()
RETURNS UUID AS $$
DECLARE
  user_clerk_id TEXT;
  result UUID;
BEGIN
  -- Get clerk_id from JWT
  user_clerk_id := get_clerk_id();

  -- If no clerk_id in JWT, return NULL
  IF user_clerk_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Query users table directly with SECURITY DEFINER to bypass RLS
  SELECT household_id INTO result
  FROM users
  WHERE clerk_id = user_clerk_id
  LIMIT 1;

  RETURN result;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================================================
-- 4. Add emergency bypass for testing (remove after fix)
-- ============================================================================
-- WARNING: This temporarily allows all authenticated users to read households
-- Only use this for testing, then remove it!

-- DROP POLICY IF EXISTS "Emergency bypass for testing" ON households;
-- CREATE POLICY "Emergency bypass for testing"
-- ON households FOR SELECT
-- USING (get_clerk_id() IS NOT NULL);

-- ============================================================================
-- 5. Verify policies after changes
-- ============================================================================
SELECT
  schemaname,
  tablename,
  policyname,
  cmd as "Command",
  CASE WHEN permissive = 'PERMISSIVE' THEN 'Yes' ELSE 'No' END as "Permissive",
  qual as "USING Expression",
  with_check as "WITH CHECK Expression"
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'households'
ORDER BY cmd, policyname;

-- ============================================================================
-- 6. Test the fix
-- ============================================================================
SELECT
  'Fix verification' as test,
  get_clerk_id() as jwt_clerk_id,
  get_user_household_id() as user_household,
  CASE WHEN get_clerk_id() IS NOT NULL THEN '✅ JWT working' ELSE '❌ No JWT' END as jwt_status,
  CASE WHEN get_user_household_id() = 'ecb34564-470c-41ea-a7ef-ed7446dd853d' THEN '✅ User owns household' ELSE '❌ Household mismatch' END as household_access;

-- ============================================================================
-- POST-MIGRATION STEPS:
-- ============================================================================
--
-- 1. Sign out and sign back in (refresh JWT)
-- 2. Check browser console for SupabaseContext logs
-- 3. Check Network tab for Authorization header
-- 4. Test the household access in your app
-- 5. If still failing, check diagnostic output again
-- 6. Remove emergency bypass policy if used
--
-- If issues persist after this migration, the problem is likely:
-- - JWT not being sent from frontend
-- - Clerk JWT template misconfigured
-- - User not properly created in database




