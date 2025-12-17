# RLS UI Display Issue

## Problem
Supabase Table Editor shows "RLS disabled" or "unrestricted" even though RLS policies are in place.

## Why This Happens

The Supabase UI can sometimes show misleading information:
- **"Unrestricted"** doesn't mean RLS is disabled - it means the policies allow access (which is correct for authenticated users)
- The UI might cache old information
- The UI might not reflect the actual database state

## How to Verify RLS is Actually Enabled

### Method 1: Run Verification SQL

Run the SQL in `migrations/028_verify_rls_status.sql` to check:
1. Which tables have RLS enabled
2. What policies exist
3. If helper functions are created

### Method 2: Test RLS Directly

1. **Test as authenticated user:**
   - Sign in to your app
   - Try to query data - should work (you can see your household's data)

2. **Test security (if possible):**
   - Create a test user in a different household
   - Sign in as that user
   - Try to query the first household's data - should return empty (RLS blocking)

3. **Test without JWT:**
   - Open browser console
   - Try: `await supabase.from('todo_items').select('*')`
   - Should fail with 403 or return empty (RLS blocking)

### Method 3: Check Database Directly

Run this SQL in Supabase SQL Editor:

```sql
-- Check RLS status for a specific table
SELECT 
  tablename,
  rowsecurity as "RLS Enabled"
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename = 'todo_items';  -- Change table name

-- Check policies for a specific table
SELECT 
  policyname,
  cmd as "Command",
  qual as "USING Expression"
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'todo_items';  -- Change table name
```

## What "Unrestricted" Actually Means

In Supabase UI, "unrestricted" can mean:
- ✅ RLS is enabled, but policies allow access for authenticated users (this is correct!)
- ❌ RLS is actually disabled (this would be a problem)

The key is: **Are your policies working?** If authenticated users can access their data and others can't, RLS is working correctly.

## If RLS is Actually Disabled

If verification shows RLS is disabled, re-run the migration:

```sql
-- Enable RLS on a specific table
ALTER TABLE todo_items ENABLE ROW LEVEL SECURITY;

-- Or enable on all tables at once
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT tablename 
    FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename NOT LIKE 'pg_%'
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', r.tablename);
  END LOOP;
END $$;
```

## Expected Behavior

With RLS enabled and policies in place:
- ✅ Authenticated users can access their household's data
- ✅ Users cannot access other households' data
- ✅ Unauthenticated requests are blocked
- ✅ API routes (using service role) still work

If this matches your app's behavior, RLS is working correctly regardless of what the UI says!




