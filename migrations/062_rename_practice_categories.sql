-- Migration: Rename Practice categories to shorter names
-- Table: practices (formerly house_routines, renamed in migration 060)
-- This updates existing records in the database to use the new category values

-- Update practices table
UPDATE practices SET category = 'Cooking' WHERE category = 'Meal Preparations';
UPDATE practices SET category = 'Grocery' WHERE category = 'Grocery & Market';
UPDATE practices SET category = 'Laundry' WHERE category = 'Laundry & Wardrobe';
UPDATE practices SET category = 'Safety' WHERE category = 'Safety & Emergency';
UPDATE practices SET category = 'Utilities' WHERE category = 'Energy & Bills';

-- Verify the update
SELECT category, COUNT(*) as count 
FROM practices 
GROUP BY category 
ORDER BY category;

