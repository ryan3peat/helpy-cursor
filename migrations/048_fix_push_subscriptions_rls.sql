-- ============================================================================
-- Migration: 048_fix_push_subscriptions_rls
-- Description: Fix push_subscriptions SELECT policy to allow household-level access
-- 
-- Problem: The current SELECT policy only allows users to view their OWN push
-- subscriptions. This causes the notification status indicator in Profile.tsx
-- to incorrectly show "orange bell" (incomplete) for other household members,
-- even when they have valid push subscriptions.
--
-- Solution: Change SELECT policy to household-level access (consistent with
-- other tables like users, meals, expenses, todo_items).
--
-- Note: INSERT, UPDATE, DELETE policies remain user-only - users can still
-- only modify their own subscriptions.
-- ============================================================================

-- Drop the existing SELECT policy
DROP POLICY IF EXISTS "Users can manage their own push subscriptions" ON push_subscriptions;

-- Also drop any legacy policies that might exist
DROP POLICY IF EXISTS "Allow select on push_subscriptions" ON push_subscriptions;

-- Create new SELECT policy that allows viewing household members' subscriptions
CREATE POLICY "Users can view push subscriptions in their household"
ON push_subscriptions FOR SELECT
USING (
  household_id IN (
    SELECT household_id FROM users 
    WHERE clerk_id = get_clerk_id()
  )
);

-- Verify the change
SELECT 
  policyname as "Policy Name",
  cmd as "Command",
  qual as "USING Expression"
FROM pg_policies 
WHERE tablename = 'push_subscriptions'
ORDER BY policyname;

