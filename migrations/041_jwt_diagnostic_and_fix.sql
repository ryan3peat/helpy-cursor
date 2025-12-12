-- ============================================================================
-- Migration: 041_jwt_diagnostic_and_fix
-- Description: Diagnostic queries and fixes for JWT/RLS issues
-- 
-- RUN THIS IN SUPABASE SQL EDITOR (Dashboard > SQL Editor)
-- Run each section separately to diagnose the issue
-- ============================================================================

-- ============================================================================
-- PART 1: DIAGNOSTIC QUERIES
-- Run these first to understand the issue
-- ============================================================================

-- 1A: Check if get_clerk_id() function exists and works
SELECT 
  'get_clerk_id() test' as test,
  get_clerk_id() as result,
  CASE 
    WHEN get_clerk_id() IS NULL THEN '❌ NULL - JWT not sent or clerk_id claim missing'
    ELSE '✅ JWT working: ' || get_clerk_id()
  END as status;

-- 1B: Check if get_user_household_id() function works
SELECT 
  'get_user_household_id() test' as test,
  get_user_household_id() as result,
  CASE 
    WHEN get_user_household_id() IS NULL THEN '❌ NULL - User not in DB or no household'
    ELSE '✅ Household found: ' || get_user_household_id()::text
  END as status;

-- 1C: Check current JWT claims (for debugging)
SELECT 
  'JWT Claims' as test,
  current_setting('request.jwt.claims', true) as raw_claims;

-- ============================================================================
-- PART 2: CHECK USER DATA (uses service role, bypasses RLS)
-- ============================================================================

-- 2A: List all users in the database
SELECT 
  id,
  clerk_id,
  email,
  name,
  household_id,
  status,
  role,
  created_at
FROM users
ORDER BY created_at DESC
LIMIT 20;

-- 2B: Check specific household
SELECT 
  h.id,
  h.name,
  h.subscription_plan,
  h.subscription_status,
  (SELECT COUNT(*) FROM users WHERE household_id = h.id) as member_count
FROM households h
WHERE h.id = 'ecb34564-470c-41ea-a7ef-ed7446dd853d';  -- Replace with your household ID

-- 2C: Check if user exists with clerk_id
SELECT 
  id,
  clerk_id,
  household_id,
  email,
  name
FROM users
WHERE clerk_id = 'user_36Ld8EjKmnxbbRGarGSspohmQhw';  -- Replace with your clerk_id

-- ============================================================================
-- PART 3: CHECK RLS POLICIES
-- ============================================================================

-- 3A: List all policies on households table
SELECT
  policyname,
  cmd as command,
  permissive,
  qual as "USING expression",
  with_check as "WITH CHECK expression"
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'households'
ORDER BY cmd;

-- 3B: List all policies on users table
SELECT
  policyname,
  cmd as command,
  permissive,
  qual as "USING expression",
  with_check as "WITH CHECK expression"
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'users'
ORDER BY cmd;

-- ============================================================================
-- PART 4: FIX - Update get_clerk_id() to be more robust
-- ============================================================================

-- This version tries multiple locations for clerk_id in the JWT
CREATE OR REPLACE FUNCTION get_clerk_id()
RETURNS TEXT AS $$
DECLARE
  claims JSON;
  result TEXT;
BEGIN
  -- Get the full JWT claims
  BEGIN
    claims := current_setting('request.jwt.claims', true)::json;
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;

  -- If no claims, return NULL
  IF claims IS NULL THEN
    RETURN NULL;
  END IF;

  -- Try clerk_id first (our custom claim)
  result := claims->>'clerk_id';
  IF result IS NOT NULL AND result != '' THEN
    RETURN result;
  END IF;

  -- Try sub (standard JWT subject claim - Clerk uses this for user ID)
  result := claims->>'sub';
  IF result IS NOT NULL AND result != '' THEN
    RETURN result;
  END IF;

  -- Try user_id (some configurations use this)
  result := claims->>'user_id';
  IF result IS NOT NULL AND result != '' THEN
    RETURN result;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- PART 5: FIX - Update households SELECT policy
-- ============================================================================

-- Drop existing SELECT policies
DROP POLICY IF EXISTS "Users can view their household" ON households;
DROP POLICY IF EXISTS "Household members can view their household" ON households;

-- Create a more permissive SELECT policy that checks multiple conditions
CREATE POLICY "Users can view their household"
ON households FOR SELECT
USING (
  -- Check if user has JWT and is in this household
  EXISTS (
    SELECT 1 FROM users
    WHERE (users.clerk_id = get_clerk_id() OR users.clerk_id = (current_setting('request.jwt.claims', true)::json->>'sub'))
    AND users.household_id = households.id
  )
);

-- ============================================================================
-- PART 6: VERIFY FIX
-- ============================================================================

-- Test the updated function
SELECT 
  'Post-fix verification' as test,
  get_clerk_id() as clerk_id_result,
  get_user_household_id() as household_id_result,
  current_setting('request.jwt.claims', true)::json->>'sub' as jwt_sub_claim;

-- Test household access
SELECT 
  id,
  name,
  subscription_plan
FROM households
WHERE id = 'ecb34564-470c-41ea-a7ef-ed7446dd853d'
LIMIT 1;

-- ============================================================================
-- PART 7: EMERGENCY DEBUG POLICY (UNCOMMENT ONLY IF NEEDED)
-- ============================================================================
-- WARNING: This allows any authenticated user to read any household
-- Only use for debugging, then remove immediately!

-- DROP POLICY IF EXISTS "DEBUG_ALLOW_ALL_READS" ON households;
-- CREATE POLICY "DEBUG_ALLOW_ALL_READS"
-- ON households FOR SELECT
-- USING (
--   current_setting('request.jwt.claims', true) IS NOT NULL
-- );

-- To remove the debug policy:
-- DROP POLICY IF EXISTS "DEBUG_ALLOW_ALL_READS" ON households;

-- ============================================================================
-- NOTES
-- ============================================================================
-- 
-- Common issues this migration fixes:
-- 1. get_clerk_id() not finding the clerk_id claim
--    - Now also checks 'sub' claim (Clerk's standard user ID location)
-- 
-- 2. RLS policy being too strict
--    - Now checks both clerk_id and sub claims
--
-- If still not working:
-- 1. Check browser console for JWT token logs
-- 2. Decode the JWT at jwt.io to see actual claims
-- 3. Make sure Clerk JWT template has correct claims
-- 4. Sign out and back in to get fresh token
--
-- ============================================================================
