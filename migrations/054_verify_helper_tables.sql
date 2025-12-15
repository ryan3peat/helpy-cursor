-- ============================================================================
-- Migration: 054_verify_helper_tables
-- Description: Verify helper management tables exist and have correct structure
-- ============================================================================

-- ============================================================================
-- PART 1: Check if tables exist
-- ============================================================================
SELECT 
  'Table Check' as check_type,
  table_name,
  CASE 
    WHEN table_name IS NOT NULL THEN '✅ Table exists'
    ELSE '❌ Table missing'
  END as status
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('hk_statutory_holidays', 'helper_holiday_records', 'helper_payslip_confirmations')
ORDER BY table_name;

-- ============================================================================
-- PART 2: Check helper_holiday_records columns
-- ============================================================================
SELECT 
  'helper_holiday_records columns' as check_type,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'helper_holiday_records'
ORDER BY ordinal_position;

-- ============================================================================
-- PART 3: Check helper_payslip_confirmations columns
-- ============================================================================
SELECT 
  'helper_payslip_confirmations columns' as check_type,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'helper_payslip_confirmations'
ORDER BY ordinal_position;

-- ============================================================================
-- PART 4: Check RLS policies on helper tables
-- ============================================================================
SELECT
  'RLS Policies' as check_type,
  tablename,
  policyname,
  cmd as command,
  permissive
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('helper_holiday_records', 'helper_payslip_confirmations')
ORDER BY tablename, policyname;

-- ============================================================================
-- PART 5: Check if hk_statutory_holidays has data
-- ============================================================================
SELECT 
  'Holiday Data' as check_type,
  year,
  COUNT(*) as holiday_count
FROM hk_statutory_holidays
GROUP BY year
ORDER BY year;

-- ============================================================================
-- PART 6: If tables are missing, CREATE them here (safe - uses IF NOT EXISTS)
-- ============================================================================

-- Create hk_statutory_holidays if missing
CREATE TABLE IF NOT EXISTS hk_statutory_holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INTEGER NOT NULL,
  holiday_name TEXT NOT NULL,
  holiday_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(year, holiday_date)
);

-- Create helper_holiday_records if missing
CREATE TABLE IF NOT EXISTS helper_holiday_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES households(id) ON DELETE CASCADE,
  helper_id UUID REFERENCES users(id) ON DELETE CASCADE,
  holiday_date DATE NOT NULL,
  holiday_name TEXT NOT NULL,
  is_working BOOLEAN DEFAULT false,
  compensation_type TEXT CHECK (compensation_type IN ('lieu', 'overtime', NULL)),
  overtime_amount INTEGER DEFAULT 0,
  add_overtime_to_payslip BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(household_id, helper_id, holiday_date)
);

-- Create helper_payslip_confirmations if missing
CREATE TABLE IF NOT EXISTS helper_payslip_confirmations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES households(id) ON DELETE CASCADE,
  helper_id UUID REFERENCES users(id) ON DELETE CASCADE,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  year INTEGER NOT NULL,
  salary_amount INTEGER NOT NULL,
  overtime_total INTEGER DEFAULT 0,
  employer_signed_at TIMESTAMPTZ,
  employer_user_id UUID REFERENCES users(id),
  helper_signed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(household_id, helper_id, month, year)
);

-- ============================================================================
-- PART 7: Add missing columns from migration 053 (safe - uses IF NOT EXISTS)
-- ============================================================================
ALTER TABLE helper_holiday_records
ADD COLUMN IF NOT EXISTS overtime_amount INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS add_overtime_to_payslip BOOLEAN DEFAULT FALSE;

ALTER TABLE helper_payslip_confirmations
ADD COLUMN IF NOT EXISTS overtime_total INTEGER DEFAULT 0;

-- ============================================================================
-- PART 8: Create indexes if missing
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_helper_holiday_records_household 
ON helper_holiday_records(household_id);

CREATE INDEX IF NOT EXISTS idx_helper_holiday_records_helper 
ON helper_holiday_records(helper_id);

CREATE INDEX IF NOT EXISTS idx_helper_payslip_household 
ON helper_payslip_confirmations(household_id);

CREATE INDEX IF NOT EXISTS idx_helper_payslip_helper 
ON helper_payslip_confirmations(helper_id);

