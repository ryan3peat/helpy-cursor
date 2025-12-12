-- ============================================================================
-- Migration: 027_clerk_jwt_rls_policies
-- Description: Secure RLS policies using Clerk JWT integration
-- 
-- IMPORTANT: 
-- 1. Configure Clerk JWT template FIRST (see Step 1 in guide)
-- 2. Deploy updated code (Step 2) BEFORE running this migration
-- 3. This replaces the permissive policies from migration 004
-- 
-- Run this in Supabase Dashboard > SQL Editor
-- ============================================================================

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================
-- Function to extract clerk_id from JWT claims
CREATE OR REPLACE FUNCTION get_clerk_id()
RETURNS TEXT AS $$
  SELECT nullif(
    current_setting('request.jwt.claims', true)::json->>'clerk_id',
    ''
  )::TEXT;
$$ LANGUAGE SQL STABLE;

-- Function to get user's household_id from clerk_id
CREATE OR REPLACE FUNCTION get_user_household_id()
RETURNS UUID AS $$
  SELECT household_id 
  FROM users 
  WHERE clerk_id = get_clerk_id()
  LIMIT 1;
$$ LANGUAGE SQL STABLE;

-- ============================================================================
-- HELPER: Drop all policies on a table (safely handles missing policies)
-- ============================================================================
CREATE OR REPLACE FUNCTION drop_all_policies_on_table(table_name text)
RETURNS void AS $$
DECLARE
  pol record;
BEGIN
  FOR pol IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = table_name
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, table_name);
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- ESSENTIAL_INFO TABLE
-- ============================================================================
SELECT drop_all_policies_on_table('essential_info');

CREATE POLICY "Users can view their household essential info"
ON essential_info FOR SELECT
USING (household_id = get_user_household_id());

CREATE POLICY "Users can insert their household essential info"
ON essential_info FOR INSERT
WITH CHECK (household_id = get_user_household_id());

CREATE POLICY "Users can update their household essential info"
ON essential_info FOR UPDATE
USING (household_id = get_user_household_id());

CREATE POLICY "Users can delete their household essential info"
ON essential_info FOR DELETE
USING (household_id = get_user_household_id());

-- ============================================================================
-- TRAINING_MODULES TABLE
-- ============================================================================
SELECT drop_all_policies_on_table('training_modules');

CREATE POLICY "Users can view their household training modules"
ON training_modules FOR SELECT
USING (household_id = get_user_household_id());

CREATE POLICY "Users can insert their household training modules"
ON training_modules FOR INSERT
WITH CHECK (household_id = get_user_household_id());

CREATE POLICY "Users can update their household training modules"
ON training_modules FOR UPDATE
USING (household_id = get_user_household_id());

CREATE POLICY "Users can delete their household training modules"
ON training_modules FOR DELETE
USING (household_id = get_user_household_id());

-- ============================================================================
-- HELPER_POINTS TABLE (may not exist - was dropped in migration 020)
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'helper_points'
  ) THEN
    PERFORM drop_all_policies_on_table('helper_points');

    CREATE POLICY "Users can view helper points in their household"
    ON helper_points FOR SELECT
    USING (
      user_id IN (
        SELECT id FROM users 
        WHERE household_id = get_user_household_id()
      )
    );

    CREATE POLICY "Users can insert their own points"
    ON helper_points FOR INSERT
    WITH CHECK (
      user_id IN (
        SELECT id FROM users 
        WHERE household_id = get_user_household_id()
      )
    );

    CREATE POLICY "Users can update their own points"
    ON helper_points FOR UPDATE
    USING (
      user_id IN (
        SELECT id FROM users 
        WHERE household_id = get_user_household_id()
      )
    );

    CREATE POLICY "Users can delete their own points"
    ON helper_points FOR DELETE
    USING (
      user_id IN (
        SELECT id FROM users 
        WHERE household_id = get_user_household_id()
      )
    );
  END IF;
END $$;

-- ============================================================================
-- TODO_ITEMS TABLE
-- ============================================================================
SELECT drop_all_policies_on_table('todo_items');

CREATE POLICY "Users can view their household todo items"
ON todo_items FOR SELECT
USING (household_id = get_user_household_id());

CREATE POLICY "Users can insert their household todo items"
ON todo_items FOR INSERT
WITH CHECK (household_id = get_user_household_id());

CREATE POLICY "Users can update their household todo items"
ON todo_items FOR UPDATE
USING (household_id = get_user_household_id());

