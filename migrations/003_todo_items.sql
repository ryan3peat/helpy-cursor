-- ============================================================================
-- Migration: 003_todo_items
-- Description: Create unified todo_items table for Shopping and Tasks
-- ============================================================================

-- Create the todo_items table
CREATE TABLE IF NOT EXISTS todo_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id UUID REFERENCES households(id) ON DELETE CASCADE,
  
  -- Common fields
  type TEXT NOT NULL CHECK (type IN ('shopping', 'task')),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  assignee_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Shopping-specific fields
  quantity TEXT DEFAULT '1',
  unit TEXT,
  
  -- Task-specific fields
  due_date DATE,
  due_time TIME,
  recurrence JSONB  -- { frequency: 'NONE'|'DAILY'|'WEEKLY'|'MONTHLY', dayOfWeek?: 0-6, dayOfMonth?: 1-31 }
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_todo_items_household ON todo_items(household_id);
CREATE INDEX IF NOT EXISTS idx_todo_items_type ON todo_items(type);
CREATE INDEX IF NOT EXISTS idx_todo_items_completed ON todo_items(completed);
CREATE INDEX IF NOT EXISTS idx_todo_items_assignee ON todo_items(assignee_id);
CREATE INDEX IF NOT EXISTS idx_todo_items_due_date ON todo_items(due_date) WHERE type = 'task';

-- Enable Row Level Security
ALTER TABLE todo_items ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see todo items from their household
CREATE POLICY "Users can view their household todo items"
  ON todo_items FOR SELECT
  USING (household_id IN (
    SELECT household_id FROM users WHERE id = auth.uid()
  ));

-- RLS Policy: Users can insert todo items to their household
CREATE POLICY "Users can insert todo items to their household"
  ON todo_items FOR INSERT
  WITH CHECK (household_id IN (
    SELECT household_id FROM users WHERE id = auth.uid()
  ));

-- RLS Policy: Users can update todo items in their household
CREATE POLICY "Users can update their household todo items"
  ON todo_items FOR UPDATE
  USING (household_id IN (
    SELECT household_id FROM users WHERE id = auth.uid()
  ));

-- RLS Policy: Users can delete todo items from their household
CREATE POLICY "Users can delete their household todo items"
  ON todo_items FOR DELETE
  USING (household_id IN (
    SELECT household_id FROM users WHERE id = auth.uid()
  ));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE todo_items;

-- ============================================================================
-- OPTIONAL: Migrate existing data from shopping and tasks tables
-- Uncomment and run if you have existing data to migrate
-- ============================================================================

/*
-- Migrate shopping items
INSERT INTO todo_items (household_id, type, name, category, completed, quantity, created_at)
SELECT 
  household_id,
  'shopping' as type,
  name,
  category,
  completed,
  quantity,
  created_at
FROM shopping;

-- Migrate tasks
INSERT INTO todo_items (household_id, type, name, category, completed, assignee_id, due_date, due_time, recurrence, created_at)
SELECT 
  household_id,
  'task' as type,
  title as name,
  COALESCE(category, 'Others') as category,
  completed,
  (SELECT unnest(assignees) LIMIT 1) as assignee_id,
  due_date::DATE,
  due_time::TIME,
  recurrence,
  created_at
FROM tasks;
*/

