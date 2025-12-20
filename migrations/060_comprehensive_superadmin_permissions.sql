-- ============================================================================
-- Migration: 060_comprehensive_superadmin_permissions
-- Description: Ensure Super Admins have ALL Admin permissions PLUS app-wide access
-- 
-- This migration updates ALL RLS policies to ensure Super Admins have:
-- 1. All permissions that regular Admins have (household-scoped)
-- 2. PLUS app-wide access (can access ALL households)
-- 
-- Run this in Supabase Dashboard > SQL Editor
-- ============================================================================

-- ============================================================================
-- HELPER FUNCTION: Check if current user is SuperAdmin
-- ============================================================================
CREATE OR REPLACE FUNCTION is_superadmin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM users 
    WHERE clerk_id = get_clerk_id() 
    AND role = 'SuperAdmin'
  );
$$ LANGUAGE SQL STABLE;

-- ============================================================================
-- PLACES TABLE (formerly essential_info)
-- ============================================================================
-- Super Admins can view/insert/update/delete ALL places across ALL households
DROP POLICY IF EXISTS "places_select" ON places;
DROP POLICY IF EXISTS "Users can view their household essential info" ON places;
CREATE POLICY "places_select"
ON places FOR SELECT
USING (
  household_id = get_user_household_id()
  OR is_superadmin()
);

DROP POLICY IF EXISTS "places_insert" ON places;
DROP POLICY IF EXISTS "Users can insert their household essential info" ON places;
CREATE POLICY "places_insert"
ON places FOR INSERT
WITH CHECK (
  household_id = get_user_household_id()
  OR is_superadmin()
);

DROP POLICY IF EXISTS "places_update" ON places;
DROP POLICY IF EXISTS "Users can update their household essential info" ON places;
CREATE POLICY "places_update"
ON places FOR UPDATE
USING (
  household_id = get_user_household_id()
  OR is_superadmin()
);

DROP POLICY IF EXISTS "places_delete" ON places;
DROP POLICY IF EXISTS "Users can delete their household essential info" ON places;
CREATE POLICY "places_delete"
ON places FOR DELETE
USING (
  household_id = get_user_household_id()
  OR is_superadmin()
);

-- ============================================================================
-- TRAINING_MODULES TABLE (only if table exists)
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'training_modules'
  ) THEN
    DROP POLICY IF EXISTS "Users can view their household training modules" ON training_modules;
    DROP POLICY IF EXISTS "Allow select on training_modules" ON training_modules;
    CREATE POLICY "Users can view their household training modules"
    ON training_modules FOR SELECT
    USING (
      household_id = get_user_household_id()
      OR is_superadmin()
    );

    DROP POLICY IF EXISTS "Users can insert their household training modules" ON training_modules;
    DROP POLICY IF EXISTS "Allow insert on training_modules" ON training_modules;
    CREATE POLICY "Users can insert their household training modules"
    ON training_modules FOR INSERT
    WITH CHECK (
      household_id = get_user_household_id()
      OR is_superadmin()
    );

    DROP POLICY IF EXISTS "Users can update their household training modules" ON training_modules;
    DROP POLICY IF EXISTS "Allow update on training_modules" ON training_modules;
    CREATE POLICY "Users can update their household training modules"
    ON training_modules FOR UPDATE
    USING (
      household_id = get_user_household_id()
      OR is_superadmin()
    );

    DROP POLICY IF EXISTS "Users can delete their household training modules" ON training_modules;
    DROP POLICY IF EXISTS "Allow delete on training_modules" ON training_modules;
    CREATE POLICY "Users can delete their household training modules"
    ON training_modules FOR DELETE
    USING (
      household_id = get_user_household_id()
      OR is_superadmin()
    );
  END IF;
END $$;

-- ============================================================================
-- TODO_ITEMS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can view their household todo items" ON todo_items;
CREATE POLICY "Users can view their household todo items"
ON todo_items FOR SELECT
USING (
  household_id = get_user_household_id()
  OR is_superadmin()
);

DROP POLICY IF EXISTS "Users can insert their household todo items" ON todo_items;
CREATE POLICY "Users can insert their household todo items"
ON todo_items FOR INSERT
WITH CHECK (
  household_id = get_user_household_id()
  OR is_superadmin()
);

DROP POLICY IF EXISTS "Users can update their household todo items" ON todo_items;
CREATE POLICY "Users can update their household todo items"
ON todo_items FOR UPDATE
USING (
  household_id = get_user_household_id()
  OR is_superadmin()
);

DROP POLICY IF EXISTS "Users can delete their household todo items" ON todo_items;
CREATE POLICY "Users can delete their household todo items"
ON todo_items FOR DELETE
USING (
  household_id = get_user_household_id()
  OR is_superadmin()
);

