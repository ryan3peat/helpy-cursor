-- ============================================================================
-- Migration: 065_salary_slip_system
-- Description: New salary slip system with helper contracts
-- 
-- This migration:
-- 1. Creates helper_contracts table (employment terms)
-- 2. Creates salary_slips table (payment records)
-- 3. Migrates existing helper data from users table
-- 4. Sets up RLS with helper privacy (helpers can only see their own slips)
-- 5. Drops old helper_holiday_records and helper_payslip_confirmations tables
-- 
-- Run this in Supabase Dashboard > SQL Editor
-- ============================================================================

-- ============================================================================
-- PART 1: Create helper_contracts table
-- ============================================================================
CREATE TABLE IF NOT EXISTS helper_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'terminated')),
  employment_start_date DATE NOT NULL,
  base_salary INTEGER NOT NULL DEFAULT 0,
  food_allowance INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, household_id)
);

CREATE INDEX IF NOT EXISTS idx_helper_contracts_household ON helper_contracts(household_id);
CREATE INDEX IF NOT EXISTS idx_helper_contracts_user ON helper_contracts(user_id);

ALTER TABLE helper_contracts ENABLE ROW LEVEL SECURITY;

-- RLS: Users can view contracts in their household
DROP POLICY IF EXISTS "helper_contracts_select" ON helper_contracts;
CREATE POLICY "helper_contracts_select"
ON helper_contracts FOR SELECT
USING (
  household_id = get_user_household_id()
  OR is_superadmin()
);

-- RLS: Non-helpers can insert contracts
DROP POLICY IF EXISTS "helper_contracts_insert" ON helper_contracts;
CREATE POLICY "helper_contracts_insert"
ON helper_contracts FOR INSERT
WITH CHECK (
  (
    household_id = get_user_household_id()
    AND EXISTS (
      SELECT 1 FROM users 
      WHERE clerk_id = get_clerk_id() 
      AND role IN ('SuperAdmin', 'Admin', 'Spouse')
    )
  )
  OR is_superadmin()
);

-- RLS: Non-helpers can update contracts
DROP POLICY IF EXISTS "helper_contracts_update" ON helper_contracts;
CREATE POLICY "helper_contracts_update"
ON helper_contracts FOR UPDATE
USING (
  (
    household_id = get_user_household_id()
    AND EXISTS (
      SELECT 1 FROM users 
      WHERE clerk_id = get_clerk_id() 
      AND role IN ('SuperAdmin', 'Admin', 'Spouse')
    )
  )
  OR is_superadmin()
);

-- RLS: Non-helpers can delete contracts
DROP POLICY IF EXISTS "helper_contracts_delete" ON helper_contracts;
CREATE POLICY "helper_contracts_delete"
ON helper_contracts FOR DELETE
USING (
  (
    household_id = get_user_household_id()
    AND EXISTS (
      SELECT 1 FROM users 
      WHERE clerk_id = get_clerk_id() 
      AND role IN ('SuperAdmin', 'Admin', 'Spouse')
    )
  )
  OR is_superadmin()
);

-- ============================================================================
-- PART 2: Create salary_slips table
-- ============================================================================
CREATE TABLE IF NOT EXISTS salary_slips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  helper_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  contract_id UUID REFERENCES helper_contracts(id) ON DELETE SET NULL,
  payment_period_start DATE NOT NULL,
  payment_period_end DATE NOT NULL,
  base_salary INTEGER NOT NULL DEFAULT 0,
  extra_salary INTEGER NOT NULL DEFAULT 0,
  salary_deduction INTEGER NOT NULL DEFAULT 0,
  total_payout INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  employer_signer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  employer_signer_name TEXT,
  employer_signed_at TIMESTAMPTZ,
  helper_signed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  -- Constraint: end date must be >= start date
  CONSTRAINT valid_payment_period CHECK (payment_period_end >= payment_period_start)
);

CREATE INDEX IF NOT EXISTS idx_salary_slips_household ON salary_slips(household_id);
CREATE INDEX IF NOT EXISTS idx_salary_slips_helper ON salary_slips(helper_id);
CREATE INDEX IF NOT EXISTS idx_salary_slips_dates ON salary_slips(payment_period_start, payment_period_end);

ALTER TABLE salary_slips ENABLE ROW LEVEL SECURITY;

-- RLS: CRITICAL - Helpers can ONLY see their own slips, others can see all in household
DROP POLICY IF EXISTS "salary_slips_select" ON salary_slips;
CREATE POLICY "salary_slips_select"
ON salary_slips FOR SELECT
USING (
  (
    household_id = get_user_household_id()
    AND (
      -- Non-helpers (Admin/Spouse) can see all slips in their household
      EXISTS (
        SELECT 1 FROM users 
        WHERE clerk_id = get_clerk_id() 
        AND role IN ('SuperAdmin', 'Admin', 'Spouse')
      )
      OR
      -- Helpers can ONLY see their own slips
      helper_id = (
        SELECT id FROM users WHERE clerk_id = get_clerk_id()
      )
    )
  )
  OR is_superadmin()
);

