# Troubleshoot RLS INSERT Policy Violations

## Current Error
```
new row violates row-level security policy for table "households"
401 Unauthorized
```

## Possible Causes

### 1. JWT Token Not Being Sent

**Check:**
1. Open browser DevTools → Network tab
2. Find the POST request to `/rest/v1/households`
3. Check Request Headers
4. Look for: `Authorization: Bearer eyJ...`

**If missing:**
- SupabaseProvider might not be initialized
- User might not be signed in
- Clerk JWT template might not be configured

### 2. JWT Token Not Verified by Supabase

**Check:**
- Go to Supabase Dashboard → Authentication → Providers
- Verify Clerk is added and enabled
- Check that your Clerk domain is correct (e.g., `clerk.helpyfam.com`)

### 3. INSERT Policy Not Applied

**Check:**
Run this SQL in Supabase SQL Editor:
```sql
SELECT policyname, with_check 
FROM pg_policies 
WHERE tablename = 'households' 
AND cmd = 'INSERT';
```

**Should show:**
- Policy name: "Authenticated users can create households"
- WITH CHECK: `get_clerk_id() IS NOT NULL`

### 4. get_clerk_id() Returns NULL

**Possible reasons:**
- JWT token doesn't include `clerk_id` claim
- Clerk JWT template not configured correctly
- JWT token format is wrong

**Check Clerk JWT Template:**
1. Go to Clerk Dashboard → Configure → JWT Templates
2. Find template named `supabase` (or your custom name)
3. Verify it has custom claim: `{ "clerk_id": "{{user.id}}" }`

## Quick Fixes

### Fix 1: Re-run INSERT Policy Migration

Run `migrations/032_fix_household_insert_final.sql` to ensure policies are correct.

### Fix 2: Verify JWT is Being Sent

In browser console, run:
```javascript
// Check if SupabaseProvider is working
const { getToken } = useAuth();
const token = await getToken({ template: 'supabase' });
console.log('JWT Token:', token ? 'Present' : 'Missing');
console.log('Token preview:', token?.substring(0, 50));
```

### Fix 3: Test Policy Directly

Run this in Supabase SQL Editor (while signed in):
```sql
-- This will show what get_clerk_id() returns
-- Should return NULL if run from SQL Editor (no JWT in SQL context)
SELECT get_clerk_id() as clerk_id_from_jwt;
```

## Step-by-Step Debugging

1. **Check JWT in browser:**
   - DevTools → Network → Find households POST request
   - Check Authorization header exists

2. **Check policies in database:**
   - Run `migrations/033_diagnose_jwt_and_policies.sql`
   - Verify INSERT policies exist

3. **Check Clerk configuration:**
   - Verify JWT template exists and has `clerk_id` claim
   - Verify Supabase has Clerk configured in Authentication → Providers

4. **Test sign-up flow:**
   - Try signing up a new user
   - Check console for specific error messages
   - Check Network tab for request/response details

## Expected Behavior After Fix

- ✅ New users can create households during sign-up
- ✅ Existing users can sign in without errors
- ✅ No RLS policy violations in console
- ✅ No 401 Unauthorized errors