-- ============================================================================
-- USERS TABLE
-- ============================================================================
-- Super Admins can view ALL users across ALL households
DROP POLICY IF EXISTS "Users can view their household members" ON users;
CREATE POLICY "Users can view their household members"
ON users FOR SELECT
USING (
  household_id = get_user_household_id()
  OR is_superadmin()
);

-- Super Admins can update ALL users across ALL households
DROP POLICY IF EXISTS "Users can update household members" ON users;
CREATE POLICY "Users can update household members"
ON users FOR UPDATE
USING (
  clerk_id = get_clerk_id() 
  OR household_id = get_user_household_id()
  OR is_superadmin()
);

-- ============================================================================
-- HOUSEHOLDS TABLE
-- ============================================================================
-- Super Admins can view ALL households
DROP POLICY IF EXISTS "Users can view their household" ON households;
CREATE POLICY "Users can view their household"
ON households FOR SELECT
USING (
  id = get_user_household_id()
  OR is_superadmin()
);

-- Super Admins can update ALL households
DROP POLICY IF EXISTS "Users can update their household" ON households;
CREATE POLICY "Users can update their household"
ON households FOR UPDATE
USING (
  id = get_user_household_id()
  OR is_superadmin()
);

-- ============================================================================
-- MEALS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can view their household meals" ON meals;
CREATE POLICY "Users can view their household meals"
ON meals FOR SELECT
USING (
  household_id = get_user_household_id()
  OR is_superadmin()
);

DROP POLICY IF EXISTS "Users can insert their household meals" ON meals;
CREATE POLICY "Users can insert their household meals"
ON meals FOR INSERT
WITH CHECK (
  household_id = get_user_household_id()
  OR is_superadmin()
);

DROP POLICY IF EXISTS "Users can update their household meals" ON meals;
CREATE POLICY "Users can update their household meals"
ON meals FOR UPDATE
USING (
  household_id = get_user_household_id()
  OR is_superadmin()
);

DROP POLICY IF EXISTS "Users can delete their household meals" ON meals;
CREATE POLICY "Users can delete their household meals"
ON meals FOR DELETE
USING (
  household_id = get_user_household_id()
  OR is_superadmin()
);

-- ============================================================================
-- EXPENSES TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can view their household expenses" ON expenses;
CREATE POLICY "Users can view their household expenses"
ON expenses FOR SELECT
USING (
  household_id = get_user_household_id()
  OR is_superadmin()
);

DROP POLICY IF EXISTS "Users can insert their household expenses" ON expenses;
CREATE POLICY "Users can insert their household expenses"
ON expenses FOR INSERT
WITH CHECK (
  household_id = get_user_household_id()
  OR is_superadmin()
);

DROP POLICY IF EXISTS "Users can update their household expenses" ON expenses;
CREATE POLICY "Users can update their household expenses"
ON expenses FOR UPDATE
USING (
  household_id = get_user_household_id()
  OR is_superadmin()
);

DROP POLICY IF EXISTS "Users can delete their household expenses" ON expenses;
CREATE POLICY "Users can delete their household expenses"
ON expenses FOR DELETE
USING (
  household_id = get_user_household_id()
  OR is_superadmin()
);

-- ============================================================================
-- PRACTICES TABLE (formerly house_routine)
-- ============================================================================
DROP POLICY IF EXISTS "practices_select" ON practices;
DROP POLICY IF EXISTS "Users can view their household house routine" ON practices;
CREATE POLICY "practices_select"
ON practices FOR SELECT
USING (
  household_id = get_user_household_id()
  OR is_superadmin()
);

DROP POLICY IF EXISTS "practices_insert" ON practices;
DROP POLICY IF EXISTS "Users can insert their household house routine" ON practices;
CREATE POLICY "practices_insert"
ON practices FOR INSERT
WITH CHECK (
  household_id = get_user_household_id()
  OR is_superadmin()
);

DROP POLICY IF EXISTS "practices_update" ON practices;
DROP POLICY IF EXISTS "Users can update their household house routine" ON practices;
CREATE POLICY "practices_update"
ON practices FOR UPDATE
USING (
  household_id = get_user_household_id()
  OR is_superadmin()
);

DROP POLICY IF EXISTS "practices_delete" ON practices;
DROP POLICY IF EXISTS "Users can delete their household house routine" ON practices;
CREATE POLICY "practices_delete"
ON practices FOR DELETE
USING (
  household_id = get_user_household_id()
  OR is_superadmin()
);

