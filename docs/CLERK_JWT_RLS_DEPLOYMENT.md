# Clerk JWT RLS Deployment Guide

## Overview
This guide walks through deploying Clerk JWT integration with Supabase RLS policies for production security.

## Prerequisites
- Clerk account with production keys configured
- Supabase production project
- Code updated with authenticated Supabase client (Step 2 completed)

## Deployment Order

### ⚠️ CRITICAL: Deploy Code FIRST, Then Run SQL

**You MUST deploy the updated code (Step 2) BEFORE running the SQL migration.**

**Why?** The new RLS policies require Clerk JWT tokens to be sent with every request. If you run the SQL before deploying the code:
- All Supabase queries will fail (403 Forbidden)
- Users won't be able to access any data
- The app will be broken

**Safe deployment order:**
1. ✅ Configure Clerk JWT template (Step 1)
2. ✅ Deploy updated code to Vercel (Step 2) 
3. ✅ Test that app still works (should work with old permissive policies)
4. ✅ Run SQL migration in Supabase (Step 4)
5. ✅ Test that RLS is working correctly

## Step 1: Configure Clerk JWT Template

1. Go to **Clerk Dashboard** → **Configure** → **JWT Templates**
2. Click **"New template"** or edit the default template
3. Configure:
   - **Name**: `supabase` (must match the template name in code)
   - **Token lifetime**: `3600` seconds (1 hour)
   - **Claims**: Add custom claim:
     ```json
     {
       "clerk_id": "{{user.id}}"
     }
     ```
4. **Save** the template
5. Note the template name (should be `supabase`)

## Step 2: Deploy Updated Code

The following files have been updated:
- `services/supabase.ts` - Added `createAuthenticatedClient` function
- `contexts/SupabaseContext.tsx` - New context provider for authenticated client
- `index.tsx` - Wrapped app with `SupabaseProvider`

**Deploy to Vercel:**
1. Commit and push changes to your repository
2. Vercel will automatically deploy
3. Wait for deployment to complete
4. Test the app - it should still work (using old permissive RLS policies)

## Step 3: Verify Code is Working

After deployment, verify:
1. App loads without errors
2. Users can sign in
3. Data loads correctly (todo items, meals, expenses, etc.)
4. Check browser console for any errors

**If everything works, proceed to Step 4.**

## Step 4: Run SQL Migration

**⚠️ Only run this AFTER Step 2 is deployed and tested!**

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Open the file: `migrations/027_clerk_jwt_rls_policies.sql`
3. Copy the entire SQL content
4. Paste into SQL Editor
5. Click **"Run"**

This migration will:
- Create helper functions (`get_clerk_id()`, `get_user_household_id()`)
- Replace all permissive RLS policies with secure policies
- Enable proper access control based on Clerk JWT tokens

## Step 5: Test RLS Policies

After running the SQL:

1. **Test as authenticated user:**
   - Sign in to the app
   - Verify you can see your household's data
   - Try creating/updating/deleting items
   - Everything should work normally

2. **Test security (if possible):**
   - Create a test user in a different household
   - Sign in as that user
   - Verify you CANNOT see the first household's data
   - Verify you CAN see your own household's data

3. **Check for errors:**
   - Monitor browser console for 403 errors
   - Check Supabase logs for policy violations
   - Verify API routes still work (they use service role key)

## Troubleshooting

### Error: "JWT token missing or invalid"
- **Cause**: Clerk JWT template not configured or wrong template name
- **Fix**: Verify Clerk JWT template is named `supabase` and includes `clerk_id` claim

### Error: "403 Forbidden" on all queries
- **Cause**: Code not deployed yet, or JWT not being sent
- **Fix**: 
  1. Verify code is deployed (check Vercel)
  2. Check browser Network tab - verify `Authorization: Bearer <token>` header is present
  3. Verify `SupabaseProvider` is wrapping your app

### Error: "get_clerk_id() returns null"
- **Cause**: JWT token not being sent or Clerk template not configured correctly
- **Fix**: 
  1. Check Clerk JWT template includes `clerk_id` claim
  2. Verify template name matches in code (`supabase`)
  3. Check browser console for JWT token errors

### App works but RLS not enforced
- **Cause**: Old permissive policies still active
- **Fix**: Verify SQL migration ran successfully, check Supabase policies

## Rollback Plan

If something goes wrong:

1. **Quick rollback (restore permissive policies):**
   ```sql
   -- Run migration 004 again to restore permissive policies
   -- This will make everything accessible again
   ```

2. **Full rollback:**
   - Revert code changes in Git
   - Redeploy to Vercel
   - Run migration 004 to restore permissive policies

## Files Changed

- ✅ `services/supabase.ts` - Added authenticated client function
- ✅ `contexts/SupabaseContext.tsx` - New context provider
- ✅ `index.tsx` - Added SupabaseProvider wrapper
- ✅ `migrations/027_clerk_jwt_rls_policies.sql` - Secure RLS policies

## Next Steps

After successful deployment:
1. Monitor error logs for any RLS policy violations
2. Test all features thoroughly
3. Consider adding more granular policies if needed
4. Document any custom policies for your team

## Support

If you encounter issues:
1. Check Supabase logs: Dashboard → Logs → Postgres Logs
2. Check browser console for errors
3. Verify Clerk JWT template configuration
4. Test with a simple query to verify JWT is being sent
