-- ============================================================================
-- Migration: 058_debug_admin_access
-- Description: Diagnostic queries to debug admin access to support tickets
-- 
-- Run these queries to check:
-- 1. If your user has the correct role
-- 2. If your clerk_id is set correctly
-- 3. If RLS policies are working
-- 
-- Run this in Supabase Dashboard > SQL Editor
-- ============================================================================

-- 1. Check users with Admin role
SELECT 
  id,
  name,
  email,
  role,
  clerk_id,
  household_id,
  CASE 
    WHEN clerk_id IS NULL THEN '⚠️ No clerk_id set'
    ELSE '✅ Has clerk_id'
  END as clerk_status
FROM users
WHERE role = 'Admin'
ORDER BY email;

-- 2. Check specific admin users
SELECT 
  id,
  name,
  email,
  role,
  clerk_id,
  household_id
FROM users
WHERE email IN ('cryptohkrc@gmail.com', 'julianoliko@gmail.com');

-- 3. Check all support tickets (this will show what RLS allows you to see)
-- NOTE: This query respects RLS, so you'll only see tickets you have access to
SELECT 
  st.id,
  st.subject,
  st.status,
  st.user_id,
  u.name as user_name,
  u.email as user_email,
  u.role as user_role,
  u.clerk_id as user_clerk_id,
  st.household_id,
  jsonb_array_length(st.messages) as message_count,
  st.created_at,
  st.updated_at
FROM support_tickets st
LEFT JOIN users u ON st.user_id = u.id
ORDER BY st.updated_at DESC;

-- 4. Check RLS policies on support_tickets
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'support_tickets'
ORDER BY policyname;

-- 5. Test the get_clerk_id() function (if you're logged in via Clerk)
-- This will show your current clerk_id from the JWT token
SELECT get_clerk_id() as current_clerk_id;

-- 6. Test the get_user_household_id() function
SELECT get_user_household_id() as current_household_id;

-- 7. Check if your clerk_id matches a user in the database
-- Replace 'YOUR_CLERK_ID_HERE' with your actual Clerk user ID (user_xxx...)
-- You can find this in the browser console after running the debug function
/*
SELECT 
  id,
  name,
  email,
  role,
  clerk_id,
  household_id
FROM users
WHERE clerk_id = 'YOUR_CLERK_ID_HERE';
*/

-- ============================================================================
-- Common Issues and Fixes:
-- ============================================================================
-- 
-- Issue 1: clerk_id is NULL
-- Fix: The user needs to log in through Clerk, which should set the clerk_id
-- 
-- Issue 2: Role is not 'Admin'
-- Fix: Run migration 057_set_admin_users.sql to set the role
-- 
-- Issue 3: RLS policies not working
-- Fix: Check that:
--   - JWT token includes clerk_id in claims
--   - get_clerk_id() function returns your clerk_id
--   - Your user record has the correct clerk_id
-- 
-- Issue 4: Can't see tickets from other users
-- Fix: Verify that:
--   - Your role is 'Admin' in the users table
--   - Your clerk_id matches the clerk_id in your user record
--   - You're in the same household_id as the tickets
-- ============================================================================
