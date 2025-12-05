-- ============================================================================
-- Migration: 007_push_notifications
-- Description: Add push notification support for Helpy app
-- 
-- This migration creates:
-- 1. push_subscriptions table - stores Web Push subscription data per user/device
-- 2. notifications table - optional in-app notification history
-- 3. Database triggers to invoke edge function on item creation
-- 
-- HOW TO RUN:
-- 1. Go to Supabase Dashboard
-- 2. Navigate to SQL Editor
-- 3. Paste this entire file
-- 4. Click "Run"
-- 
-- PREREQUISITES:
-- - Enable the pg_net extension for HTTP calls (Database > Extensions > pg_net)
-- - Deploy the send-notification edge function first
-- ============================================================================


-- ============================================================================
-- PART 1: ENABLE REQUIRED EXTENSIONS
-- ============================================================================

-- Enable pg_net for making HTTP requests from triggers
-- Note: This may already be enabled. If so, this is a no-op.
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;


-- ============================================================================
-- PART 2: CREATE PUSH_SUBSCRIPTIONS TABLE
-- ============================================================================
-- Stores Web Push API subscription data for each user's device
-- A user can have multiple subscriptions (one per device/browser)
-- ============================================================================

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  -- Web Push subscription data
  endpoint TEXT NOT NULL,
  p256dh_key TEXT NOT NULL,  -- Public key for encryption
  auth_key TEXT NOT NULL,     -- Auth secret for encryption
  -- Metadata
  user_agent TEXT,            -- Browser/device info for debugging
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- Ensure unique subscription per endpoint per user
  UNIQUE(user_id, endpoint)
);

-- Index for faster lookups by household
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_household 
ON push_subscriptions(household_id);

-- Index for faster lookups by user
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user 
ON push_subscriptions(user_id);

-- RLS Policies for push_subscriptions
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow select on push_subscriptions" ON push_subscriptions 
FOR SELECT USING (true);

CREATE POLICY "Allow insert on push_subscriptions" ON push_subscriptions 
FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow update on push_subscriptions" ON push_subscriptions 
FOR UPDATE USING (true);

CREATE POLICY "Allow delete on push_subscriptions" ON push_subscriptions 
FOR DELETE USING (true);


-- ============================================================================
-- PART 3: CREATE NOTIFICATIONS TABLE (Optional - for in-app history)
-- ============================================================================
-- Stores notification history for in-app notification center
-- ============================================================================

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  recipient_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Notification content
  type TEXT NOT NULL CHECK (type IN ('todo_item', 'meal', 'expense')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  -- Reference to the created item
  reference_id UUID,
  reference_table TEXT,
  -- Who triggered this notification
  triggered_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  triggered_by_name TEXT,
  -- Status
  read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_notifications_recipient 
ON notifications(recipient_user_id, read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_household 
ON notifications(household_id, created_at DESC);

-- RLS Policies for notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow select on notifications" ON notifications 
FOR SELECT USING (true);

CREATE POLICY "Allow insert on notifications" ON notifications 
FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow update on notifications" ON notifications 
FOR UPDATE USING (true);

CREATE POLICY "Allow delete on notifications" ON notifications 
FOR DELETE USING (true);


-- ============================================================================
-- PART 4: ADD notifications_enabled COLUMN TO USERS TABLE (if not exists)
-- ============================================================================

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS notifications_enabled BOOLEAN DEFAULT TRUE;


-- ============================================================================
-- PART 4B: ADD created_by COLUMN TO TRACK WHO ADDED ITEMS
-- ============================================================================
-- This helps us know who to exclude from notifications and personalize messages

ALTER TABLE todo_items 
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE meals 
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE expenses 
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;


-- ============================================================================
-- PART 5: CREATE TRIGGER FUNCTION FOR NOTIFICATIONS
-- ============================================================================
-- This function is called by triggers when items are inserted
-- It makes an HTTP request to the Supabase Edge Function
-- ============================================================================

CREATE OR REPLACE FUNCTION notify_household_on_insert()
RETURNS TRIGGER AS $$
DECLARE
  supabase_url TEXT;
  created_by_id UUID;
BEGIN
  -- Get the Supabase project URL
  -- IMPORTANT: Replace YOUR_PROJECT_REF with your actual Supabase project reference
  -- You can find this in your Supabase dashboard URL: https://supabase.com/dashboard/project/YOUR_PROJECT_REF
  supabase_url := 'https://YOUR_PROJECT_REF.supabase.co';
  
  -- Get who created this item (all tables now have created_by column)
  created_by_id := NEW.created_by;

  -- Make async HTTP request to edge function using pg_net
  -- Note: net.http_post is non-blocking and won't slow down the insert
  PERFORM net.http_post(
    url := supabase_url || '/functions/v1/send-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'table', TG_TABLE_NAME,
      'record', row_to_json(NEW),
      'household_id', NEW.household_id::text,
      'created_by_user_id', created_by_id::text
    )
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the insert - notifications are non-critical
    RAISE WARNING 'Failed to send notification: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================================
-- PART 6: CREATE TRIGGERS ON TABLES
-- ============================================================================

-- Drop existing triggers if they exist (for idempotency)
DROP TRIGGER IF EXISTS on_todo_item_insert_notify ON todo_items;
DROP TRIGGER IF EXISTS on_meal_insert_notify ON meals;
DROP TRIGGER IF EXISTS on_expense_insert_notify ON expenses;

-- Trigger for todo_items (shopping list + tasks)
CREATE TRIGGER on_todo_item_insert_notify
AFTER INSERT ON todo_items
FOR EACH ROW
EXECUTE FUNCTION notify_household_on_insert();

-- Trigger for meals
CREATE TRIGGER on_meal_insert_notify
AFTER INSERT ON meals
FOR EACH ROW
EXECUTE FUNCTION notify_household_on_insert();

-- Trigger for expenses
CREATE TRIGGER on_expense_insert_notify
AFTER INSERT ON expenses
FOR EACH ROW
EXECUTE FUNCTION notify_household_on_insert();


-- ============================================================================
-- PART 7: HELPER FUNCTION TO CLEAN UP EXPIRED SUBSCRIPTIONS
-- ============================================================================
-- Call this periodically to remove subscriptions that are no longer valid
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_expired_push_subscriptions()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete subscriptions older than 30 days that haven't been updated
  -- (In practice, you'd mark them as invalid when push fails)
  DELETE FROM push_subscriptions
  WHERE updated_at < NOW() - INTERVAL '30 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- DONE!
-- 
-- Next steps:
-- 1. Enable pg_net extension in Supabase Dashboard (Database > Extensions)
-- 2. Deploy the send-notification edge function
-- 3. Set app.settings configuration for supabase_project_ref and service_role_key
--    OR update the trigger function with hardcoded values
-- 4. Generate VAPID keys and add to environment variables
-- 5. Test by adding an item and checking if notifications are sent
-- ============================================================================

