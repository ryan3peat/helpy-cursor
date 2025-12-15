-- ============================================================================
-- FULL USER DELETION SCRIPT: julianoliko@gmail.com
-- ============================================================================
-- This script will PERMANENTLY delete the user and ALL associated data.
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- ============================================================================

-- ============================================================================
-- STEP 1: DIAGNOSTIC - See what will be deleted (READ-ONLY)
-- ============================================================================

-- Find the user
SELECT 'USER TO DELETE:' as info;
SELECT id, email, name, role, household_id, clerk_id, status 
FROM users 
WHERE email = 'julianoliko@gmail.com';

-- Get the household ID for this user
DO $$
DECLARE
    v_user_id UUID;
    v_household_id UUID;
    v_user_role TEXT;
    v_clerk_id TEXT;
BEGIN
    -- Get user info
    SELECT id, household_id, role, clerk_id 
    INTO v_user_id, v_household_id, v_user_role, v_clerk_id
    FROM users 
    WHERE email = 'julianoliko@gmail.com';
    
    IF v_user_id IS NULL THEN
        RAISE NOTICE 'User with email julianoliko@gmail.com NOT FOUND';
        RETURN;
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE '=== USER FOUND ===';
    RAISE NOTICE 'User ID: %', v_user_id;
    RAISE NOTICE 'Household ID: %', v_household_id;
    RAISE NOTICE 'Role: %', v_user_role;
    RAISE NOTICE 'Clerk ID: %', v_clerk_id;
END $$;

-- Count what will be deleted
SELECT 'DATA COUNTS TO DELETE:' as info;

SELECT 
    'push_subscriptions' as table_name,
    COUNT(*) as count
FROM push_subscriptions 
WHERE user_id = (SELECT id FROM users WHERE email = 'julianoliko@gmail.com')
UNION ALL
SELECT 
    'todo_items (household)' as table_name,
    COUNT(*) as count
FROM todo_items 
WHERE household_id = (SELECT household_id FROM users WHERE email = 'julianoliko@gmail.com')
UNION ALL
SELECT 
    'meals (household)' as table_name,
    COUNT(*) as count
FROM meals 
WHERE household_id = (SELECT household_id FROM users WHERE email = 'julianoliko@gmail.com')
UNION ALL
SELECT 
    'expenses (household)' as table_name,
    COUNT(*) as count
FROM expenses 
WHERE household_id = (SELECT household_id FROM users WHERE email = 'julianoliko@gmail.com')
UNION ALL
SELECT 
    'receipts (household expenses)' as table_name,
    COUNT(*) as count
FROM receipts 
WHERE expense_id IN (
    SELECT id FROM expenses 
    WHERE household_id = (SELECT household_id FROM users WHERE email = 'julianoliko@gmail.com')
)
UNION ALL
SELECT 
    'essential_info (household)' as table_name,
    COUNT(*) as count
FROM essential_info 
WHERE household_id = (SELECT household_id FROM users WHERE email = 'julianoliko@gmail.com')
UNION ALL
SELECT 
    'training_modules (household)' as table_name,
    COUNT(*) as count
FROM training_modules 
WHERE household_id = (SELECT household_id FROM users WHERE email = 'julianoliko@gmail.com')
UNION ALL
SELECT 
    'house_routine (household)' as table_name,
    COUNT(*) as count
FROM house_routine 
WHERE household_id = (SELECT household_id FROM users WHERE email = 'julianoliko@gmail.com')
UNION ALL
SELECT 
    'sections (household)' as table_name,
    COUNT(*) as count
FROM sections 
WHERE household_id = (SELECT household_id FROM users WHERE email = 'julianoliko@gmail.com')
UNION ALL
SELECT 
    'users (household members)' as table_name,
    COUNT(*) as count
FROM users 
WHERE household_id = (SELECT household_id FROM users WHERE email = 'julianoliko@gmail.com')
UNION ALL
SELECT 
    'households' as table_name,
    COUNT(*) as count
