-- ============================================================================
-- Migration: 044_allow_pending_users_household_access
-- Description: Fix RLS to allow invited (pending) users to access household data
--
-- Problem: Invited users clicking on invite link get 406 error because the
-- current RLS policy only allows 'active' users to view household data.
-- But invited users have status='pending' until they complete signup.
-- ============================================================================

-- ============================================================================
-- 1. Drop existing SELECT policy on households
-- ============================================================================
DROP POLICY IF EXISTS "Users can view their household" ON households;
DROP POLICY IF EXISTS "Household members can view their household" ON households;
DROP POLICY IF EXISTS "DEBUG_ALLOW_ALL_READS" ON households;

-- ============================================================================
-- 2. Create new SELECT policy that allows both active AND pending users
-- ============================================================================
-- Pending users are those who have been invited but haven't completed signup yet.
-- They need to be able to view the household to complete the onboarding flow.

CREATE POLICY "Users can view their household"
ON households FOR SELECT
USING (
  -- User must have a valid JWT with clerk_id
  get_clerk_id() IS NOT NULL
  AND
  -- User must be a member of this household (active or pending)
  EXISTS (
    SELECT 1 
    FROM users 
    WHERE users.clerk_id = get_clerk_id()
      AND users.household_id = households.id
      AND users.status IN ('active', 'pending')
  )
);

-- ============================================================================
-- 3. Verify the policy was created correctly
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
-- 4. Also fix users table SELECT policy to allow viewing pending users
-- ============================================================================
-- This ensures household members can see pending (invited) users in the family list

DROP POLICY IF EXISTS "Users can view users in same household" ON users;
DROP POLICY IF EXISTS "Household members can view their household users" ON users;

CREATE POLICY "Users can view users in same household"
ON users FOR SELECT
USING (
  get_clerk_id() IS NOT NULL
  AND
  (
    -- User can see themselves
    clerk_id = get_clerk_id()
    OR
    -- User can see other household members (including pending)
    household_id IN (
      SELECT u.household_id 
      FROM users u 
      WHERE u.clerk_id = get_clerk_id()
        AND u.status IN ('active', 'pending')
    )
  )
);

-- ============================================================================
-- 5. Verify users table policy
-- ============================================================================
SELECT
  policyname,
  cmd as command,
  permissive,
  qual as "USING expression"
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'users'
  AND cmd = 'SELECT'
ORDER BY policyname;

-- ============================================================================
-- NOTES
-- ============================================================================
-- 
-- After running this migration:
-- 1. Invited users should be able to click invite links without 406 errors
-- 2. They can view the household data while completing signup
-- 3. Once they complete signup via accept-invite API, status changes to 'active'
--
-- The accept-invite flow:
-- 1. User clicks invite link -> status is 'pending', no clerk_id yet
-- 2. User signs up with Clerk -> Clerk assigns clerk_id
-- 3. accept-invite API is called -> sets clerk_id and status='active'
-- 4. User can now fully access the app
--
-- ============================================================================


