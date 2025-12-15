-- ============================================================================
-- DEBUG: Why meals insert is failing with RLS policy error
-- ============================================================================
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- ============================================================================

-- From the error, we know:
-- User ID: 27c787f0-2140-48bc-8c5d-3167f3ebf10b
-- Household ID: 924138ce-c833-4bf2-9367-0a0bae7dcc83

-- ============================================================================
-- STEP 1: Check if the user exists and has a clerk_id
-- ============================================================================
SELECT 
    'USER CHECK' as info,
    id,
    email,
    name,
    role,
    clerk_id,
    household_id,
    status,
    created_at
FROM users 
WHERE id = '27c787f0-2140-48bc-8c5d-3167f3ebf10b';

-- ============================================================================
-- STEP 2: Check if the household exists
-- ============================================================================
SELECT 
    'HOUSEHOLD CHECK' as info,
    id,
    name,
    created_at
FROM households 
WHERE id = '924138ce-c833-4bf2-9367-0a0bae7dcc83';

-- ============================================================================
-- STEP 3: Check all users in the household
-- ============================================================================
SELECT 
    'HOUSEHOLD MEMBERS' as info,
    id,
    email,
    name,
    role,
    clerk_id,
    status
FROM users 
WHERE household_id = '924138ce-c833-4bf2-9367-0a0bae7dcc83';

-- ============================================================================
-- STEP 4: Test the RLS helper functions manually
-- ============================================================================

-- Test get_clerk_id() - this gets the clerk_id from the current JWT
-- If you're running this in SQL Editor, it will return NULL (no JWT in SQL Editor)
SELECT 'get_clerk_id() from SQL Editor' as info, get_clerk_id() as clerk_id;

-- Test get_user_household_id() - this looks up household based on clerk_id
SELECT 'get_user_household_id() from SQL Editor' as info, get_user_household_id() as household_id;

-- ============================================================================
-- STEP 5: Simulate what the RLS policy would check
-- ============================================================================

-- The meals INSERT policy is:
-- WITH CHECK (household_id = get_user_household_id())
-- 
-- If get_user_household_id() returns NULL (because clerk_id is missing from JWT
-- or doesn't match any user in the database), the insert will fail.

-- Let's manually check if the user's clerk_id would resolve to the correct household:
SELECT 
    'SIMULATED RLS CHECK' as info,
    u.id as user_id,
    u.clerk_id,
    u.household_id as user_household_id,
    '924138ce-c833-4bf2-9367-0a0bae7dcc83' as insert_household_id,
    CASE 
        WHEN u.household_id = '924138ce-c833-4bf2-9367-0a0bae7dcc83'::uuid 
        THEN 'WOULD PASS RLS'
        ELSE 'WOULD FAIL RLS'
    END as rls_result
FROM users u
WHERE u.id = '27c787f0-2140-48bc-8c5d-3167f3ebf10b';

-- ============================================================================
-- STEP 6: Check if there are multiple users with same email (duplicates)
-- ============================================================================
SELECT 
    'DUPLICATE CHECK' as info,
    email,
    COUNT(*) as count,
    array_agg(id) as user_ids,
    array_agg(clerk_id) as clerk_ids
FROM users
WHERE email IN (
    SELECT email FROM users WHERE id = '27c787f0-2140-48bc-8c5d-3167f3ebf10b'
)
GROUP BY email
HAVING COUNT(*) > 1;

-- ============================================================================
-- STEP 7: Check current RLS policies on meals table
-- ============================================================================
SELECT 
    'MEALS POLICIES' as info,
    policyname,
    cmd,
    qual as using_clause,
    with_check
FROM pg_policies 
WHERE tablename = 'meals'
ORDER BY policyname;

-- ============================================================================
-- DIAGNOSIS SUMMARY
-- ============================================================================
-- Common causes of RLS failure:
-- 
-- 1. JWT token not being sent with request
--    - Check browser console for "[Supabase] Request with JWT" logs
--    - Look for 401 errors on Supabase requests
--
-- 2. JWT doesn't have clerk_id claim
--    - Run window.helpyTestJWT() in browser console to see claims
--    - Should show: clerk_id: "user_xxx..."
--
-- 3. User's clerk_id in database doesn't match JWT
--    - This can happen if user was deleted and recreated
--    - The clerk_id in Clerk might be different from what's stored
--
-- 4. User doesn't belong to the household they're inserting into
--    - The user's household_id must match the data's household_id
--
-- FIX: If the user was recently recreated, check if the clerk_id in the
-- database matches the one in the JWT token from Clerk.
-- ============================================================================

