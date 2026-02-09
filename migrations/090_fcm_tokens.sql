-- ============================================================================
-- Migration: 090_fcm_tokens
-- Description: Add FCM tokens table for native Android push notifications
--
-- The existing push_subscriptions table stores Web Push API subscriptions
-- (endpoint, p256dh_key, auth_key). Native Android apps use Firebase Cloud
-- Messaging (FCM) which uses a different token format.
--
-- This table stores FCM registration tokens which are used by the
-- send-notification Edge Function to deliver push notifications via
-- the FCM HTTP v1 API.
--
-- HOW TO RUN:
-- 1. Go to Supabase Dashboard → SQL Editor
-- 2. Paste this entire script
-- 3. Click "Run"
-- ============================================================================


-- ============================================================================
-- STEP 1: Create fcm_tokens table
-- ============================================================================
CREATE TABLE IF NOT EXISTS fcm_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'android',  -- 'android' or 'ios'
  device_fingerprint TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- Each user can have one token per unique FCM token
  UNIQUE(user_id, token)
);

-- Index for efficient lookups when sending notifications
CREATE INDEX IF NOT EXISTS idx_fcm_tokens_user_id
ON fcm_tokens(user_id);

CREATE INDEX IF NOT EXISTS idx_fcm_tokens_household_id
ON fcm_tokens(household_id);


-- ============================================================================
-- STEP 2: Enable RLS
-- ============================================================================
ALTER TABLE fcm_tokens ENABLE ROW LEVEL SECURITY;

-- Service role has full access (used by Edge Functions and API routes)
-- Users can manage their own tokens
CREATE POLICY "Users can view their own FCM tokens"
ON fcm_tokens FOR SELECT
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.role = 'Super Admin'
  )
);

CREATE POLICY "Users can insert their own FCM tokens"
ON fcm_tokens FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own FCM tokens"
ON fcm_tokens FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own FCM tokens"
ON fcm_tokens FOR DELETE
USING (user_id = auth.uid());

-- Allow service role full access (for API routes using service key)
-- This is handled automatically by Supabase when using the service role key


-- ============================================================================
-- STEP 3: Cleanup function for stale tokens
-- ============================================================================
CREATE OR REPLACE FUNCTION cleanup_stale_fcm_tokens()
RETURNS INT AS $$
DECLARE
  deleted_count INT;
BEGIN
  -- Remove tokens older than 60 days (FCM tokens expire periodically)
  DELETE FROM fcm_tokens
  WHERE updated_at < NOW() - INTERVAL '60 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- VERIFICATION
-- ============================================================================
SELECT 'fcm_tokens table' as check_name,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'fcm_tokens')
    THEN '✅ Created'
    ELSE '❌ Not created'
  END as status;

SELECT 'fcm_tokens unique constraint' as check_name,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'fcm_tokens' AND constraint_type = 'UNIQUE'
  )
    THEN '✅ Created'
    ELSE '❌ Not created'
  END as status;


-- ============================================================================
-- DONE!
-- 
-- The fcm_tokens table is ready. Next steps:
--
-- 1. Deploy the updated send-notification Edge Function
--    (it will now query both push_subscriptions AND fcm_tokens)
--
-- 2. Set up Firebase:
--    a. Create/use a Firebase project at https://console.firebase.google.com
--    b. Add an Android app (package: com.helpyfam.app)
--    c. Download google-services.json → place in android/app/
--    d. Go to Project Settings → Service Accounts → Generate Private Key
--    e. Add the service account JSON as an Edge Function secret:
--       FIREBASE_SERVICE_ACCOUNT_JSON
--
-- 3. Build and deploy the Android app with push notification support
-- ============================================================================
