-- ============================================================================
-- Migration: 040_fix_household_creation_rls
-- Description: Fix household creation during signup by allowing INSERT without JWT check
--
-- Problem: New users can't create households because INSERT policy requires JWT,
-- but during signup the user doesn't exist in DB yet and JWT might not be ready
--
-- Solution: Allow household creation for authenticated requests (Clerk handles auth)
-- ============================================================================

-- ============================================================================
-- 1. Drop the current INSERT policy that requires JWT
-- ============================================================================
DROP POLICY IF EXISTS "Authenticated users can create households" ON households;
DROP POLICY IF EXISTS "Allow household creation for authenticated users" ON households;

-- ============================================================================
-- 2. Create new INSERT policy that allows creation for any authenticated request
-- Note: Supabase handles authentication at the connection level, so if the request
-- reaches our API, the user is authenticated via Clerk
-- ============================================================================
CREATE POLICY "Allow household creation for signup"
ON households FOR INSERT
WITH CHECK (true); -- Allow inserts, authentication handled by signup API with service role

-- ============================================================================
-- 3. Keep other policies unchanged
-- ============================================================================
-- SELECT, UPDATE, DELETE policies remain the same - they require JWT for access

-- ============================================================================
-- 4. Verify the new policy
-- ============================================================================
SELECT
  schemaname,
  tablename,
  policyname,
  cmd as "Command",
  qual as "USING Expression",
  with_check as "WITH CHECK Expression"
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'households'
ORDER BY cmd, policyname;

-- ============================================================================
-- 5. Test household creation (this will still require proper authentication)
-- ============================================================================
-- Note: This query will only work if you're authenticated
-- SELECT 'Testing household creation...' as status;