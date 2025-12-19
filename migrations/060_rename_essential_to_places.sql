-- Migration: Rename essential_info to places, house_routine to practices
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor > New Query)

-- ═══════════════════════════════════════════════════════════════════════════
-- PART 1: RENAME essential_info → places
-- ═══════════════════════════════════════════════════════════════════════════

-- 1.1 Drop existing RLS policies on essential_info
DROP POLICY IF EXISTS "Users can view their household essential info" ON essential_info;
DROP POLICY IF EXISTS "Users can insert their household essential info" ON essential_info;
DROP POLICY IF EXISTS "Users can update their household essential info" ON essential_info;
DROP POLICY IF EXISTS "Users can delete their household essential info" ON essential_info;
DROP POLICY IF EXISTS "essential_info_select" ON essential_info;
DROP POLICY IF EXISTS "essential_info_insert" ON essential_info;
DROP POLICY IF EXISTS "essential_info_update" ON essential_info;
DROP POLICY IF EXISTS "essential_info_delete" ON essential_info;

-- 1.2 Remove from realtime publication (ignore error if not in publication)
DO $$ 
BEGIN
  ALTER PUBLICATION supabase_realtime DROP TABLE essential_info;
EXCEPTION WHEN undefined_object THEN
  NULL; -- Table not in publication, ignore
END $$;

-- 1.3 Rename the table
ALTER TABLE essential_info RENAME TO places;

-- 1.4 Rename indexes
ALTER INDEX IF EXISTS idx_essential_info_household RENAME TO idx_places_household;
ALTER INDEX IF EXISTS idx_essential_info_category RENAME TO idx_places_category;

-- 1.5 Create new RLS policies for places
CREATE POLICY "places_select" ON places FOR SELECT
USING (
  household_id IN (
    SELECT household_id FROM users 
    WHERE clerk_id = (current_setting('request.jwt.claims', true)::json->>'sub')
  )
);

CREATE POLICY "places_insert" ON places FOR INSERT
WITH CHECK (
  household_id IN (
    SELECT household_id FROM users 
    WHERE clerk_id = (current_setting('request.jwt.claims', true)::json->>'sub')
  )
);

CREATE POLICY "places_update" ON places FOR UPDATE
USING (
  household_id IN (
    SELECT household_id FROM users 
    WHERE clerk_id = (current_setting('request.jwt.claims', true)::json->>'sub')
  )
);

CREATE POLICY "places_delete" ON places FOR DELETE
USING (
  household_id IN (
    SELECT household_id FROM users 
    WHERE clerk_id = (current_setting('request.jwt.claims', true)::json->>'sub')
  )
);

-- 1.6 Add to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE places;

-- ═══════════════════════════════════════════════════════════════════════════
-- PART 2: RENAME house_routine → practices
-- ═══════════════════════════════════════════════════════════════════════════

-- 2.1 Drop existing RLS policies on house_routine
DROP POLICY IF EXISTS "Users can view their household house routine" ON house_routine;
DROP POLICY IF EXISTS "Users can insert their household house routine" ON house_routine;
DROP POLICY IF EXISTS "Users can update their household house routine" ON house_routine;
DROP POLICY IF EXISTS "Users can delete their household house routine" ON house_routine;
DROP POLICY IF EXISTS "house_routine_select" ON house_routine;
DROP POLICY IF EXISTS "house_routine_insert" ON house_routine;
DROP POLICY IF EXISTS "house_routine_update" ON house_routine;
DROP POLICY IF EXISTS "house_routine_delete" ON house_routine;

-- 2.2 Remove from realtime publication (ignore error if not in publication)
DO $$ 
BEGIN
  ALTER PUBLICATION supabase_realtime DROP TABLE house_routine;
EXCEPTION WHEN undefined_object THEN
  NULL; -- Table not in publication, ignore
END $$;

-- 2.3 Rename the table
ALTER TABLE house_routine RENAME TO practices;

-- 2.4 Rename indexes
ALTER INDEX IF EXISTS idx_house_routine_household RENAME TO idx_practices_household;
ALTER INDEX IF EXISTS idx_house_routine_category RENAME TO idx_practices_category;

-- 2.5 Create new RLS policies for practices
CREATE POLICY "practices_select" ON practices FOR SELECT
USING (
  household_id IN (
    SELECT household_id FROM users 
    WHERE clerk_id = (current_setting('request.jwt.claims', true)::json->>'sub')
  )
);

CREATE POLICY "practices_insert" ON practices FOR INSERT
WITH CHECK (
  household_id IN (
    SELECT household_id FROM users 
    WHERE clerk_id = (current_setting('request.jwt.claims', true)::json->>'sub')
  )
);

CREATE POLICY "practices_update" ON practices FOR UPDATE
USING (
  household_id IN (
    SELECT household_id FROM users 
    WHERE clerk_id = (current_setting('request.jwt.claims', true)::json->>'sub')
  )
);

CREATE POLICY "practices_delete" ON practices FOR DELETE
USING (
  household_id IN (
    SELECT household_id FROM users 
    WHERE clerk_id = (current_setting('request.jwt.claims', true)::json->>'sub')
  )
);

-- 2.6 Add to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE practices;

-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICATION
-- ═══════════════════════════════════════════════════════════════════════════

-- Check the tables were renamed
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('places', 'practices', 'essential_info', 'house_routine');

-- Should show: places, practices (and NOT essential_info, house_routine)
