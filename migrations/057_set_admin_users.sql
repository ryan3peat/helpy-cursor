-- ============================================================================
-- Migration: 057_set_admin_users
-- Description: Set specific users as Admin based on email addresses
-- 
-- This migration sets the following users as Admin:
-- - cryptohkrc@gmail.com
-- - julianoliko@gmail.com
-- 
-- Run this in Supabase Dashboard > SQL Editor
-- ============================================================================

-- Update users to Admin role based on email addresses
UPDATE users
SET role = 'Admin'
WHERE email IN ('cryptohkrc@gmail.com', 'julianoliko@gmail.com')
  AND role != 'Admin'; -- Only update if not already Admin

-- Verify the update
SELECT 
  id,
  name,
  email,
  role,
  household_id
FROM users
WHERE email IN ('cryptohkrc@gmail.com', 'julianoliko@gmail.com');

-- ============================================================================
-- Done! Users have been set as Admin
-- ============================================================================
