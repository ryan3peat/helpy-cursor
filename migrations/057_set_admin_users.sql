-- ============================================================================
-- Migration: 057_set_admin_users
-- Description: Set specific users as Admin based on email addresses
-- 
-- NOTE: This migration is DEPRECATED. Use migration 059_add_superadmin_role.sql instead.
-- The users cryptohkrc@gmail.com and julianoliko@gmail.com should be SuperAdmin, not Admin.
-- 
-- This migration is kept for reference but should not be run.
-- ============================================================================

-- DEPRECATED: Do not run this migration
-- Use migration 059_add_superadmin_role.sql instead

-- ============================================================================
-- If you need to set regular household admins, use:
-- ============================================================================
-- UPDATE users
-- SET role = 'Admin'
-- WHERE email = 'user@example.com';
-- ============================================================================
