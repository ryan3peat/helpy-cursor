-- ============================================================================
-- Migration: 035_comprehensive_rls_fix
-- Description: Comprehensive fix for RLS policies to handle edge cases
-- 
-- Fixes:
-- 1. Households SELECT policy - use direct subquery for better performance
-- 2. Ensure all policies handle NULL cases gracefully
-- ============================================================================

-- ============================================================================
-- HOUSEHOLDS TABLE - Fix SELECT policy
-- ============================================================================
DROP POLICY IF EXISTS "Users can view their household" ON households;

-- Use direct subquery instead of function for better performance and reliability
-- This policy allows users to view their household by checking if their clerk_id
-- matches a user record that has this household_id
CREATE POLICY "Users can view their household"
ON households FOR SELECT
USING (
  -- First check if clerk_id is available (user is authenticated)
  get_clerk_id() IS NOT NULL
  AND
  -- Then check if this household belongs to the user
  EXISTS (
    SELECT 1
    FROM users
    WHERE users.clerk_id = get_clerk_id()
    AND users.household_id = households.id
    AND users.household_id IS NOT NULL
  )
);

-- ============================================================================
-- Verify policies are correct
-- ============================================================================
SELECT 
  tablename,
  policyname,
  cmd as "Command",
  qual as "USING Expression"
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'households'
ORDER BY cmd, policyname;
