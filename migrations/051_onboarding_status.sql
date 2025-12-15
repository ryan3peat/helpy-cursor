-- Migration: Add onboarding_status column to users table
-- This tracks whether each user has completed the onboarding tutorial
-- NOTE: This migration ONLY adds a column. It does NOT modify any RLS policies.

-- Add the onboarding_status column with a check constraint
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS onboarding_status TEXT DEFAULT 'not_started' 
CHECK (onboarding_status IN ('not_started', 'skipped', 'completed'));

-- Set existing users to 'completed' since they've already been using the app
UPDATE users 
SET onboarding_status = 'completed' 
WHERE onboarding_status IS NULL OR onboarding_status = 'not_started';

-- Add a comment for documentation
COMMENT ON COLUMN users.onboarding_status IS 'Tracks onboarding tutorial status: not_started, skipped, or completed';