FROM households 
WHERE id = (SELECT household_id FROM users WHERE email = 'julianoliko@gmail.com');

-- Show other household members (if any)
SELECT 'OTHER HOUSEHOLD MEMBERS (will also be deleted):' as info;
SELECT id, email, name, role, status
FROM users 
WHERE household_id = (SELECT household_id FROM users WHERE email = 'julianoliko@gmail.com')
AND email != 'julianoliko@gmail.com';

-- ============================================================================
-- STEP 2: ACTUAL DELETION
-- ============================================================================
-- WARNING: This is PERMANENT and cannot be undone!
-- ============================================================================

DO $$
DECLARE
    v_user_id UUID;
    v_household_id UUID;
    v_deleted_count INTEGER;
BEGIN
    -- Get user info
    SELECT id, household_id 
    INTO v_user_id, v_household_id
    FROM users 
    WHERE email = 'julianoliko@gmail.com';
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'User with email julianoliko@gmail.com NOT FOUND';
    END IF;
    
    RAISE NOTICE 'Starting deletion for user % in household %', v_user_id, v_household_id;
    
    -- 1. Delete push_subscriptions for ALL users in household
    DELETE FROM push_subscriptions 
    WHERE user_id IN (SELECT id FROM users WHERE household_id = v_household_id);
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % push_subscriptions', v_deleted_count;
    
    -- 2. Delete notifications (if table exists)
    BEGIN
        DELETE FROM notifications 
        WHERE household_id = v_household_id;
        GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
        RAISE NOTICE 'Deleted % notifications', v_deleted_count;
    EXCEPTION WHEN undefined_table THEN
        RAISE NOTICE 'notifications table does not exist, skipping';
    END;
    
    -- 3. Delete notification_queue (if table exists)
    BEGIN
        DELETE FROM notification_queue 
        WHERE household_id = v_household_id;
        GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
        RAISE NOTICE 'Deleted % notification_queue entries', v_deleted_count;
    EXCEPTION WHEN undefined_table THEN
        RAISE NOTICE 'notification_queue table does not exist, skipping';
    END;
    
    -- 4. Delete receipts (linked to expenses)
    DELETE FROM receipts 
    WHERE expense_id IN (SELECT id FROM expenses WHERE household_id = v_household_id);
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % receipts', v_deleted_count;
    
    -- 5. Delete expenses
    DELETE FROM expenses WHERE household_id = v_household_id;
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % expenses', v_deleted_count;
    
    -- 6. Delete todo_items
    DELETE FROM todo_items WHERE household_id = v_household_id;
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % todo_items', v_deleted_count;
    
    -- 7. Delete meals
    DELETE FROM meals WHERE household_id = v_household_id;
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % meals', v_deleted_count;
    
    -- 8. Delete essential_info
    DELETE FROM essential_info WHERE household_id = v_household_id;
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % essential_info entries', v_deleted_count;
    
    -- 9. Delete training_modules
    DELETE FROM training_modules WHERE household_id = v_household_id;
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % training_modules', v_deleted_count;
    
    -- 10. Delete house_routine
    DELETE FROM house_routine WHERE household_id = v_household_id;
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % house_routine entries', v_deleted_count;
    
    -- 11. Delete sections
    DELETE FROM sections WHERE household_id = v_household_id;
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % sections', v_deleted_count;
    
    -- 12. Delete ALL users in household
    DELETE FROM users WHERE household_id = v_household_id;
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % users', v_deleted_count;
    
    -- 13. Delete the household itself
    DELETE FROM households WHERE id = v_household_id;
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % households', v_deleted_count;
    
    RAISE NOTICE '';
    RAISE NOTICE '=== DELETION COMPLETE ===';
    RAISE NOTICE 'User julianoliko@gmail.com and all associated data have been permanently deleted.';
END $$;

-- ============================================================================
-- STEP 3: VERIFY DELETION
-- ============================================================================
SELECT 'VERIFICATION - Should return 0 rows:' as info;
SELECT * FROM users WHERE email = 'julianoliko@gmail.com';