-- ============================================================================
-- RECEIPTS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can view their household receipts" ON receipts;
CREATE POLICY "Users can view their household receipts"
ON receipts FOR SELECT
USING (
  household_id = get_user_household_id()
  OR is_superadmin()
);

DROP POLICY IF EXISTS "Users can insert their household receipts" ON receipts;
CREATE POLICY "Users can insert their household receipts"
ON receipts FOR INSERT
WITH CHECK (
  household_id = get_user_household_id()
  OR is_superadmin()
);

DROP POLICY IF EXISTS "Users can update their household receipts" ON receipts;
CREATE POLICY "Users can update their household receipts"
ON receipts FOR UPDATE
USING (
  household_id = get_user_household_id()
  OR is_superadmin()
);

DROP POLICY IF EXISTS "Users can delete their household receipts" ON receipts;
CREATE POLICY "Users can delete their household receipts"
ON receipts FOR DELETE
USING (
  household_id = get_user_household_id()
  OR is_superadmin()
);

-- ============================================================================
-- SECTIONS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can view their household sections" ON sections;
CREATE POLICY "Users can view their household sections"
ON sections FOR SELECT
USING (
  household_id = get_user_household_id()
  OR is_superadmin()
);

DROP POLICY IF EXISTS "Users can insert their household sections" ON sections;
CREATE POLICY "Users can insert their household sections"
ON sections FOR INSERT
WITH CHECK (
  household_id = get_user_household_id()
  OR is_superadmin()
);

DROP POLICY IF EXISTS "Users can update their household sections" ON sections;
CREATE POLICY "Users can update their household sections"
ON sections FOR UPDATE
USING (
  household_id = get_user_household_id()
  OR is_superadmin()
);

DROP POLICY IF EXISTS "Users can delete their household sections" ON sections;
CREATE POLICY "Users can delete their household sections"
ON sections FOR DELETE
USING (
  household_id = get_user_household_id()
  OR is_superadmin()
);

-- ============================================================================
-- PUSH_SUBSCRIPTIONS TABLE
-- ============================================================================
-- Super Admins can view ALL push subscriptions (for debugging/admin purposes)
DROP POLICY IF EXISTS "Users can manage their own push subscriptions" ON push_subscriptions;
CREATE POLICY "Users can manage their own push subscriptions"
ON push_subscriptions FOR SELECT
USING (
  user_id IN (SELECT id FROM users WHERE clerk_id = get_clerk_id())
  OR is_superadmin()
);

DROP POLICY IF EXISTS "Users can insert their own push subscriptions" ON push_subscriptions;
CREATE POLICY "Users can insert their own push subscriptions"
ON push_subscriptions FOR INSERT
WITH CHECK (
  user_id IN (SELECT id FROM users WHERE clerk_id = get_clerk_id())
  OR is_superadmin()
);

DROP POLICY IF EXISTS "Users can update their own push subscriptions" ON push_subscriptions;
CREATE POLICY "Users can update their own push subscriptions"
ON push_subscriptions FOR UPDATE
USING (
  user_id IN (SELECT id FROM users WHERE clerk_id = get_clerk_id())
  OR is_superadmin()
);

DROP POLICY IF EXISTS "Users can delete their own push subscriptions" ON push_subscriptions;
CREATE POLICY "Users can delete their own push subscriptions"
ON push_subscriptions FOR DELETE
USING (
  user_id IN (SELECT id FROM users WHERE clerk_id = get_clerk_id())
  OR is_superadmin()
);

-- ============================================================================
-- NOTIFICATIONS TABLE
-- ============================================================================
-- Super Admins can view ALL notifications across ALL households
DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
CREATE POLICY "Users can view their own notifications"
ON notifications FOR SELECT
USING (
  recipient_user_id IN (SELECT id FROM users WHERE clerk_id = get_clerk_id())
  OR is_superadmin()
);

DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
CREATE POLICY "Users can update their own notifications"
ON notifications FOR UPDATE
USING (
  recipient_user_id IN (SELECT id FROM users WHERE clerk_id = get_clerk_id())
  OR is_superadmin()
);

DROP POLICY IF EXISTS "Users can delete their own notifications" ON notifications;
CREATE POLICY "Users can delete their own notifications"
ON notifications FOR DELETE
USING (
  recipient_user_id IN (SELECT id FROM users WHERE clerk_id = get_clerk_id())
  OR is_superadmin()
);

-- ============================================================================
-- HELPER_HOLIDAY_RECORDS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can view their household helper holiday records" ON helper_holiday_records;
CREATE POLICY "Users can view their household helper holiday records"
ON helper_holiday_records FOR SELECT
USING (
  household_id = get_user_household_id()
  OR is_superadmin()
);

