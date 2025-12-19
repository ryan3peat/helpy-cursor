-- TEMPORARY: Disable RLS to test if data exists
-- This will allow all queries to work without authentication
-- REMOVE THIS AFTER TESTING

ALTER TABLE households DISABLE ROW LEVEL SECURITY;
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- Now test if the data exists
SELECT 'Testing household access...' as test;
SELECT id, subscription_plan, subscription_status FROM households WHERE id = 'ecb34564-470c-41ea-a7ef-ed7446dd853d';

SELECT 'Testing user lookup...' as test;
SELECT id, clerk_id, household_id, name FROM users WHERE clerk_id = 'user_36Ld8EjKmnxbbRGarGSspohmQhw';

-- Check if user belongs to household
SELECT 'Testing relationship...' as test,
  u.id, u.clerk_id, u.household_id, u.name,
  h.id as household_id, h.subscription_plan
FROM users u
LEFT JOIN households h ON u.household_id = h.id
WHERE u.clerk_id = 'user_36Ld8EjKmnxbbRGarGSspohmQhw';

-- RE-ENABLE RLS AFTER TESTING
-- ALTER TABLE households ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;




