-- ============================================================================
-- Migration: 042_fix_rls_and_verify_user
-- Description: Fix RLS policies and verify user exists in database
-- 
-- This addresses the 406 errors even though JWT is being sent correctly
-- ============================================================================

-- ============================================================================
-- PART 1: Check if user exists in database
-- ============================================================================
-- Replace 'user_36Ld8EjKmnxbbRGarGSspohmQhw' with your actual clerk_id
SELECT 
  'User Check' as check_type,
  id,
  clerk_id,
  email,
  name,
  household_id,
  status,
  role
FROM users
WHERE clerk_id = 'user_36Ld8EjKmnxbbRGarGSspohmQhw';

-- If this returns 0 rows, the user doesn't exist in the database!
-- You'll need to sign up again or manually insert the user

-- ============================================================================
-- PART 2: Drop ALL existing SELECT policies on households
-- ============================================================================
DROP POLICY IF EXISTS "Users can view their household" ON households;
DROP POLICY IF EXISTS "Household members can view their household" ON households;
DROP POLICY IF EXISTS "DEBUG_ALLOW_ALL_READS" ON households;

-- ============================================================================
-- PART 3: Create a single, correct SELECT policy
-- ============================================================================
-- This policy checks if the user (identified by clerk_id from JWT) 
-- is a member of the household
CREATE POLICY "Users can view their household"
ON households FOR SELECT
USING (
  -- User must have a valid JWT with clerk_id
  get_clerk_id() IS NOT NULL
  AND
  -- User must be a member of this household
  EXISTS (
    SELECT 1 
    FROM users 
    WHERE users.clerk_id = get_clerk_id()
      AND users.household_id = households.id
      AND users.status = 'active'
  )
);

-- ============================================================================
-- PART 4: Verify the policy was created
-- ============================================================================
SELECT
  policyname,
  cmd as command,
  permissive,
  qual as "USING expression"
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'households'
  AND cmd = 'SELECT'
ORDER BY policyname;

-- ============================================================================
-- PART 5: Test the get_clerk_id() function (run this from your app, not SQL Editor)
-- ============================================================================
-- Note: This will return NULL in SQL Editor because SQL Editor uses service role
-- You need to test this from your browser app where JWT is sent

-- ============================================================================
-- PART 6: If user doesn't exist, you may need to create them
-- ============================================================================
-- WARNING: Only run this if the user check in PART 1 returned 0 rows
-- AND you know the user's email and household_id

-- Example (DO NOT RUN unless you're sure):
-- INSERT INTO users (clerk_id, email, name, household_id, status, role)
-- VALUES (
--   'user_36Ld8EjKmnxbbRGarGSspohmQhw',
--   'your-email@example.com',
--   'Your Name',
--   'ecb34564-470c-41ea-a7ef-ed7446dd853d',  -- Your household ID
--   'active',
--   'admin'
-- );

-- ============================================================================
-- PART 7: Emergency bypass for testing (UNCOMMENT ONLY IF NEEDED)
-- ============================================================================
-- WARNING: This allows any authenticated user to read any household
-- Only use for debugging, then remove immediately!

-- DROP POLICY IF EXISTS "DEBUG_ALLOW_ALL_READS" ON households;
-- CREATE POLICY "DEBUG_ALLOW_ALL_READS"
-- ON households FOR SELECT
-- USING (get_clerk_id() IS NOT NULL);

-- To remove the debug policy:
-- DROP POLICY IF EXISTS "DEBUG_ALLOW_ALL_READS" ON households;

-- ============================================================================
-- NOTES
-- ============================================================================
-- 
-- After running this migration:
-- 1. Refresh your app
-- 2. Check Network tab - verify Authorization header is present
-- 3. If still getting 406 errors:
--    a. Check if user exists in database (PART 1)
--    b. Check if user's household_id matches the household you're querying
--    c. Check if user's status is 'active'
--
-- ============================================================================
