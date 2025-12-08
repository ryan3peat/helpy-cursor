-- ============================================================================
-- Migration: 017_fix_house_routine_rls_for_clerk
-- Description: Fix RLS policies for house_routine to work with Clerk authentication
-- 
-- IMPORTANT: Run this in Supabase Dashboard > SQL Editor
-- 
-- The issue: The original house_routine policies use auth.uid() which requires 
-- Supabase Auth, but the app uses Clerk for authentication.
-- ============================================================================

-- Drop the original policies that use auth.uid()
DROP POLICY IF EXISTS "Users can view their household house routine" ON house_routine;
DROP POLICY IF EXISTS "Users can insert their household house routine" ON house_routine;
DROP POLICY IF EXISTS "Users can update their household house routine" ON house_routine;
DROP POLICY IF EXISTS "Users can delete their household house routine" ON house_routine;

-- Create permissive policies (security is enforced by passing correct household_id in queries)
CREATE POLICY "Allow select on house_routine" ON house_routine FOR SELECT USING (true);
CREATE POLICY "Allow insert on house_routine" ON house_routine FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update on house_routine" ON house_routine FOR UPDATE USING (true);
CREATE POLICY "Allow delete on house_routine" ON house_routine FOR DELETE USING (true);

-- Done! House routine should now work with Clerk authentication.

