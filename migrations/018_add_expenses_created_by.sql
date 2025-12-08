-- ============================================================================
-- Migration 018: Add created_by to expenses table
-- ============================================================================
-- This migration:
-- 1. Adds created_by column to expenses table
-- 2. Backfills existing expenses to assign them to the household Admin
-- 3. Creates index for faster filtering
-- ============================================================================

-- Step 1: Add created_by column (nullable for backfill)
ALTER TABLE expenses 
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- Step 2: Backfill existing expenses - assign to household Admin
-- Find the Admin (MASTER role) for each household and assign their expenses
UPDATE expenses e
SET created_by = (
  SELECT u.id 
  FROM users u 
  WHERE u.household_id = e.household_id 
    AND u.role = 'Admin'
  LIMIT 1
)
WHERE e.created_by IS NULL;

-- Step 3: Create index for faster filtering by created_by
CREATE INDEX IF NOT EXISTS idx_expenses_created_by ON expenses(created_by);

-- ============================================================================
-- Verification Query (run after migration to confirm)
-- ============================================================================
SELECT 
  'Expenses Migration Status' as check_name,
  COUNT(*) as total_expenses,
  COUNT(created_by) as expenses_with_creator,
  COUNT(*) - COUNT(created_by) as expenses_without_creator,
  CASE 
    WHEN COUNT(*) = 0 THEN 'No expenses yet'
    WHEN COUNT(*) = COUNT(created_by) THEN 'All expenses have creator assigned'
    ELSE 'Some expenses missing creator'
  END as status
FROM expenses;

