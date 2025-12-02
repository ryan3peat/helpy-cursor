-- Migration: Create training_modules table
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor > New Query)

-- 1. Create the table
CREATE TABLE IF NOT EXISTS training_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES households(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  custom_category TEXT, -- For "Others" category with custom entry
  name TEXT NOT NULL,
  content TEXT,
  assignee_id UUID REFERENCES users(id) ON DELETE SET NULL,
  is_completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  points INTEGER DEFAULT 10, -- Points awarded on completion
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create index for faster household queries
CREATE INDEX IF NOT EXISTS idx_training_modules_household 
ON training_modules(household_id);

-- 3. Create index for assignee filtering
CREATE INDEX IF NOT EXISTS idx_training_modules_assignee 
ON training_modules(assignee_id);

-- 4. Create index for category filtering
CREATE INDEX IF NOT EXISTS idx_training_modules_category 
ON training_modules(category);

-- 5. Enable Row Level Security
ALTER TABLE training_modules ENABLE ROW LEVEL SECURITY;

-- 6. Create RLS policies
-- Policy: Users can view training_modules for their household
CREATE POLICY "Users can view their household training modules"
ON training_modules FOR SELECT
USING (
  household_id IN (
    SELECT household_id FROM users WHERE id = auth.uid()
  )
);

-- Policy: Users can insert training_modules for their household
CREATE POLICY "Users can insert their household training modules"
ON training_modules FOR INSERT
WITH CHECK (
  household_id IN (
    SELECT household_id FROM users WHERE id = auth.uid()
  )
);

-- Policy: Users can update training_modules for their household
CREATE POLICY "Users can update their household training modules"
ON training_modules FOR UPDATE
USING (
  household_id IN (
    SELECT household_id FROM users WHERE id = auth.uid()
  )
);

-- Policy: Users can delete training_modules for their household
CREATE POLICY "Users can delete their household training modules"
ON training_modules FOR DELETE
USING (
  household_id IN (
    SELECT household_id FROM users WHERE id = auth.uid()
  )
);

-- 7. Enable realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE training_modules;

-- 8. Create helper_points table for gamification
CREATE TABLE IF NOT EXISTS helper_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  total_points INTEGER DEFAULT 0,
  trainings_completed INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Create index for user lookup
CREATE INDEX IF NOT EXISTS idx_helper_points_user 
ON helper_points(user_id);

-- 10. Enable RLS for helper_points
ALTER TABLE helper_points ENABLE ROW LEVEL SECURITY;

-- 11. RLS policies for helper_points
CREATE POLICY "Users can view helper points in their household"
ON helper_points FOR SELECT
USING (
  user_id IN (
    SELECT id FROM users WHERE household_id IN (
      SELECT household_id FROM users WHERE id = auth.uid()
    )
  )
);

CREATE POLICY "Users can update their own points"
ON helper_points FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own points"
ON helper_points FOR INSERT
WITH CHECK (user_id = auth.uid());

-- 12. Enable realtime for helper_points
ALTER PUBLICATION supabase_realtime ADD TABLE helper_points;

