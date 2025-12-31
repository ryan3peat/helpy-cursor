-- Migration: Rename "House Rules" category to "Home Rules" in practices table
-- This updates existing records to use the new category name

-- Update all practices that have "House Rules" as their category
UPDATE practices
SET category = 'Home Rules'
WHERE category = 'House Rules';

-- Verify the update
SELECT 
  category,
  COUNT(*) as count
FROM practices
WHERE category IN ('House Rules', 'Home Rules')
GROUP BY category;


