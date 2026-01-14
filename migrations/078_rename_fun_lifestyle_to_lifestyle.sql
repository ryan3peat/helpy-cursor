-- ============================================================================
-- Migration 078: Rename "Fun & Lifestyle" category to "Lifestyle" in expenses
-- ============================================================================
-- This migration:
-- 1. Updates all existing expense records with category "Fun & Lifestyle" to "Lifestyle"
-- 2. Ensures data consistency across the application
-- ============================================================================

-- Step 1: Update all expenses with "Fun & Lifestyle" category to "Lifestyle"
UPDATE expenses
SET category = 'Lifestyle'
WHERE category = 'Fun & Lifestyle';

-- ============================================================================
-- Verification Query (run after migration to confirm)
-- ============================================================================
SELECT 
  'Expense Category Migration Status' as check_name,
  COUNT(*) FILTER (WHERE category = 'Fun & Lifestyle') as old_category_count,
  COUNT(*) FILTER (WHERE category = 'Lifestyle') as new_category_count,
  CASE 
    WHEN COUNT(*) FILTER (WHERE category = 'Fun & Lifestyle') = 0 THEN 'All expenses updated successfully'
    ELSE 'Some expenses still have old category name'
  END as status
FROM expenses;