CREATE POLICY "Users can delete their household todo items"
ON todo_items FOR DELETE
USING (household_id = get_user_household_id());

-- ============================================================================
-- USERS TABLE
-- ============================================================================
SELECT drop_all_policies_on_table('users');

CREATE POLICY "Users can view their household members"
ON users FOR SELECT
USING (household_id = get_user_household_id());

-- Only service role can insert users (via API routes)
CREATE POLICY "Service role can insert users"
ON users FOR INSERT
WITH CHECK (false); -- Disable direct inserts, use API routes

-- Users can update their own profile or other users in their household
CREATE POLICY "Users can update household members"
ON users FOR UPDATE
USING (
  clerk_id = get_clerk_id() OR
  household_id = get_user_household_id()
);

-- Only service role can delete users (via API routes)
CREATE POLICY "Service role can delete users"
ON users FOR DELETE
USING (false); -- Disable direct deletes, use API routes

-- ============================================================================
-- HOUSEHOLDS TABLE
-- ============================================================================
SELECT drop_all_policies_on_table('households');

CREATE POLICY "Users can view their household"
ON households FOR SELECT
USING (id = get_user_household_id());

-- Only service role can insert households (via API routes)
CREATE POLICY "Service role can insert households"
ON households FOR INSERT
WITH CHECK (false); -- Disable direct inserts, use API routes

CREATE POLICY "Users can update their household"
ON households FOR UPDATE
USING (id = get_user_household_id());

-- Only service role can delete households (via API routes)
CREATE POLICY "Service role can delete households"
ON households FOR DELETE
USING (false); -- Disable direct deletes, use API routes

-- ============================================================================
-- MEALS TABLE
-- ============================================================================
SELECT drop_all_policies_on_table('meals');

CREATE POLICY "Users can view their household meals"
ON meals FOR SELECT
USING (household_id = get_user_household_id());

CREATE POLICY "Users can insert their household meals"
ON meals FOR INSERT
WITH CHECK (household_id = get_user_household_id());

CREATE POLICY "Users can update their household meals"
ON meals FOR UPDATE
USING (household_id = get_user_household_id());

CREATE POLICY "Users can delete their household meals"
ON meals FOR DELETE
USING (household_id = get_user_household_id());

-- ============================================================================
-- EXPENSES TABLE
-- ============================================================================
SELECT drop_all_policies_on_table('expenses');

CREATE POLICY "Users can view their household expenses"
ON expenses FOR SELECT
USING (household_id = get_user_household_id());

CREATE POLICY "Users can insert their household expenses"
ON expenses FOR INSERT
WITH CHECK (household_id = get_user_household_id());

CREATE POLICY "Users can update their household expenses"
ON expenses FOR UPDATE
USING (household_id = get_user_household_id());

CREATE POLICY "Users can delete their household expenses"
ON expenses FOR DELETE
USING (household_id = get_user_household_id());

-- ============================================================================
-- HOUSE_ROUTINE TABLE
-- ============================================================================
SELECT drop_all_policies_on_table('house_routine');

CREATE POLICY "Users can view their household house routine"
ON house_routine FOR SELECT
USING (household_id = get_user_household_id());

CREATE POLICY "Users can insert their household house routine"
ON house_routine FOR INSERT
WITH CHECK (household_id = get_user_household_id());

CREATE POLICY "Users can update their household house routine"
ON house_routine FOR UPDATE
USING (household_id = get_user_household_id());

CREATE POLICY "Users can delete their household house routine"
ON house_routine FOR DELETE
USING (household_id = get_user_household_id());

-- ============================================================================
-- RECEIPTS TABLE
-- ============================================================================
SELECT drop_all_policies_on_table('receipts');

CREATE POLICY "Users can view their household receipts"
ON receipts FOR SELECT
USING (household_id = get_user_household_id());

CREATE POLICY "Users can insert their household receipts"
ON receipts FOR INSERT
WITH CHECK (household_id = get_user_household_id());

CREATE POLICY "Users can update their household receipts"
ON receipts FOR UPDATE
USING (household_id = get_user_household_id());

CREATE POLICY "Users can delete their household receipts"
ON receipts FOR DELETE
USING (household_id = get_user_household_id());

-- ============================================================================
-- SECTIONS TABLE
-- ============================================================================
SELECT drop_all_policies_on_table('sections');

CREATE POLICY "Users can view their household sections"
ON sections FOR SELECT
USING (household_id = get_user_household_id());

