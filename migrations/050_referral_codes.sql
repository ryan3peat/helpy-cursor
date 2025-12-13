-- ============================================================================
-- Migration: 050_referral_codes
-- Description: Add referral code system for agency partnerships
-- ============================================================================

-- Partner agencies table
CREATE TABLE IF NOT EXISTS partner_agencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code_prefix TEXT NOT NULL UNIQUE, -- e.g., 'BETTY' for BETTY30DAYS
  commission_rate DECIMAL(5,2) DEFAULT 25.00,
  contact_email TEXT,
  contact_name TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'terminated')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Referral codes table
CREATE TABLE IF NOT EXISTS referral_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID REFERENCES partner_agencies(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE, -- e.g., 'BETTY30DAYS'
  description TEXT,
  trial_days INTEGER DEFAULT 30,
  discount_percent INTEGER DEFAULT 0, -- Optional additional discount
  is_active BOOLEAN DEFAULT true,
  usage_count INTEGER DEFAULT 0,
  max_uses INTEGER, -- NULL = unlimited
  valid_from TIMESTAMPTZ DEFAULT NOW(),
  valid_until TIMESTAMPTZ, -- NULL = no expiry
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Track which households used which referral codes
CREATE TABLE IF NOT EXISTS referral_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_code_id UUID REFERENCES referral_codes(id) ON DELETE SET NULL,
  agency_id UUID REFERENCES partner_agencies(id) ON DELETE SET NULL,
  household_id UUID REFERENCES households(id) ON DELETE CASCADE,
  code_used TEXT NOT NULL, -- Store the actual code used
  trial_started_at TIMESTAMPTZ,
  trial_ends_at TIMESTAMPTZ,
  converted_to_paid_at TIMESTAMPTZ, -- When they became a paying customer
  subscription_plan TEXT, -- core, pro
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add trial tracking columns to households table
ALTER TABLE households
ADD COLUMN IF NOT EXISTS is_trial BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS referral_code_used TEXT,
ADD COLUMN IF NOT EXISTS referred_by_agency_id UUID REFERENCES partner_agencies(id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_referral_codes_code ON referral_codes(code);
CREATE INDEX IF NOT EXISTS idx_referral_codes_active ON referral_codes(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_referral_usage_household ON referral_usage(household_id);
CREATE INDEX IF NOT EXISTS idx_households_trial ON households(is_trial) WHERE is_trial = true;

-- Insert Betty agency and referral code
INSERT INTO partner_agencies (name, code_prefix, commission_rate, contact_email, status)
VALUES ('Betty Employment Agency', 'BETTY', 25.00, 'contact@betty.com.hk', 'active')
ON CONFLICT (code_prefix) DO NOTHING;

-- Insert BETTY30DAYS referral code
INSERT INTO referral_codes (agency_id, code, description, trial_days, is_active)
SELECT
  id,
  'BETTY30DAYS',
  'Betty Employment Agency 30-day trial offer',
  30,
  true
FROM partner_agencies
WHERE code_prefix = 'BETTY'
ON CONFLICT (code) DO NOTHING;

-- Enable RLS
ALTER TABLE partner_agencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_usage ENABLE ROW LEVEL SECURITY;

-- RLS Policies (read-only for authenticated users, full access for service role)
CREATE POLICY "Allow read access to active referral codes" ON referral_codes
  FOR SELECT USING (is_active = true);

CREATE POLICY "Allow service role full access to referral_codes" ON referral_codes
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Allow service role full access to partner_agencies" ON partner_agencies
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Allow service role full access to referral_usage" ON referral_usage
  FOR ALL USING (auth.role() = 'service_role');

-- Function to increment referral usage count
CREATE OR REPLACE FUNCTION increment_referral_usage(code_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE referral_codes
  SET usage_count = usage_count + 1
  WHERE id = code_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;