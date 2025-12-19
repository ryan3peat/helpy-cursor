-- ============================================================================
-- Migration: 043_fix_subscription_data_sync
-- Description: Fix mismatched subscription_plan and max_family_members/max_helpers
-- 
-- This migration syncs the max_family_members and max_helpers columns with the 
-- subscription_plan value, ensuring data consistency.
-- ============================================================================

-- ============================================================================
-- PART 1: DIAGNOSTIC - View current state of all households
-- ============================================================================
SELECT 
  id,
  name,
  subscription_plan,
  max_family_members,
  max_helpers,
  CASE 
    WHEN subscription_plan = 'free' AND (max_family_members != 3 OR max_helpers != 1) THEN 'MISMATCH'
    WHEN subscription_plan = 'core' AND (max_family_members != 4 OR max_helpers != 1) THEN 'MISMATCH'
    WHEN subscription_plan = 'pro' AND (max_family_members != 8 OR max_helpers != 4) THEN 'MISMATCH'
    WHEN subscription_plan = 'test' AND (max_family_members != 4 OR max_helpers != 1) THEN 'MISMATCH'
    ELSE 'OK'
  END as status,
  stripe_subscription_id,
  subscription_status
FROM households
ORDER BY subscription_plan, name;

-- ============================================================================
-- PART 2: FIX - Update max_family_members and max_helpers based on subscription_plan
-- ============================================================================
-- This updates households where the limits don't match the plan

-- Fix FREE plan households
UPDATE households
SET 
  max_family_members = 3,
  max_helpers = 1
WHERE subscription_plan = 'free'
  AND (max_family_members != 3 OR max_helpers != 1);

-- Fix CORE plan households
UPDATE households
SET 
  max_family_members = 4,
  max_helpers = 1
WHERE subscription_plan = 'core'
  AND (max_family_members != 4 OR max_helpers != 1);

-- Fix PRO plan households
UPDATE households
SET 
  max_family_members = 8,
  max_helpers = 4
WHERE subscription_plan = 'pro'
  AND (max_family_members != 8 OR max_helpers != 4);

-- Fix TEST plan households
UPDATE households
SET 
  max_family_members = 4,
  max_helpers = 1
WHERE subscription_plan = 'test'
  AND (max_family_members != 4 OR max_helpers != 1);

-- ============================================================================
-- PART 3: Handle NULL subscription_plan (default to free)
-- ============================================================================
UPDATE households
SET 
  subscription_plan = 'free',
  max_family_members = 3,
  max_helpers = 1
WHERE subscription_plan IS NULL;

-- ============================================================================
-- PART 4: VERIFY - Check for any remaining mismatches
-- ============================================================================
SELECT 
  id,
  name,
  subscription_plan,
  max_family_members,
  max_helpers,
  'STILL MISMATCHED' as status
FROM households
WHERE (
  (subscription_plan = 'free' AND (max_family_members != 3 OR max_helpers != 1))
  OR (subscription_plan = 'core' AND (max_family_members != 4 OR max_helpers != 1))
  OR (subscription_plan = 'pro' AND (max_family_members != 8 OR max_helpers != 4))
  OR (subscription_plan = 'test' AND (max_family_members != 4 OR max_helpers != 1))
);

-- If this returns no rows, all data is now consistent!

-- ============================================================================
-- PART 5: Also check for stuck "deleted" helpers that weren't properly removed
-- This was a bug where RLS blocked deletes
-- ============================================================================
SELECT 
  u.id,
  u.name,
  u.role,
  u.status,
  u.household_id,
  h.name as household_name
FROM users u
JOIN households h ON u.household_id = h.id
WHERE u.role ILIKE '%helper%'
ORDER BY h.name, u.name;

-- ============================================================================
-- NOTES
-- ============================================================================
-- 
-- Plan Limits Reference:
-- - free: maxFamily: 3, maxHelpers: 1
-- - core: maxFamily: 4, maxHelpers: 1  
-- - pro:  maxFamily: 8, maxHelpers: 4
-- - test: maxFamily: 4, maxHelpers: 1
--
-- The authoritative source of truth is subscription_plan.
-- max_family_members and max_helpers are derived values that should match.
--
-- ============================================================================






