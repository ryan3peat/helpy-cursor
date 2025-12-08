-- Migration: Add currency field to expenses table
-- Purpose: Support multi-currency expenses (HKD default for Hong Kong launch)
-- Future: Will support USD, SGD, PHP, etc. when expanding to other markets

-- Add currency column with HKD as default
ALTER TABLE expenses 
ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'HKD' NOT NULL;

-- Update all existing expenses to HKD (in case any have NULL)
UPDATE expenses 
SET currency = 'HKD' 
WHERE currency IS NULL OR currency = '';

-- Add comment for documentation
COMMENT ON COLUMN expenses.currency IS 'ISO 4217 currency code (e.g., HKD, USD). Defaults to HKD for Hong Kong market.';

-- Create index for potential future filtering by currency
CREATE INDEX IF NOT EXISTS idx_expenses_currency ON expenses(currency);

