-- ============================================================================
-- Migration: 030_fix_household_user_insert_policies
-- Description: Allow authenticated users to create households and users during sign-up
-- 
-- IMPORTANT: This fixes the sign-up flow where new users need to create
-- their household and user record. The previous policies blocked this.
-- ============================================================================

-- ============================================================================
-- HOUSEHOLDS TABLE - Allow authenticated users to create households
-- ============================================================================
DROP POLICY IF EXISTS "Service role can insert households" ON households;

-- Allow authenticated users to create households (for sign-up)
-- During sign-up, users don't have a household yet, so we can't check household_id
-- Instead, we allow any authenticated user (with valid JWT) to create a household
CREATE POLICY "Authenticated users can create households"
ON households FOR INSERT
WITH CHECK (
  get_clerk_id() IS NOT NULL  -- User must be authenticated (has clerk_id in JWT)
);

-- Keep existing policies for SELECT and UPDATE
-- (DELETE remains service role only)

-- ============================================================================
-- USERS TABLE - Allow authenticated users to create users
-- ============================================================================
DROP POLICY IF EXISTS "Service role can insert users" ON users;

-- Allow authenticated users to create user records (for sign-up and invites)
-- For sign-up: User creates their own record
-- For invites: Admin creates pending user records
CREATE POLICY "Authenticated users can create users"
ON users FOR INSERT
WITH CHECK (
  get_clerk_id() IS NOT NULL  -- User must be authenticated
  -- Note: We don't restrict household_id here because:
  -- 1. During sign-up, user creates their own record in their new household
  -- 2. During invites, admin creates records for their household
  -- Application logic ensures users can only create records in their own household
);

-- Keep existing policies for SELECT, UPDATE, DELETE
-- (DELETE remains service role only)

-- ============================================================================
-- Verification
-- ============================================================================
-- Check policies are updated
SELECT 
  tablename,
  policyname,
  cmd as "Command"
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('households', 'users')
  AND cmd = 'INSERT'
ORDER BY tablename, policyname;
