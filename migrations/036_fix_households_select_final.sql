-- ============================================================================
-- Migration: 036_fix_households_select_final
-- Description: Final fix for households SELECT policy to handle 406 errors
-- 
-- The 406 errors suggest the policy evaluation is failing.
-- This version adds explicit NULL checks and uses a more robust subquery.
-- ============================================================================

-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Users can view their household" ON households;

-- Create robust SELECT policy with explicit NULL handling
-- This policy allows users to view their household by checking if their clerk_id
-- matches a user record that has this household_id
CREATE POLICY "Users can view their household"
ON households FOR SELECT
USING (
  -- First check if clerk_id is available (user is authenticated via JWT)
  get_clerk_id() IS NOT NULL
  AND
  -- Then check if this household belongs to the user
  EXISTS (
    SELECT 1
    FROM users
    WHERE users.clerk_id = get_clerk_id()
    AND users.household_id = households.id
    AND users.household_id IS NOT NULL
  )
);

-- Verify the policy was created correctly
SELECT 
  tablename,
  policyname,
  cmd as "Command",
  qual as "USING Expression"
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'households'
  AND cmd = 'SELECT';



