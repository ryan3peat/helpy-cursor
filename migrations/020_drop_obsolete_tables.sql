-- ============================================================================
-- Migration: 020_drop_obsolete_tables
-- Description: Drop obsolete tables that are no longer used in the application
-- Executed: December 8, 2025
-- ============================================================================

-- ============================================================================
-- TABLES DROPPED IN THIS MIGRATION
-- ============================================================================
--
-- 1. shopping (49 records deleted)
--    - Reason: Replaced by unified 'todo_items' table (migration 003)
--    - The todo_items table has type='shopping' for shopping items
--
-- 2. tasks (16 records deleted)
--    - Reason: Replaced by unified 'todo_items' table (migration 003)
--    - The todo_items table has type='task' for task items
--
-- 3. schools (0 records)
--    - Reason: Never used in the application
--    - No services, components, or type definitions reference this table
--
-- 4. helper_points (0 records)
--    - Reason: Created for gamification feature (migration 002) but never implemented
--    - No services, components, or type definitions reference this table
--
-- ============================================================================

-- ============================================================================
-- DROP SHOPPING TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can view their household shopping items" ON shopping;
DROP POLICY IF EXISTS "Users can insert shopping items to their household" ON shopping;
DROP POLICY IF EXISTS "Users can update their household shopping items" ON shopping;
DROP POLICY IF EXISTS "Users can delete their household shopping items" ON shopping;
DROP TABLE IF EXISTS shopping;

-- ============================================================================
-- DROP TASKS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can view their household tasks" ON tasks;
DROP POLICY IF EXISTS "Users can insert tasks to their household" ON tasks;
DROP POLICY IF EXISTS "Users can update their household tasks" ON tasks;
DROP POLICY IF EXISTS "Users can delete their household tasks" ON tasks;
DROP TABLE IF EXISTS tasks;

-- ============================================================================
-- DROP SCHOOLS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can view schools" ON schools;
DROP POLICY IF EXISTS "Users can insert schools" ON schools;
DROP POLICY IF EXISTS "Users can update schools" ON schools;
DROP POLICY IF EXISTS "Users can delete schools" ON schools;
DROP TABLE IF EXISTS schools;

-- ============================================================================
-- DROP HELPER_POINTS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Allow select on helper_points" ON helper_points;
DROP POLICY IF EXISTS "Allow insert on helper_points" ON helper_points;
DROP POLICY IF EXISTS "Allow update on helper_points" ON helper_points;
DROP POLICY IF EXISTS "Allow delete on helper_points" ON helper_points;
DROP POLICY IF EXISTS "Users can view helper points in their household" ON helper_points;
DROP POLICY IF EXISTS "Users can update their own points" ON helper_points;
DROP POLICY IF EXISTS "Users can insert their own points" ON helper_points;
DROP TABLE IF EXISTS helper_points;

-- ============================================================================
-- VERIFICATION: Confirm all tables are dropped
-- ============================================================================
-- Run this query to verify:
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_schema = 'public' 
-- AND table_name IN ('shopping', 'tasks', 'schools', 'helper_points');
-- (Should return 0 rows)

