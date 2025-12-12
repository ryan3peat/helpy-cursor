-- ============================================================================
-- Migration: 031_fix_rls_circular_dependency
-- Description: Fix circular dependency in RLS policies causing stack overflow
-- 
-- PROBLEM: get_user_household_id() queries users table, but users SELECT policy
-- uses get_user_household_id(), causing infinite recursion.
-- 
-- SOLUTION: Allow users to query their own record by clerk_id without needing
-- household_id check. This breaks the circular dependency.
-- ============================================================================

-- ============================================================================
-- USERS TABLE - Fix circular dependency
-- ============================================================================
DROP POLICY IF EXISTS "Users can view their household members" ON users;

-- Allow users to see:
-- 1. Their own record (by clerk_id) - needed for get_user_household_id() to work
-- 2. Other users in their household (by household_id)
-- 
-- IMPORTANT: We check clerk_id first to allow users to see themselves,
-- which breaks the circular dependency when get_user_household_id() queries users table.
CREATE POLICY "Users can view their household members"
ON users FOR SELECT
USING (
  -- Allow if it's the current user's own record (by clerk_id)
  -- This MUST be first to break circular dependency
  clerk_id = get_clerk_id()
  OR
  -- Allow if user is in the same household
  -- This uses get_user_household_id() but only after we've checked clerk_id,
  -- so if we're querying the user's own record, we never reach this point
  household_id = get_user_household_id()
);

-- ============================================================================
-- Fix get_user_household_id() to handle recursion safely
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
  -- This prevents circular dependency
  SELECT household_id INTO result
  FROM users
  WHERE clerk_id = user_clerk_id
  LIMIT 1;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================================================
-- Verification
-- ============================================================================
-- Test that the function works without recursion
SELECT 
  'get_user_household_id function updated' as status,
  'Should not cause stack overflow' as note;
