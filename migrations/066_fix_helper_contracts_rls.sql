-- ============================================================================
-- Migration 066: Fix helper_contracts RLS to prevent helpers seeing each other's contracts
-- ============================================================================
-- Issue: The original RLS policy allowed ALL users in household to see ALL contracts
-- Fix: Helpers should ONLY see their own contract, Admin/Spouse can see all
-- ============================================================================

-- Drop and recreate the SELECT policy with proper restrictions
DROP POLICY IF EXISTS "helper_contracts_select" ON helper_contracts;

CREATE POLICY "helper_contracts_select"
ON helper_contracts FOR SELECT
USING (
  (
    household_id = get_user_household_id()
    AND (
      -- Non-helpers (Admin/Spouse) can see all contracts in their household
      EXISTS (
        SELECT 1 FROM users 
        WHERE clerk_id = get_clerk_id() 
        AND role IN ('SuperAdmin', 'Admin', 'Spouse')
      )
      OR
      -- Helpers can ONLY see their own contract
      user_id = (
        SELECT id FROM users WHERE clerk_id = get_clerk_id()
      )
    )
  )
  OR is_superadmin()
);

-- Verify the policy is created
DO $$
BEGIN
  RAISE NOTICE 'helper_contracts RLS policy updated successfully';
  RAISE NOTICE 'Helpers can now ONLY see their own employment details';
END $$;

