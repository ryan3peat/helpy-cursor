-- Migration: Rename 'Lifestyle' category back to 'Fun & Lifestyle'
-- This reverses migration 078 to use the more descriptive category name

-- Update all existing expenses with 'Lifestyle' category to 'Fun & Lifestyle'
UPDATE expenses
SET category = 'Fun & Lifestyle'
WHERE category = 'Lifestyle';

-- Verify the change
SELECT 
  'Category rename complete' as status,
  COUNT(*) FILTER (WHERE category = 'Lifestyle') as old_category_count,
  COUNT(*) FILTER (WHERE category = 'Fun & Lifestyle') as new_category_count,
  CASE 
    WHEN COUNT(*) FILTER (WHERE category = 'Lifestyle') = 0 THEN 'SUCCESS'
    ELSE 'WARNING: Some records still have old category'
  END as result
FROM expenses;
