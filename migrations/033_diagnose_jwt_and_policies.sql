-- ============================================================================
-- Migration: 033_diagnose_jwt_and_policies
-- Description: Diagnose JWT and RLS policy issues
-- 
-- Run this to check:
-- 1. If helper functions exist and work
-- 2. Current INSERT policies
-- 3. RLS status
-- ============================================================================

-- Check if helper functions exist
SELECT 
  routine_name,
  routine_type,
  security_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('get_clerk_id', 'get_user_household_id')
ORDER BY routine_name;

-- Check current INSERT policies for households and users
SELECT 
  tablename,
  policyname,
  cmd as "Command",
  roles,
  qual as "USING",
  with_check as "WITH CHECK"
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('households', 'users')
  AND cmd = 'INSERT'
ORDER BY tablename, policyname;

-- Check RLS status
SELECT 
  tablename,
  rowsecurity as "RLS Enabled"
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('households', 'users');

-- Test get_clerk_id function (will return NULL if no JWT in current session)
-- This is just to verify the function exists and can be called
SELECT 
  'get_clerk_id() test' as test_name,
  get_clerk_id() as clerk_id_result,
  CASE 
    WHEN get_clerk_id() IS NULL THEN 'No JWT in current session (expected if run from SQL Editor)'
    ELSE 'JWT found - clerk_id: ' || get_clerk_id()
  END as status;
