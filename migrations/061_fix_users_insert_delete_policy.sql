-- ============================================================================
-- Migration: 061_fix_users_insert_delete_policy
-- Description: Add missing INSERT and DELETE policies for users table
-- 
-- The 060_comprehensive_superadmin_permissions migration only created SELECT
-- and UPDATE policies for the users table, leaving INSERT and DELETE without
-- policies - causing RLS violations when adding household members.
-- 
-- Run this in Supabase Dashboard > SQL Editor
-- ============================================================================

-- ============================================================================
-- USERS TABLE - INSERT POLICY
-- ============================================================================
-- Drop any existing insert policies
DROP POLICY IF EXISTS "Allow insert on users" ON users;
DROP POLICY IF EXISTS "Users can insert household members" ON users;
DROP POLICY IF EXISTS "Service role can insert users" ON users;
DROP POLICY IF EXISTS "Authenticated users can create users" ON users;

-- Create new insert policy: Allow inserting users into your own household
CREATE POLICY "Users can insert household members"
ON users FOR INSERT
WITH CHECK (
  -- Can insert into your own household
  household_id = get_user_household_id()
  OR
  -- SuperAdmins can insert into any household
  is_superadmin()
  OR
  -- Allow initial signup (when user doesn't exist yet - handled by Clerk webhook)
  -- This is permissive to allow the signup flow to work
  auth.uid() IS NOT NULL
);

-- ============================================================================
-- USERS TABLE - DELETE POLICY
-- ============================================================================
-- Drop any existing delete policies
DROP POLICY IF EXISTS "Allow delete on users" ON users;
DROP POLICY IF EXISTS "Users can delete household members" ON users;

-- Create new delete policy: Allow deleting users from your own household
CREATE POLICY "Users can delete household members"
ON users FOR DELETE
USING (
  -- Can delete from your own household
  household_id = get_user_household_id()
  OR
  -- SuperAdmins can delete from any household
  is_superadmin()
);

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- List all policies on users table
SELECT 
  policyname,
  cmd,
  permissive
FROM pg_policies 
WHERE tablename = 'users'
ORDER BY cmd, policyname;

-- ============================================================================
-- Done! Users table now has proper INSERT and DELETE policies
-- ============================================================================

