-- ============================================================================
-- Migration: 027_notification_system_cleanup
-- Description: Clean up notification system for production stability
--
-- This migration:
-- 1. Cleans up stale push subscriptions (keeps only newest per user)
-- 2. Removes orphaned user records
-- 3. Adds device fingerprint column for better subscription management
-- 4. Creates cleanup function for ongoing maintenance
--
-- HOW TO RUN:
-- 1. Go to Supabase Dashboard → SQL Editor
-- 2. Paste this entire script
-- 3. Click "Run"
-- ============================================================================


-- ============================================================================
-- STEP 1: Clean up stale push subscriptions
-- Keep only the 2 most recent subscriptions per user (one per device type)
-- ============================================================================

-- First, let's see what we're dealing with (diagnostic - can be removed)
DO $$
DECLARE
  total_before INT;
  total_after INT;
BEGIN
  SELECT COUNT(*) INTO total_before FROM push_subscriptions;
  RAISE NOTICE 'Push subscriptions before cleanup: %', total_before;
END $$;

-- Delete all but the 2 most recent subscriptions per user
DELETE FROM push_subscriptions
WHERE id NOT IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) as rn
    FROM push_subscriptions
  ) ranked
  WHERE rn <= 2
);

DO $$
DECLARE
  total_after INT;
BEGIN
  SELECT COUNT(*) INTO total_after FROM push_subscriptions;
  RAISE NOTICE 'Push subscriptions after cleanup: %', total_after;
END $$;


-- ============================================================================
-- STEP 2: Clean up orphaned users (no email, no clerk_id, pending status)
-- These are leftover invite records that were never completed
-- ============================================================================

DO $$
DECLARE
  orphan_count INT;
BEGIN
  SELECT COUNT(*) INTO orphan_count 
  FROM users 
  WHERE (email IS NULL OR email = '') 
    AND clerk_id IS NULL
    AND status = 'pending';
  RAISE NOTICE 'Orphaned users to be cleaned: %', orphan_count;
END $$;

-- Delete orphaned users (those with no email AND no clerk_id AND pending)
-- These are invite placeholders that were never activated
DELETE FROM users 
WHERE (email IS NULL OR email = '') 
  AND clerk_id IS NULL
  AND status = 'pending'
  AND created_at < NOW() - INTERVAL '7 days';  -- Safety: only delete if older than 7 days

DO $$
DECLARE
  remaining_orphans INT;
BEGIN
  SELECT COUNT(*) INTO remaining_orphans 
  FROM users 
  WHERE (email IS NULL OR email = '') 
    AND clerk_id IS NULL;
  RAISE NOTICE 'Remaining orphaned users (may be recent invites): %', remaining_orphans;
END $$;


-- ============================================================================
-- STEP 3: Add device fingerprint column for better subscription management
-- This allows us to replace subscriptions per device instead of accumulating
-- ============================================================================

ALTER TABLE push_subscriptions 
ADD COLUMN IF NOT EXISTS device_fingerprint TEXT;

-- Create an index for faster lookups by device
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_device 
ON push_subscriptions(user_id, device_fingerprint) 
WHERE device_fingerprint IS NOT NULL;


-- ============================================================================
-- STEP 4: Create automatic cleanup function for ongoing maintenance
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_stale_push_subscriptions()
RETURNS TABLE(deleted_count INT, remaining_count INT) AS $$
DECLARE
  deleted INT;
  remaining INT;
BEGIN
  -- Delete subscriptions not updated in 30 days
  DELETE FROM push_subscriptions
  WHERE updated_at < NOW() - INTERVAL '30 days';
  
  GET DIAGNOSTICS deleted = ROW_COUNT;
  
  -- Also delete excess subscriptions (keep max 3 per user)
  DELETE FROM push_subscriptions
  WHERE id NOT IN (
    SELECT id FROM (
      SELECT id,
             ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY updated_at DESC) as rn
      FROM push_subscriptions
    ) ranked
    WHERE rn <= 3
  );
  
  GET DIAGNOSTICS remaining = ROW_COUNT;
  deleted := deleted + remaining;
  
  SELECT COUNT(*) INTO remaining FROM push_subscriptions;
  
  RETURN QUERY SELECT deleted, remaining;
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- STEP 5: Create upsert function for subscriptions
-- This replaces old subscriptions instead of creating duplicates
-- ============================================================================

CREATE OR REPLACE FUNCTION upsert_push_subscription(
  p_user_id UUID,
  p_household_id UUID,
  p_endpoint TEXT,
  p_p256dh_key TEXT,
  p_auth_key TEXT,
  p_user_agent TEXT DEFAULT NULL,
  p_device_fingerprint TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  result_id UUID;
BEGIN
  -- If device_fingerprint provided, delete all existing for this device first
  IF p_device_fingerprint IS NOT NULL THEN
    DELETE FROM push_subscriptions
    WHERE user_id = p_user_id 
      AND device_fingerprint = p_device_fingerprint
      AND endpoint != p_endpoint;  -- Don't delete if same endpoint (just update)
  END IF;

  -- Upsert the subscription
  INSERT INTO push_subscriptions (
    user_id,
    household_id,
    endpoint,
    p256dh_key,
    auth_key,
    user_agent,
    device_fingerprint,
    updated_at
  ) VALUES (
    p_user_id,
    p_household_id,
    p_endpoint,
    p_p256dh_key,
    p_auth_key,
    p_user_agent,
    p_device_fingerprint,
    NOW()
  )
  ON CONFLICT (user_id, endpoint) 
  DO UPDATE SET
    p256dh_key = EXCLUDED.p256dh_key,
    auth_key = EXCLUDED.auth_key,
    user_agent = EXCLUDED.user_agent,
    device_fingerprint = EXCLUDED.device_fingerprint,
    updated_at = NOW()
  RETURNING id INTO result_id;

  RETURN result_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================================
-- VERIFICATION
-- ============================================================================

SELECT '=== PUSH SUBSCRIPTIONS STATUS ===' as section;
SELECT 
  (SELECT name FROM users WHERE id = user_id) as user_name,
  COUNT(*) as subscription_count,
  MAX(created_at) as newest
FROM push_subscriptions 
GROUP BY user_id
ORDER BY subscription_count DESC;

SELECT '=== ORPHANED USERS CHECK ===' as section;
SELECT COUNT(*) as orphaned_count
FROM users 
WHERE (email IS NULL OR email = '') 
  AND clerk_id IS NULL;

SELECT '=== NEW COLUMNS ADDED ===' as section;
SELECT 
  column_name, 
  data_type
FROM information_schema.columns
WHERE table_name = 'push_subscriptions' 
  AND column_name = 'device_fingerprint';


-- ============================================================================
-- DONE!
-- 
-- Results:
-- ✅ Stale push subscriptions cleaned up
-- ✅ Orphaned users removed
-- ✅ Device fingerprint column added
-- ✅ Cleanup function created (run with: SELECT * FROM cleanup_stale_push_subscriptions();)
-- ✅ Upsert function created for smart subscription management
-- ============================================================================

