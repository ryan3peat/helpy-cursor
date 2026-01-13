-- ============================================================================
-- Migration 068: Remove redundant helper columns from users table
-- These columns have been migrated to helper_contracts table (migration 065)
-- ============================================================================

-- Safety check: Verify helper_contracts has the data
DO $$
DECLARE
  user_count INTEGER;
  contract_count INTEGER;
BEGIN
  -- Count helpers with salary data in users table
  SELECT COUNT(*) INTO user_count
  FROM users 
  WHERE role = 'Helper' 
  AND (helper_base_salary IS NOT NULL AND helper_base_salary > 0);
  
  -- Count contracts
  SELECT COUNT(*) INTO contract_count FROM helper_contracts;
  
  RAISE NOTICE 'Users with helper salary data: %, Helper contracts: %', user_count, contract_count;
  
  -- Only proceed if contracts exist or no users have salary data
  IF user_count > 0 AND contract_count = 0 THEN
    RAISE EXCEPTION 'ABORT: Helper salary data exists in users table but no contracts found. Run migration 065 first.';
  END IF;
END $$;

-- Drop the old columns
ALTER TABLE users DROP COLUMN IF EXISTS helper_start_date;
ALTER TABLE users DROP COLUMN IF EXISTS helper_base_salary;
ALTER TABLE users DROP COLUMN IF EXISTS helper_food_allowance;
ALTER TABLE users DROP COLUMN IF EXISTS helper_other_allowances;

-- Log completion
DO $$
BEGIN
  RAISE NOTICE '✅ Successfully removed old helper columns from users table';
END $$;

