-- ============================================================================
-- Migration: 005_complete_fix_ROLLBACK
-- Description: Undo the changes from 005_complete_fix.sql
-- 
-- WARNING: Only run this if you need to revert to the original state.
-- After rolling back, the app will NOT work with Clerk authentication.
-- 
-- HOW TO RUN:
-- 1. Go to Supabase Dashboard
-- 2. Navigate to SQL Editor
-- 3. Paste this entire file
-- 4. Click "Run"
-- ============================================================================


-- ============================================================================
-- PART 1: REMOVE 'audience' COLUMN FROM MEALS TABLE
-- ============================================================================
-- This will remove the audience column and any data in it.
-- Existing meals will lose their audience information.
-- ============================================================================

ALTER TABLE meals DROP COLUMN IF EXISTS audience;


-- ============================================================================
-- PART 2: RESTORE ORIGINAL RLS POLICIES (with auth.uid() checks)
-- ============================================================================
-- WARNING: These policies require Supabase Auth.
-- If you're using Clerk, the app will NOT work after running this.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- ESSENTIAL_INFO TABLE
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow select on essential_info" ON essential_info;
DROP POLICY IF EXISTS "Allow insert on essential_info" ON essential_info;
DROP POLICY IF EXISTS "Allow update on essential_info" ON essential_info;
DROP POLICY IF EXISTS "Allow delete on essential_info" ON essential_info;

CREATE POLICY "Users can view their household essential info"
  ON essential_info FOR SELECT
  USING (household_id IN (SELECT household_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can insert their household essential info"
  ON essential_info FOR INSERT
  WITH CHECK (household_id IN (SELECT household_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can update their household essential info"
  ON essential_info FOR UPDATE
  USING (household_id IN (SELECT household_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can delete their household essential info"
  ON essential_info FOR DELETE
  USING (household_id IN (SELECT household_id FROM users WHERE id = auth.uid()));


-- ----------------------------------------------------------------------------
-- TRAINING_MODULES TABLE
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow select on training_modules" ON training_modules;
DROP POLICY IF EXISTS "Allow insert on training_modules" ON training_modules;
DROP POLICY IF EXISTS "Allow update on training_modules" ON training_modules;
DROP POLICY IF EXISTS "Allow delete on training_modules" ON training_modules;

CREATE POLICY "Users can view their household training modules"
  ON training_modules FOR SELECT
  USING (household_id IN (SELECT household_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can insert their household training modules"
  ON training_modules FOR INSERT
  WITH CHECK (household_id IN (SELECT household_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can update their household training modules"
  ON training_modules FOR UPDATE
  USING (household_id IN (SELECT household_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can delete their household training modules"
  ON training_modules FOR DELETE
  USING (household_id IN (SELECT household_id FROM users WHERE id = auth.uid()));


-- ----------------------------------------------------------------------------
-- HELPER_POINTS TABLE
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow select on helper_points" ON helper_points;
DROP POLICY IF EXISTS "Allow insert on helper_points" ON helper_points;
DROP POLICY IF EXISTS "Allow update on helper_points" ON helper_points;
DROP POLICY IF EXISTS "Allow delete on helper_points" ON helper_points;

CREATE POLICY "Users can view helper points in their household"
  ON helper_points FOR SELECT
  USING (user_id IN (SELECT id FROM users WHERE household_id IN (SELECT household_id FROM users WHERE id = auth.uid())));

CREATE POLICY "Users can update their own points"
  ON helper_points FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own points"
  ON helper_points FOR INSERT
  WITH CHECK (user_id = auth.uid());


-- ----------------------------------------------------------------------------
-- TODO_ITEMS TABLE
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow select on todo_items" ON todo_items;
DROP POLICY IF EXISTS "Allow insert on todo_items" ON todo_items;
DROP POLICY IF EXISTS "Allow update on todo_items" ON todo_items;
DROP POLICY IF EXISTS "Allow delete on todo_items" ON todo_items;

CREATE POLICY "Users can view their household todo items"
  ON todo_items FOR SELECT
  USING (household_id IN (SELECT household_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can insert todo items to their household"
  ON todo_items FOR INSERT
  WITH CHECK (household_id IN (SELECT household_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can update their household todo items"
  ON todo_items FOR UPDATE
  USING (household_id IN (SELECT household_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can delete their household todo items"
  ON todo_items FOR DELETE
  USING (household_id IN (SELECT household_id FROM users WHERE id = auth.uid()));


-- ----------------------------------------------------------------------------
-- USERS TABLE
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow select on users" ON users;
DROP POLICY IF EXISTS "Allow insert on users" ON users;
DROP POLICY IF EXISTS "Allow update on users" ON users;
DROP POLICY IF EXISTS "Allow delete on users" ON users;

CREATE POLICY "Users can view household members"
  ON users FOR SELECT
  USING (household_id IN (SELECT household_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  USING (id = auth.uid());


-- ----------------------------------------------------------------------------
-- HOUSEHOLDS TABLE
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow select on households" ON households;
DROP POLICY IF EXISTS "Allow insert on households" ON households;
DROP POLICY IF EXISTS "Allow update on households" ON households;
DROP POLICY IF EXISTS "Allow delete on households" ON households;

CREATE POLICY "Users can view their household"
  ON households FOR SELECT
  USING (id IN (SELECT household_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can update their household"
  ON households FOR UPDATE
  USING (id IN (SELECT household_id FROM users WHERE id = auth.uid()));


-- ----------------------------------------------------------------------------
-- MEALS TABLE
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow select on meals" ON meals;
DROP POLICY IF EXISTS "Allow insert on meals" ON meals;
DROP POLICY IF EXISTS "Allow update on meals" ON meals;
DROP POLICY IF EXISTS "Allow delete on meals" ON meals;

CREATE POLICY "Users can view their household meals"
  ON meals FOR SELECT
  USING (household_id IN (SELECT household_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can insert their household meals"
  ON meals FOR INSERT
  WITH CHECK (household_id IN (SELECT household_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can update their household meals"
  ON meals FOR UPDATE
  USING (household_id IN (SELECT household_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can delete their household meals"
  ON meals FOR DELETE
  USING (household_id IN (SELECT household_id FROM users WHERE id = auth.uid()));


-- ----------------------------------------------------------------------------
-- EXPENSES TABLE
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow select on expenses" ON expenses;
DROP POLICY IF EXISTS "Allow insert on expenses" ON expenses;
DROP POLICY IF EXISTS "Allow update on expenses" ON expenses;
DROP POLICY IF EXISTS "Allow delete on expenses" ON expenses;

CREATE POLICY "Users can view their household expenses"
  ON expenses FOR SELECT
  USING (household_id IN (SELECT household_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can insert their household expenses"
  ON expenses FOR INSERT
  WITH CHECK (household_id IN (SELECT household_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can update their household expenses"
  ON expenses FOR UPDATE
  USING (household_id IN (SELECT household_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can delete their household expenses"
  ON expenses FOR DELETE
  USING (household_id IN (SELECT household_id FROM users WHERE id = auth.uid()));


-- ============================================================================
-- ROLLBACK COMPLETE
-- 
-- WARNING: After running this rollback:
-- - The 'audience' column is removed from meals
-- - All RLS policies now require Supabase Auth (auth.uid())
-- - The app will NOT work with Clerk authentication
-- 
-- To fix the app again, run 005_complete_fix.sql
-- ============================================================================

