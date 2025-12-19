-- ============================================================================
-- Migration: 059_add_superadmin_role
-- Description: Add SuperAdmin role and update RLS policies for support tickets
-- 
-- Changes:
-- 1. Add SuperAdmin as a valid role (update CHECK constraint if needed)
-- 2. Set cryptohkrc@gmail.com and julianoliko@gmail.com as SuperAdmin
-- 3. Update RLS policies to distinguish between Admin (household) and SuperAdmin (app-wide)
-- 
-- Run this in Supabase Dashboard > SQL Editor
-- ============================================================================

-- 1. Update the two users to SuperAdmin role
UPDATE users
SET role = 'SuperAdmin'
WHERE email IN ('cryptohkrc@gmail.com', 'julianoliko@gmail.com');

-- 2. Verify the update
SELECT 
  id,
  name,
  email,
  role,
  clerk_id,
  household_id
FROM users
WHERE email IN ('cryptohkrc@gmail.com', 'julianoliko@gmail.com');

-- 3. Drop existing RLS policies on support_tickets
DROP POLICY IF EXISTS "Users can view their own tickets or all if admin" ON support_tickets;
DROP POLICY IF EXISTS "Users can update own tickets or admins can update any" ON support_tickets;
DROP POLICY IF EXISTS "Users can delete own tickets or admins can delete any" ON support_tickets;

-- 4. Create new RLS policies that distinguish Admin vs SuperAdmin

-- SELECT Policy:
-- - Users can see their own tickets
-- - Household Admins can see all tickets in their household
-- - SuperAdmins can see ALL tickets across ALL households
CREATE POLICY "Users can view tickets based on role"
ON support_tickets FOR SELECT
USING (
  -- User can see their own tickets
  user_id IN (SELECT id FROM users WHERE clerk_id = get_clerk_id())
  OR
  -- Household Admins can see all tickets in their household
  (
    household_id = get_user_household_id()
    AND EXISTS (
      SELECT 1 FROM users 
      WHERE clerk_id = get_clerk_id() 
      AND role = 'Admin'
    )
  )
  OR
  -- SuperAdmins can see ALL tickets (no household restriction)
  EXISTS (
    SELECT 1 FROM users 
    WHERE clerk_id = get_clerk_id() 
    AND role = 'SuperAdmin'
  )
);

-- UPDATE Policy:
-- - Users can update their own tickets
-- - Household Admins can update tickets in their household
-- - SuperAdmins can update ANY ticket
CREATE POLICY "Users can update tickets based on role"
ON support_tickets FOR UPDATE
USING (
  -- User can update their own tickets
  user_id IN (SELECT id FROM users WHERE clerk_id = get_clerk_id())
  OR
  -- Household Admins can update tickets in their household
  (
    household_id = get_user_household_id()
    AND EXISTS (
      SELECT 1 FROM users 
      WHERE clerk_id = get_clerk_id() 
      AND role = 'Admin'
    )
  )
  OR
  -- SuperAdmins can update ANY ticket
  EXISTS (
    SELECT 1 FROM users 
    WHERE clerk_id = get_clerk_id() 
    AND role = 'SuperAdmin'
  )
);

-- DELETE Policy:
-- - Users can delete their own tickets
-- - Household Admins can delete tickets in their household
-- - SuperAdmins can delete ANY ticket
CREATE POLICY "Users can delete tickets based on role"
ON support_tickets FOR DELETE
USING (
  -- User can delete their own tickets
  user_id IN (SELECT id FROM users WHERE clerk_id = get_clerk_id())
  OR
  -- Household Admins can delete tickets in their household
  (
    household_id = get_user_household_id()
    AND EXISTS (
      SELECT 1 FROM users 
      WHERE clerk_id = get_clerk_id() 
      AND role = 'Admin'
    )
  )
  OR
  -- SuperAdmins can delete ANY ticket
  EXISTS (
    SELECT 1 FROM users 
    WHERE clerk_id = get_clerk_id() 
    AND role = 'SuperAdmin'
  )
);

-- ============================================================================
-- Done! SuperAdmin role is now set up
-- ============================================================================
-- 
-- Summary:
-- - cryptohkrc@gmail.com and julianoliko@gmail.com are now SuperAdmin
-- - Regular Admins can only see/manage tickets in their own household
-- - SuperAdmins can see/manage ALL tickets across ALL households
-- ============================================================================