-- RLS: Non-helpers can insert slips
DROP POLICY IF EXISTS "salary_slips_insert" ON salary_slips;
CREATE POLICY "salary_slips_insert"
ON salary_slips FOR INSERT
WITH CHECK (
  (
    household_id = get_user_household_id()
    AND EXISTS (
      SELECT 1 FROM users 
      WHERE clerk_id = get_clerk_id() 
      AND role IN ('SuperAdmin', 'Admin', 'Spouse')
    )
  )
  OR is_superadmin()
);

-- RLS: Update allowed for signing (helpers can sign their own, admins can sign any)
DROP POLICY IF EXISTS "salary_slips_update" ON salary_slips;
CREATE POLICY "salary_slips_update"
ON salary_slips FOR UPDATE
USING (
  (
    household_id = get_user_household_id()
    AND (
      -- Non-helpers can update any slip
      EXISTS (
        SELECT 1 FROM users 
        WHERE clerk_id = get_clerk_id() 
        AND role IN ('SuperAdmin', 'Admin', 'Spouse')
      )
      OR
      -- Helpers can update their own (for signing)
      helper_id = (
        SELECT id FROM users WHERE clerk_id = get_clerk_id()
      )
    )
  )
  OR is_superadmin()
);

-- RLS: Only non-helpers can delete slips
DROP POLICY IF EXISTS "salary_slips_delete" ON salary_slips;
CREATE POLICY "salary_slips_delete"
ON salary_slips FOR DELETE
USING (
  (
    household_id = get_user_household_id()
    AND EXISTS (
      SELECT 1 FROM users 
      WHERE clerk_id = get_clerk_id() 
      AND role IN ('SuperAdmin', 'Admin', 'Spouse')
    )
  )
  OR is_superadmin()
);

-- ============================================================================
-- PART 3: Migrate existing helper data from users table to helper_contracts
-- ============================================================================
INSERT INTO helper_contracts (user_id, household_id, status, employment_start_date, base_salary, food_allowance)
SELECT 
  id as user_id,
  household_id,
  'active' as status,
  COALESCE(helper_start_date, CURRENT_DATE) as employment_start_date,
  COALESCE(helper_base_salary, 0) as base_salary,
  COALESCE(helper_food_allowance, 0) as food_allowance
FROM users
WHERE role = 'Helper'
  AND helper_start_date IS NOT NULL
ON CONFLICT (user_id, household_id) DO NOTHING;

-- ============================================================================
-- PART 4: Enable realtime for new tables
-- ============================================================================
DO $$
BEGIN
  -- Add helper_contracts to realtime publication if not already added
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'helper_contracts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE helper_contracts;
  END IF;
  
  -- Add salary_slips to realtime publication if not already added
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'salary_slips'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE salary_slips;
  END IF;
END $$;

-- ============================================================================
-- PART 5: Drop old helper management tables
-- ============================================================================
-- First remove from realtime publication
DO $$
BEGIN
  -- Remove helper_holiday_records from publication if exists
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'helper_holiday_records'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE helper_holiday_records;
  END IF;
  
  -- Remove helper_payslip_confirmations from publication if exists
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'helper_payslip_confirmations'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE helper_payslip_confirmations;
  END IF;
END $$;

-- Drop old tables (CASCADE will drop their policies and indexes)
DROP TABLE IF EXISTS helper_holiday_records CASCADE;
DROP TABLE IF EXISTS helper_payslip_confirmations CASCADE;

-- ============================================================================
-- PART 6: Remove old helper columns from users table
-- (Keeping this commented - run separately after verifying migration worked)
-- ============================================================================
-- ALTER TABLE users DROP COLUMN IF EXISTS helper_start_date;
-- ALTER TABLE users DROP COLUMN IF EXISTS helper_base_salary;
-- ALTER TABLE users DROP COLUMN IF EXISTS helper_food_allowance;
-- ALTER TABLE users DROP COLUMN IF EXISTS helper_other_allowances;

-- ============================================================================
-- Verification queries (run these after migration to verify)
-- ============================================================================
-- SELECT 'helper_contracts' as table_name, COUNT(*) as row_count FROM helper_contracts
-- UNION ALL
-- SELECT 'salary_slips', COUNT(*) FROM salary_slips;

-- SELECT tablename, policyname FROM pg_policies 
-- WHERE tablename IN ('helper_contracts', 'salary_slips');

