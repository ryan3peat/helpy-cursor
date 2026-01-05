-- Migration: Add completed_at column to todo_items
-- This tracks when items were marked as completed for proper sorting in suggestions

-- Add completed_at column
ALTER TABLE todo_items 
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Backfill: Set completed_at to created_at + 24 hours for already completed items
-- (One-time patch for historical data created before Jan 6, 2026 01:00 HKT)
UPDATE todo_items 
SET completed_at = created_at + INTERVAL '24 hours'
WHERE completed = true 
  AND completed_at IS NULL
  AND created_at < '2026-01-06T01:00:00+08:00';

-- Add index for efficient querying of completed items by date
CREATE INDEX IF NOT EXISTS idx_todo_items_completed_at 
ON todo_items (household_id, completed_at DESC) 
WHERE completed = true;

