-- Migration: Add usage-based trial limits for new households
-- This allows new free-plan users to access premium features with usage limits:
-- - AI Receipt Scanner: 5 free scans
-- - Salary Slip E-sign: 1 free signature
-- - Monthly Spending Summary: 14 days

-- Add trial_started_at column for time-based features (spending summary)
-- This tracks when the household was created for the 14-day spending summary trial
ALTER TABLE households 
ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ;

-- Add usage counters for count-based features
ALTER TABLE households 
ADD COLUMN IF NOT EXISTS ai_scan_count INTEGER DEFAULT 0;

ALTER TABLE households 
ADD COLUMN IF NOT EXISTS salary_slip_sign_count INTEGER DEFAULT 0;

-- Backfill existing households with their created_at date
-- This ensures existing households don't suddenly get a new trial period
-- (their trial would have already "expired" based on created_at)
UPDATE households 
SET trial_started_at = created_at 
WHERE trial_started_at IS NULL;

-- Ensure usage counters are initialized for existing households
UPDATE households 
SET ai_scan_count = 0 
WHERE ai_scan_count IS NULL;

UPDATE households 
SET salary_slip_sign_count = 0 
WHERE salary_slip_sign_count IS NULL;

-- Add comments for documentation
COMMENT ON COLUMN households.trial_started_at IS 'Timestamp when the household was created. Used for 14-day spending summary trial period.';
COMMENT ON COLUMN households.ai_scan_count IS 'Number of AI receipt scans used. Free plan allows 5 scans.';
COMMENT ON COLUMN households.salary_slip_sign_count IS 'Number of salary slip signatures used. Free plan allows 1 signature.';
