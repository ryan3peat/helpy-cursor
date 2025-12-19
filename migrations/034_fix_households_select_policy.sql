-- ============================================================================
-- Migration: 034_fix_households_select_policy
-- Description: Fix households SELECT policy to handle cases where get_user_household_id() might be slow
-- 
-- The 406 errors suggest the policy check is failing. This makes it more robust.
-- ============================================================================

-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Users can view their household" ON households;

-- Create more robust SELECT policy
-- Allow users to view their household
-- This directly queries users table instead of using get_user_household_id() function
-- to avoid any potential performance or NULL issues
CREATE POLICY "Users can view their household"
ON households FOR SELECT
USING (
  -- Direct subquery - more efficient and reliable
  EXISTS (
    SELECT 1
    FROM users
    WHERE users.clerk_id = get_clerk_id()
    AND users.household_id = households.id
    AND users.household_id IS NOT NULL
  )
);

-- Also verify the function works correctly
-- Test that get_user_household_id() can be called
DO $$
DECLARE
  test_result UUID;
BEGIN
  -- This will return NULL if no JWT in session (expected in SQL Editor)
  test_result := get_user_household_id();
  RAISE NOTICE 'get_user_household_id() test: %', 
    CASE 
      WHEN test_result IS NULL THEN 'NULL (expected if no JWT in SQL Editor)'
      ELSE 'Returns: ' || test_result::text
    END;
END $$;





