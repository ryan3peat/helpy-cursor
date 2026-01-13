-- Migration: Add food_allowance to salary_slips table
-- This allows us to snapshot the food allowance at the time of slip creation
-- for accurate historical records (in case contract terms change later)

-- Add food_allowance column to salary_slips
ALTER TABLE salary_slips 
ADD COLUMN IF NOT EXISTS food_allowance INTEGER NOT NULL DEFAULT 0;

-- Update existing slips to pull food_allowance from their contracts
UPDATE salary_slips s
SET food_allowance = COALESCE(
  (SELECT hc.food_allowance FROM helper_contracts hc WHERE hc.id = s.contract_id),
  0
)
WHERE s.contract_id IS NOT NULL;

-- Recalculate total_payout for existing slips to include food_allowance
UPDATE salary_slips
SET total_payout = base_salary + food_allowance + extra_salary + salary_deduction;

