-- ============================================================================
-- Migration: 055_hk_holidays_rls
-- Description: Add RLS policy for hk_statutory_holidays table
-- 
-- This table contains reference data (HK public holidays) that should be
-- readable by all authenticated users.
-- ============================================================================

-- ============================================================================
-- PART 1: Create SELECT policy for authenticated users
-- ============================================================================
-- Any authenticated user can read holidays (reference data)
DROP POLICY IF EXISTS "Authenticated users can view holidays" ON hk_statutory_holidays;

CREATE POLICY "Authenticated users can view holidays"
ON hk_statutory_holidays FOR SELECT
USING (
  -- Any user with a valid JWT can read holidays
  get_clerk_id() IS NOT NULL
);

-- ============================================================================
-- PART 2: Verify the policy was created
-- ============================================================================
SELECT
  policyname,
  cmd as command,
  permissive,
  qual as "USING expression"
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'hk_statutory_holidays'
ORDER BY policyname;

-- ============================================================================
-- NOTES
-- ============================================================================
-- 
-- The hk_statutory_holidays table is reference data that doesn't belong to
-- any specific household. All authenticated users should be able to read it.
--
-- No INSERT/UPDATE/DELETE policies are needed as this data is managed by
-- database migrations only, not by the app.
--

