-- ============================================================================
-- Migration: 037_verify_rls_and_jwt
-- Description: Verify RLS policies are correctly configured and diagnose issues
-- 
-- Run this in Supabase Dashboard > SQL Editor to check your setup
-- ============================================================================

-- ============================================================================
-- 1. Check RLS is enabled on all tables
-- ============================================================================
SELECT 
  tablename as "Table",
  rowsecurity as "RLS Enabled"
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('households', 'users', 'todo_items', 'meals', 'expenses', 'receipts', 'sections', 'essential_info', 'house_routine', 'push_subscriptions', 'notifications')
ORDER BY tablename;

-- ============================================================================
-- 2. Check all policies on households table
-- ============================================================================
SELECT 
  policyname as "Policy Name",
  cmd as "Command",
  CASE WHEN permissive = 'PERMISSIVE' THEN 'Yes' ELSE 'No' END as "Permissive",
  qual as "USING Expression",
  with_check as "WITH CHECK Expression"
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'households'
ORDER BY cmd, policyname;

-- ============================================================================
-- 3. Check helper functions exist and are correct
-- ============================================================================
SELECT 
  routine_name as "Function",
  data_type as "Return Type",
  security_type as "Security"
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('get_clerk_id', 'get_user_household_id')
ORDER BY routine_name;

-- ============================================================================
-- 4. Test get_clerk_id() function (will return NULL in SQL Editor - that's expected)
-- ============================================================================
SELECT 
  get_clerk_id() as "clerk_id (should be NULL in SQL Editor)",
  get_user_household_id() as "household_id (should be NULL in SQL Editor)";

-- ============================================================================
-- 5. Show function definitions
-- ============================================================================
SELECT pg_get_functiondef(oid) as "get_clerk_id Definition"
FROM pg_proc 
WHERE proname = 'get_clerk_id' 
  AND pronamespace = 'public'::regnamespace;

SELECT pg_get_functiondef(oid) as "get_user_household_id Definition"
FROM pg_proc 
WHERE proname = 'get_user_household_id' 
  AND pronamespace = 'public'::regnamespace;

-- ============================================================================
-- 6. Check for third-party auth configuration
-- Look for Clerk configuration in auth settings
-- ============================================================================
-- Note: Third-party auth configuration isn't directly visible via SQL.
-- You need to check Supabase Dashboard > Authentication > Providers > Third Party Auth

-- ============================================================================
-- IMPORTANT: JWT Configuration Checklist
-- ============================================================================
-- 1. In Clerk Dashboard > Configure > JWT Templates:
--    - Create a template named "supabase"
--    - Add custom claim: { "clerk_id": "{{user.id}}" }
--    - Set Audience to your Supabase project URL
--
-- 2. In Supabase Dashboard > Authentication > Third Party Auth:
--    - Enable Clerk as a provider
--    - Add your Clerk domain (e.g., helpyfam.com or your .clerk.accounts.dev domain)
--
-- 3. Verify the JWT is being sent in requests:
--    - Open browser DevTools > Network tab
--    - Look for requests to your Supabase URL
--    - Check the Authorization header contains "Bearer eyJ..."
--    - Decode the JWT at jwt.io to verify it contains "clerk_id" claim
-- ============================================================================
