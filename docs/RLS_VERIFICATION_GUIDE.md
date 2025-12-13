# RLS Verification Guide

## Post-Deployment Testing

After deploying Clerk JWT integration and running the SQL migration, verify that RLS is working correctly.

## Step 1: Verify JWT Token is Being Sent

1. **Open Browser DevTools** → **Network** tab
2. **Sign in** to your app
3. **Look for Supabase requests** (filter by `supabase.co`)
4. **Check Request Headers** - you should see:
   ```
   Authorization: Bearer eyJhbGc...
   ```
5. If the header is missing, the JWT token is not being sent

**Troubleshooting:**
- Check that `SupabaseProvider` is wrapping your app in `index.tsx`
- Verify Clerk JWT template is named `supabase` (matches code)
- Check browser console for errors

## Step 2: Test Basic Functionality

Test that authenticated users can:
- ✅ View their household data (todo items, meals, expenses)
- ✅ Create new items
- ✅ Update existing items
- ✅ Delete items
- ✅ View household members
- ✅ Update their profile

**If any of these fail:**
- Check browser console for 403 Forbidden errors
- Verify JWT token is in request headers (Step 1)
- Check Supabase logs for policy violations

## Step 3: Test RLS Security (If Possible)

If you have access to multiple test accounts:

1. **Create two test households:**
   - Household A with User A
   - Household B with User B

2. **As User A:**
   - Create some todo items, meals, expenses
   - Note the household_id

3. **Sign out and sign in as User B:**
   - Try to access Household A's data
   - Should see empty results (not 403 errors, just no data)
   - Should NOT be able to see User A's items

4. **Verify User B can only see their own data:**
   - Create items as User B
   - Should only see User B's items

## Step 4: Check Supabase Logs

1. Go to **Supabase Dashboard** → **Logs** → **Postgres Logs**
2. Look for any errors related to:
   - `policy violation`
   - `permission denied`
   - `row-level security`

3. **Expected behavior:**
   - No errors for authenticated users accessing their own household data
   - Errors are expected for unauthenticated requests (if RLS is working)

## Step 5: Verify API Routes Still Work

API routes use service role key (bypasses RLS), so they should still work:

1. **Test invite creation:**
   - Create an invite via the app
   - Should work normally

2. **Test Stripe webhooks:**
   - If you have test webhooks, verify they process correctly
   - Check that subscription updates work

## Common Issues

### Issue: "403 Forbidden" on all queries

**Cause:** JWT token not being sent or invalid

**Fix:**
1. Verify Clerk JWT template is configured correctly
2. Check that template name matches code (`supabase`)
3. Verify `SupabaseProvider` is in the component tree
4. Check browser console for JWT errors

### Issue: "get_clerk_id() returns null"

**Cause:** JWT token doesn't include `clerk_id` claim

**Fix:**
1. Check Clerk JWT template includes: `{ "clerk_id": "{{user.id}}" }`
2. Verify template is active and saved
3. Try signing out and signing back in to get a fresh token

### Issue: "get_user_household_id() returns null"

**Cause:** User's `clerk_id` doesn't match what's in the database

**Fix:**
1. Check `users` table - verify `clerk_id` column is populated
2. Verify the `clerk_id` in database matches the one in JWT token
3. May need to update user records to sync `clerk_id`

### Issue: App works but RLS not enforced

**Cause:** Old permissive policies still active or code not using authenticated client

**Fix:**
1. Verify SQL migration ran successfully
2. Check Supabase Dashboard → Authentication → Policies
3. Verify policies use `get_user_household_id()` function
4. Update components to use `useSupabase()` hook instead of direct import

## Next Steps

Once verification is complete:

1. **Monitor for errors** in production
2. **Update remaining components** to use authenticated client (gradual migration)
3. **Set up error tracking** (Sentry, LogRocket, etc.)
4. **Document any custom policies** for your team

## Gradual Migration Strategy

Some components still use the old `supabase` import. This is okay for now, but you should gradually migrate them:

**Current (works but not secure):**
```typescript
import { supabase } from '../services/supabase';
```

**New (secure with RLS):**
```typescript
import { useSupabase } from '../contexts/SupabaseContext';

// In component:
const supabase = useSupabase();
```

**Priority components to update:**
- `components/Auth.tsx` - Critical for user creation
- `components/Profile.tsx` - User profile updates
- `components/Expenses.tsx` - Expense management
- `services/supabaseService.ts` - Core service functions

## Testing Checklist

- [ ] JWT token appears in request headers
- [ ] Authenticated users can access their data
- [ ] Users cannot access other households' data
- [ ] API routes still work (service role bypasses RLS)
- [ ] No errors in Supabase logs
- [ ] No errors in browser console
- [ ] All core features work (todo, meals, expenses, etc.)

