-- Migration: Create essential_info table
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor > New Query)

-- 1. Create the table
CREATE TABLE IF NOT EXISTS essential_info (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES households(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('Home', 'School', 'Doctor', 'Hospital', 'Shops', 'Others')),
  name TEXT,
  address TEXT,
  country_code TEXT DEFAULT '+1',
  phone TEXT,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create index for faster household queries
CREATE INDEX IF NOT EXISTS idx_essential_info_household 
ON essential_info(household_id);

-- 3. Create index for category filtering
CREATE INDEX IF NOT EXISTS idx_essential_info_category 
ON essential_info(category);

-- 4. Enable Row Level Security
ALTER TABLE essential_info ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS policies
-- Policy: Users can view essential_info for their household
CREATE POLICY "Users can view their household essential info"
ON essential_info FOR SELECT
USING (
  household_id IN (
    SELECT household_id FROM users WHERE id = auth.uid()
  )
);

-- Policy: Users can insert essential_info for their household
CREATE POLICY "Users can insert their household essential info"
ON essential_info FOR INSERT
WITH CHECK (
  household_id IN (
    SELECT household_id FROM users WHERE id = auth.uid()
  )
);

-- Policy: Users can update essential_info for their household
CREATE POLICY "Users can update their household essential info"
ON essential_info FOR UPDATE
USING (
  household_id IN (
    SELECT household_id FROM users WHERE id = auth.uid()
  )
);

-- Policy: Users can delete essential_info for their household
CREATE POLICY "Users can delete their household essential info"
ON essential_info FOR DELETE
USING (
  household_id IN (
    SELECT household_id FROM users WHERE id = auth.uid()
  )
);

-- 6. Enable realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE essential_info;

