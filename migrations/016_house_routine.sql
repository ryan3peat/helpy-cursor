-- Migration: Create house_routine table
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor > New Query)

-- 1. Create the table
CREATE TABLE IF NOT EXISTS house_routine (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES households(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  custom_category TEXT, -- For "Others" category with custom entry
  name TEXT NOT NULL,
  note TEXT,
  -- Translation fields
  name_lang TEXT,
  name_translations JSONB DEFAULT '{}',
  note_lang TEXT,
  note_translations JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create index for faster household queries
CREATE INDEX IF NOT EXISTS idx_house_routine_household 
ON house_routine(household_id);

-- 3. Create index for category filtering
CREATE INDEX IF NOT EXISTS idx_house_routine_category 
ON house_routine(category);

-- 4. Enable Row Level Security
ALTER TABLE house_routine ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS policies
-- Policy: Users can view house_routine for their household
CREATE POLICY "Users can view their household house routine"
ON house_routine FOR SELECT
USING (
  household_id IN (
    SELECT household_id FROM users WHERE id = auth.uid()
  )
);

-- Policy: Users can insert house_routine for their household
CREATE POLICY "Users can insert their household house routine"
ON house_routine FOR INSERT
WITH CHECK (
  household_id IN (
    SELECT household_id FROM users WHERE id = auth.uid()
  )
);

-- Policy: Users can update house_routine for their household
CREATE POLICY "Users can update their household house routine"
ON house_routine FOR UPDATE
USING (
  household_id IN (
    SELECT household_id FROM users WHERE id = auth.uid()
  )
);

-- Policy: Users can delete house_routine for their household
CREATE POLICY "Users can delete their household house routine"
ON house_routine FOR DELETE
USING (
  household_id IN (
    SELECT household_id FROM users WHERE id = auth.uid()
  )
);

-- 6. Enable realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE house_routine;