-- ============================================================================
-- PART 9: Enable RLS if not enabled
-- ============================================================================
ALTER TABLE helper_holiday_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE helper_payslip_confirmations ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PART 10: Create RLS policies if they don't exist
-- ============================================================================
DO $$
BEGIN
  -- helper_holiday_records policies
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'helper_holiday_records' 
    AND policyname = 'Users can view their household helper holiday records'
  ) THEN
    CREATE POLICY "Users can view their household helper holiday records"
    ON helper_holiday_records FOR SELECT
    USING (household_id = get_user_household_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'helper_holiday_records' 
    AND policyname = 'Users can insert their household helper holiday records'
  ) THEN
    CREATE POLICY "Users can insert their household helper holiday records"
    ON helper_holiday_records FOR INSERT
    WITH CHECK (household_id = get_user_household_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'helper_holiday_records' 
    AND policyname = 'Users can update their household helper holiday records'
  ) THEN
    CREATE POLICY "Users can update their household helper holiday records"
    ON helper_holiday_records FOR UPDATE
    USING (household_id = get_user_household_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'helper_holiday_records' 
    AND policyname = 'Users can delete their household helper holiday records'
  ) THEN
    CREATE POLICY "Users can delete their household helper holiday records"
    ON helper_holiday_records FOR DELETE
    USING (household_id = get_user_household_id());
  END IF;

  -- helper_payslip_confirmations policies
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'helper_payslip_confirmations' 
    AND policyname = 'Users can view their household payslip confirmations'
  ) THEN
    CREATE POLICY "Users can view their household payslip confirmations"
    ON helper_payslip_confirmations FOR SELECT
    USING (household_id = get_user_household_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'helper_payslip_confirmations' 
    AND policyname = 'Users can insert their household payslip confirmations'
  ) THEN
    CREATE POLICY "Users can insert their household payslip confirmations"
    ON helper_payslip_confirmations FOR INSERT
    WITH CHECK (household_id = get_user_household_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'helper_payslip_confirmations' 
    AND policyname = 'Users can update their household payslip confirmations'
  ) THEN
    CREATE POLICY "Users can update their household payslip confirmations"
    ON helper_payslip_confirmations FOR UPDATE
    USING (household_id = get_user_household_id());
  END IF;
END $$;

-- ============================================================================
-- PART 11: Add tables to realtime publication (if not already added)
-- ============================================================================
DO $$
BEGIN
  -- Try to add to publication, ignore if already exists
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE helper_holiday_records;
  EXCEPTION WHEN duplicate_object THEN
    NULL; -- Already in publication
  END;
  
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE helper_payslip_confirmations;
  EXCEPTION WHEN duplicate_object THEN
    NULL; -- Already in publication
  END;
END $$;

-- ============================================================================
-- PART 12: Insert 2025 holidays if not present
-- ============================================================================
INSERT INTO hk_statutory_holidays (year, holiday_name, holiday_date) VALUES
  (2025, 'New Year''s Day', '2025-01-01'),
  (2025, 'Lunar New Year''s Day', '2025-01-29'),
  (2025, 'Second day of Lunar New Year', '2025-01-30'),
  (2025, 'Third day of Lunar New Year', '2025-01-31'),
  (2025, 'Ching Ming Festival', '2025-04-04'),
  (2025, 'Good Friday', '2025-04-18'),
  (2025, 'Labour Day', '2025-05-01'),
  (2025, 'Buddha''s Birthday', '2025-05-05'),
  (2025, 'Tuen Ng Festival', '2025-05-31'),
  (2025, 'Hong Kong SAR Establishment Day', '2025-07-01'),
  (2025, 'Day following Mid-Autumn Festival', '2025-10-07'),
  (2025, 'National Day', '2025-10-01'),
  (2025, 'Chung Yeung Festival', '2025-10-29'),
  (2025, 'Winter Solstice/Christmas', '2025-12-25'),
  (2025, 'First weekday after Christmas', '2025-12-26')
ON CONFLICT (year, holiday_date) DO NOTHING;

-- Insert 2026 holidays
INSERT INTO hk_statutory_holidays (year, holiday_name, holiday_date) VALUES
  (2026, 'New Year''s Day', '2026-01-01'),
  (2026, 'Lunar New Year''s Day', '2026-02-17'),
  (2026, 'Second day of Lunar New Year', '2026-02-18'),
  (2026, 'Third day of Lunar New Year', '2026-02-19'),
  (2026, 'Ching Ming Festival', '2026-04-05'),
  (2026, 'Easter Monday', '2026-04-06'),
  (2026, 'Labour Day', '2026-05-01'),
  (2026, 'Buddha''s Birthday', '2026-05-24'),
  (2026, 'Tuen Ng Festival', '2026-06-19'),
  (2026, 'Hong Kong SAR Establishment Day', '2026-07-01'),
  (2026, 'Day following Mid-Autumn Festival', '2026-09-26'),
  (2026, 'National Day', '2026-10-01'),
  (2026, 'Chung Yeung Festival', '2026-10-18'),
  (2026, 'Winter Solstice/Christmas', '2026-12-25'),
  (2026, 'First weekday after Christmas', '2026-12-26')
ON CONFLICT (year, holiday_date) DO NOTHING;

-- ============================================================================
-- PART 13: Final verification
-- ============================================================================
SELECT 
  'Final Check' as check_type,
  (SELECT COUNT(*) FROM hk_statutory_holidays) as holidays_count,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'helper_holiday_records') as holiday_records_columns,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'helper_payslip_confirmations') as payslip_columns,
  (SELECT COUNT(*) FROM pg_policies WHERE tablename IN ('helper_holiday_records', 'helper_payslip_confirmations')) as rls_policies_count;

