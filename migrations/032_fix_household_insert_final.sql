-- ============================================================================
-- Migration: 032_fix_household_insert_final
-- Description: Ensure households and users can be created during sign-up
-- 
-- This fixes the remaining RLS policy violations for household/user creation
-- ============================================================================

-- ============================================================================
-- HOUSEHOLDS TABLE - Ensure INSERT policy allows authenticated users
-- ============================================================================
-- Drop any existing INSERT policies
DROP POLICY IF EXISTS "Service role can insert households" ON households;
DROP POLICY IF EXISTS "Authenticated users can create households" ON households;

-- Allow authenticated users to create households (for sign-up)
-- During sign-up, users don't have a household yet, so we allow any authenticated user
CREATE POLICY "Authenticated users can create households"
ON households FOR INSERT
WITH CHECK (
  get_clerk_id() IS NOT NULL  -- User must be authenticated (has clerk_id in JWT)
);

-- ============================================================================
-- USERS TABLE - Ensure INSERT policy allows authenticated users
-- ============================================================================
-- Drop any existing INSERT policies
DROP POLICY IF EXISTS "Service role can insert users" ON users;
DROP POLICY IF EXISTS "Authenticated users can create users" ON users;

-- Allow authenticated users to create user records (for sign-up and invites)
CREATE POLICY "Authenticated users can create users"
ON users FOR INSERT
WITH CHECK (
  get_clerk_id() IS NOT NULL  -- User must be authenticated
);

-- ============================================================================
-- Verification - Check current INSERT policies
-- ============================================================================
SELECT 
  tablename,
  policyname,
  cmd as "Command",
  with_check as "WITH CHECK Expression"
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('households', 'users')
  AND cmd = 'INSERT'
ORDER BY tablename, policyname;

-- Also verify RLS is enabled
SELECT 
  tablename,
  rowsecurity as "RLS Enabled"
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('households', 'users');
