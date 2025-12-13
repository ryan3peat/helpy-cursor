# Quick RLS Test

## Immediate Verification Steps

### 1. Check JWT Token in Browser

1. Open your app in browser
2. Open DevTools (F12) → Network tab
3. Sign in to your app
4. Look for any request to `*.supabase.co`
5. Click on the request → Headers tab
6. Look for `Authorization: Bearer eyJ...` header

**✅ If you see the Authorization header:** JWT is being sent correctly
**❌ If missing:** Check SupabaseProvider is wrapping your app

### 2. Test a Simple Query

Open browser console and run:

```javascript
// This should work if JWT is being sent
const { data, error } = await supabase
  .from('todo_items')
  .select('*')
  .limit(1);

console.log('Data:', data);
console.log('Error:', error);
```

**✅ If you see data:** RLS is working, you can see your household's data
**❌ If you see 403 error:** JWT token not being sent or invalid
**❌ If you see empty array:** RLS is working (no data in your household)

### 3. Check Supabase Logs

1. Go to Supabase Dashboard → Logs → Postgres Logs
2. Look for recent errors
3. Filter for "policy" or "RLS"

**✅ No errors:** Everything working
**❌ Policy violations:** Check JWT token configuration

## Common Issues After Deployment

### Issue: "All queries return 403 Forbidden"

**Cause:** Components are still using old `supabase` import (doesn't send JWT)

**Fix:** Update components to use `useSupabase()` hook from context

**Affected files:**
- `components/Auth.tsx`
- `components/Profile.tsx`  
- `components/Expenses.tsx`
- `services/supabaseService.ts`

### Issue: "JWT token missing in requests"

**Cause:** SupabaseProvider not initialized or Clerk not signed in

**Fix:**
1. Verify `SupabaseProvider` wraps `<App />` in `index.tsx`
2. Check that user is signed in before making queries
3. Verify Clerk JWT template is active

### Issue: "get_user_household_id() returns null"

**Cause:** User's `clerk_id` not set in database or doesn't match JWT

**Fix:**
1. Check `users` table - verify `clerk_id` column has values
2. The `clerk_id` should match the `clerk_id` in the JWT token
3. May need to update existing users to set `clerk_id`

## Next Steps

Once basic verification passes:
1. Test all features (todo, meals, expenses, etc.)
2. Update remaining components to use authenticated client
3. Monitor for errors in production