CREATE POLICY "Users can insert their household sections"
ON sections FOR INSERT
WITH CHECK (household_id = get_user_household_id());

CREATE POLICY "Users can update their household sections"
ON sections FOR UPDATE
USING (household_id = get_user_household_id());

CREATE POLICY "Users can delete their household sections"
ON sections FOR DELETE
USING (household_id = get_user_household_id());

-- ============================================================================
-- SUBSCRIPTION_EVENTS TABLE
-- ============================================================================
SELECT drop_all_policies_on_table('subscription_events');

-- Only service role (API routes) can access subscription events
CREATE POLICY "Service role can view subscription events"
ON subscription_events FOR SELECT
USING (false); -- API routes use service role key

CREATE POLICY "Service role can insert subscription events"
ON subscription_events FOR INSERT
WITH CHECK (false); -- API routes use service role key

CREATE POLICY "Service role can update subscription events"
ON subscription_events FOR UPDATE
USING (false); -- API routes use service role key

CREATE POLICY "Service role can delete subscription events"
ON subscription_events FOR DELETE
USING (false); -- API routes use service role key

-- ============================================================================
-- PUSH_SUBSCRIPTIONS TABLE
-- ============================================================================
SELECT drop_all_policies_on_table('push_subscriptions');

CREATE POLICY "Users can manage their own push subscriptions"
ON push_subscriptions FOR SELECT
USING (
  user_id IN (
    SELECT id FROM users 
    WHERE clerk_id = get_clerk_id()
  )
);

CREATE POLICY "Users can insert their own push subscriptions"
ON push_subscriptions FOR INSERT
WITH CHECK (
  user_id IN (
    SELECT id FROM users 
    WHERE clerk_id = get_clerk_id()
  )
);

CREATE POLICY "Users can update their own push subscriptions"
ON push_subscriptions FOR UPDATE
USING (
  user_id IN (
    SELECT id FROM users 
    WHERE clerk_id = get_clerk_id()
  )
);

CREATE POLICY "Users can delete their own push subscriptions"
ON push_subscriptions FOR DELETE
USING (
  user_id IN (
    SELECT id FROM users 
    WHERE clerk_id = get_clerk_id()
  )
);

-- ============================================================================
-- NOTIFICATIONS TABLE
-- ============================================================================
SELECT drop_all_policies_on_table('notifications');

CREATE POLICY "Users can view their own notifications"
ON notifications FOR SELECT
USING (
  recipient_user_id IN (
    SELECT id FROM users 
    WHERE clerk_id = get_clerk_id()
  )
);

-- Only service role (edge function) can insert notifications
CREATE POLICY "Service role can insert notifications"
ON notifications FOR INSERT
WITH CHECK (false); -- Edge function uses service role key

-- Users can update their own notifications (e.g., mark as read)
CREATE POLICY "Users can update their own notifications"
ON notifications FOR UPDATE
USING (
  recipient_user_id IN (
    SELECT id FROM users 
    WHERE clerk_id = get_clerk_id()
  )
);

CREATE POLICY "Users can delete their own notifications"
ON notifications FOR DELETE
USING (
  recipient_user_id IN (
    SELECT id FROM users 
    WHERE clerk_id = get_clerk_id()
  )
);

-- ============================================================================
-- NOTIFICATION_QUEUE TABLE
-- ============================================================================
SELECT drop_all_policies_on_table('notification_queue');

-- Only service role (edge function) can access notification queue
CREATE POLICY "Service role can access notification queue"
ON notification_queue FOR ALL
USING (false); -- Edge function uses service role key

-- ============================================================================
-- UI_TRANSLATIONS TABLE
-- ============================================================================
-- Keep existing policies (public read, service role write)
-- No changes needed - this table should remain publicly readable
-- If policies don't exist, we'll leave it without RLS (public access)

-- ============================================================================
-- Cleanup: Drop the helper function (optional, can keep for future use)
-- ============================================================================
-- DROP FUNCTION IF EXISTS drop_all_policies_on_table(text);

-- ============================================================================
-- Done! RLS policies are now secured with Clerk JWT integration
-- 
-- IMPORTANT NOTES:
-- 1. These policies will FAIL if the Supabase client doesn't send Clerk JWT tokens
-- 2. Make sure you've deployed the updated code (Step 2) before running this migration
-- 3. Test thoroughly after deployment to ensure JWT tokens are being sent
-- 4. API routes and Edge Functions use service role key, so they bypass RLS (this is correct)
-- ============================================================================
