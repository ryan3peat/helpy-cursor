-- ============================================================================
-- Migration: 065_pwa_installations
-- Description: Track PWA installations per user per device
-- 
-- This allows us to:
-- 1. Know if a user has already installed Helpy as PWA on a specific device
-- 2. Not show the "Add to Home Screen" prompt in browser if already installed
-- 3. Track installation across multiple devices for the same user
--
-- HOW TO RUN:
-- 1. Go to Supabase Dashboard
-- 2. Navigate to SQL Editor
-- 3. Paste this entire file
-- 4. Click "Run"
-- ============================================================================


-- ============================================================================
-- CREATE PWA_INSTALLATIONS TABLE
-- ============================================================================
-- Stores which devices have installed the PWA for each user
-- device_id comes from localStorage (see utils/pwaUtils.ts getDeviceId())
-- ============================================================================

CREATE TABLE IF NOT EXISTS pwa_installations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,  -- UUID from localStorage (persistent per browser)
  user_agent TEXT,          -- Browser/device info for debugging
  platform TEXT,            -- 'ios', 'android', 'desktop'
  installed_at TIMESTAMPTZ DEFAULT NOW(),
  -- One installation record per user per device
  UNIQUE(user_id, device_id)
);

-- Index for faster lookups by user + device
CREATE INDEX IF NOT EXISTS idx_pwa_installations_user_device 
ON pwa_installations(user_id, device_id);

-- Index for household-level queries
CREATE INDEX IF NOT EXISTS idx_pwa_installations_household 
ON pwa_installations(household_id);


-- ============================================================================
-- RLS POLICIES
-- ============================================================================
-- Allow users to read their own installations and insert new ones
-- ============================================================================

ALTER TABLE pwa_installations ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read installations for their household
CREATE POLICY "Users can read household installations" ON pwa_installations 
FOR SELECT USING (
  household_id IN (
    SELECT household_id FROM users 
    WHERE clerk_id = auth.jwt() ->> 'sub'
  )
);

-- Allow authenticated users to insert their own installations
CREATE POLICY "Users can insert own installations" ON pwa_installations 
FOR INSERT WITH CHECK (
  user_id IN (
    SELECT id FROM users 
    WHERE clerk_id = auth.jwt() ->> 'sub'
  )
);

-- Allow authenticated users to update their own installations
CREATE POLICY "Users can update own installations" ON pwa_installations 
FOR UPDATE USING (
  user_id IN (
    SELECT id FROM users 
    WHERE clerk_id = auth.jwt() ->> 'sub'
  )
);

-- Allow authenticated users to delete their own installations
CREATE POLICY "Users can delete own installations" ON pwa_installations 
FOR DELETE USING (
  user_id IN (
    SELECT id FROM users 
    WHERE clerk_id = auth.jwt() ->> 'sub'
  )
);


-- ============================================================================
-- VERIFICATION
-- ============================================================================

SELECT '=== PWA_INSTALLATIONS TABLE CREATED ===' as section;
SELECT 
  column_name, 
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'pwa_installations'
ORDER BY ordinal_position;

SELECT '=== RLS ENABLED ===' as section;
SELECT relname, relrowsecurity 
FROM pg_class 
WHERE relname = 'pwa_installations';

SELECT '=== RLS POLICIES ===' as section;
SELECT policyname, cmd 
FROM pg_policies 
WHERE tablename = 'pwa_installations';


-- ============================================================================
-- DONE!
-- 
-- Next steps:
-- 1. The app will automatically record installations when running as PWA
-- 2. The install prompt will check this table before showing
-- ============================================================================