DROP POLICY IF EXISTS "Users can insert their household helper holiday records" ON helper_holiday_records;
CREATE POLICY "Users can insert their household helper holiday records"
ON helper_holiday_records FOR INSERT
WITH CHECK (
  household_id = get_user_household_id()
  OR is_superadmin()
);

DROP POLICY IF EXISTS "Users can update their household helper holiday records" ON helper_holiday_records;
CREATE POLICY "Users can update their household helper holiday records"
ON helper_holiday_records FOR UPDATE
USING (
  household_id = get_user_household_id()
  OR is_superadmin()
);

DROP POLICY IF EXISTS "Users can delete their household helper holiday records" ON helper_holiday_records;
CREATE POLICY "Users can delete their household helper holiday records"
ON helper_holiday_records FOR DELETE
USING (
  household_id = get_user_household_id()
  OR is_superadmin()
);

-- ============================================================================
-- HELPER_PAYSLIP_CONFIRMATIONS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Users can view their household payslip confirmations" ON helper_payslip_confirmations;
CREATE POLICY "Users can view their household payslip confirmations"
ON helper_payslip_confirmations FOR SELECT
USING (
  household_id = get_user_household_id()
  OR is_superadmin()
);

DROP POLICY IF EXISTS "Users can insert their household payslip confirmations" ON helper_payslip_confirmations;
CREATE POLICY "Users can insert their household payslip confirmations"
ON helper_payslip_confirmations FOR INSERT
WITH CHECK (
  household_id = get_user_household_id()
  OR is_superadmin()
);

DROP POLICY IF EXISTS "Users can update their household payslip confirmations" ON helper_payslip_confirmations;
CREATE POLICY "Users can update their household payslip confirmations"
ON helper_payslip_confirmations FOR UPDATE
USING (
  household_id = get_user_household_id()
  OR is_superadmin()
);

-- ============================================================================
-- SUPPORT_TICKETS TABLE
-- ============================================================================
-- Update support_tickets policies to ensure Super Admins have BOTH Admin and Super Admin permissions
-- (This migration ensures Super Admins can access tickets in their household AND all households)

DROP POLICY IF EXISTS "Users can view tickets based on role" ON support_tickets;
CREATE POLICY "Users can view tickets based on role"
ON support_tickets FOR SELECT
USING (
  -- User can see their own tickets
  user_id IN (SELECT id FROM users WHERE clerk_id = get_clerk_id())
  OR
  -- Household Admins can see all tickets in their household
  (
    household_id = get_user_household_id()
    AND EXISTS (
      SELECT 1 FROM users 
      WHERE clerk_id = get_clerk_id() 
      AND role = 'Admin'
    )
  )
  OR
  -- SuperAdmins can see ALL tickets (no household restriction)
  is_superadmin()
);

DROP POLICY IF EXISTS "Users can update tickets based on role" ON support_tickets;
CREATE POLICY "Users can update tickets based on role"
ON support_tickets FOR UPDATE
USING (
  -- User can update their own tickets
  user_id IN (SELECT id FROM users WHERE clerk_id = get_clerk_id())
  OR
  -- Household Admins can update tickets in their household
  (
    household_id = get_user_household_id()
    AND EXISTS (
      SELECT 1 FROM users 
      WHERE clerk_id = get_clerk_id() 
      AND role = 'Admin'
    )
  )
  OR
  -- SuperAdmins can update ANY ticket
  is_superadmin()
);

DROP POLICY IF EXISTS "Users can delete tickets based on role" ON support_tickets;
CREATE POLICY "Users can delete tickets based on role"
ON support_tickets FOR DELETE
USING (
  -- User can delete their own tickets
  user_id IN (SELECT id FROM users WHERE clerk_id = get_clerk_id())
  OR
  -- Household Admins can delete tickets in their household
  (
    household_id = get_user_household_id()
    AND EXISTS (
      SELECT 1 FROM users 
      WHERE clerk_id = get_clerk_id() 
      AND role = 'Admin'
    )
  )
  OR
  -- SuperAdmins can delete ANY ticket
  is_superadmin()
);

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- Verify Super Admin users exist
SELECT 
  id,
  name,
  email,
  role,
  household_id
FROM users
WHERE email IN ('cryptohkrc@gmail.com', 'julianoliko@gmail.com')
  AND role = 'SuperAdmin';

-- ============================================================================
-- Done! Super Admins now have ALL Admin permissions PLUS app-wide access
-- ============================================================================
-- 
-- Summary:
-- - Super Admins can access ALL data across ALL households
-- - Super Admins retain their own household access (like regular Admins)
-- - Super Admins have app-wide permissions for all tables
-- ============================================================================
