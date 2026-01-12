-- ============================================================================
-- Migration 077: Add preset_id column to practices table
-- This allows tracking which Practice items came from suggested presets
-- ============================================================================

-- Add the preset_id column (nullable, as existing items won't have it)
ALTER TABLE practices ADD COLUMN IF NOT EXISTS preset_id TEXT;

-- Create an index for faster lookups when filtering available presets
CREATE INDEX IF NOT EXISTS idx_practices_preset_id ON practices(preset_id) WHERE preset_id IS NOT NULL;

-- Add a comment explaining the column
COMMENT ON COLUMN practices.preset_id IS 'Links to a preset template ID (e.g., hk-safety-01). Used to track which suggested ideas have been added.';

