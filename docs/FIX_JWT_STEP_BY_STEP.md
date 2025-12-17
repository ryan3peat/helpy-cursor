# Step-by-Step: Fix JWT Token Issues

## ✅ Changes Made

1. **Updated `services/supabase.ts`** - Now uses custom fetch to ensure JWT is sent with every request
2. **Updated `contexts/SupabaseContext.tsx`** - Added diagnostic logging to track JWT initialization

---

## Step 1: Verify Clerk JWT Template

### 1.1 Go to Clerk Dashboard
1. Open [Clerk Dashboard](https://dashboard.clerk.com)
2. Select your application
3. Navigate to **Configure** → **JWT Templates**

### 1.2 Check/Create Template
- **If template exists:** Click on template named `supabase` (or your custom name)
- **If template doesn't exist:** Click **"New Template"**

### 1.3 Configure Template
- **Name:** `supabase` (or match `VITE_CLERK_JWT_TEMPLATE_NAME` in your `.env`)
- **Token Lifetime:** `3600` (1 hour) or higher
- **Custom Claims:** Add this JSON:
  ```json
  {
    "clerk_id": "{{user.id}}"
  }
  ```
- Click **Save**

### 1.4 Verify Environment Variable (Optional)
Check your `.env` file:
```env
VITE_CLERK_JWT_TEMPLATE_NAME=supabase
```
If you use a different template name, make sure it matches.

---

## Step 2: Clear Browser Cache & Refresh

1. **Hard refresh** your browser:
   - **Chrome/Edge:** `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
   - **Firefox:** `Ctrl+F5` (Windows) or `Cmd+Shift+R` (Mac)

2. **Or clear cache:**
   - Open DevTools (F12)
   - Right-click refresh button → **"Empty Cache and Hard Reload"**

---

## Step 3: Sign Out and Sign Back In

1. Sign out of your app completely
2. Sign back in
3. This ensures you get a fresh JWT token with the new claims

---

## Step 4: Check Browser Console

### 4.1 Open Console
1. Press `F12` to open DevTools
2. Go to **Console** tab
3. Clear the console (trash icon)

### 4.2 Look for These Logs

**✅ Good Signs:**
```
[SupabaseContext] 🔄 useEffect triggered { isSignedIn: true, hasGetToken: true }
[SupabaseContext] 🚀 initClient called { isSignedIn: true }
[SupabaseContext] Requesting JWT token with template: supabase
[SupabaseContext] Template token result: SUCCESS
[SupabaseContext] ✅ JWT token received: eyJ...
[SupabaseContext] JWT Claims: { clerk_id: "user_xxx", sub: "user_xxx", ... }
[SupabaseContext] ✅ clerk_id claim present: user_xxx
[Supabase] Creating authenticated client with JWT token
[Supabase] ✅ Authenticated client created, JWT will be sent in requests
```

**❌ Bad Signs:**
```
[SupabaseContext] ⚠️ User not signed in, using default client (no JWT)
[SupabaseContext] ❌ No JWT token received from Clerk
[SupabaseContext] ⚠️ clerk_id claim MISSING! RLS will fail.
```

### 4.3 If You See "User not signed in"
- Make sure you're actually signed in
- Check if Clerk is loaded: Look for `[Clerk]` logs
- Wait a few seconds for Clerk to initialize

---

## Step 5: Check Network Tab for JWT

### 5.1 Open Network Tab
1. In DevTools, go to **Network** tab
2. Clear network log (trash icon)
3. Refresh the page or trigger a Supabase request

### 5.2 Find Supabase Requests
1. Filter by typing: `supabase.co`
2. Look for requests like:
   - `GET /rest/v1/households`
   - `GET /rest/v1/users`
   - Any other Supabase API calls

### 5.3 Check Authorization Header
1. **Click on a Supabase request**
2. Go to **Headers** tab
3. Scroll to **Request Headers** section
4. Look for: **`Authorization`**

**✅ JWT is Being Sent:**
```
Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyX2FiYzEyMyIsImNsZXJrX2lkIjoidXNlcl9hYmMxMjMiLCJpYXQiOjE2NDAwMDAwMDAsImV4cCI6MTY0MDAzNjAwMH0...
```
- Should be a long token starting with `eyJ`
- Should be ~200-500 characters

**❌ JWT is NOT Being Sent:**
- No `Authorization` header at all
- Or `Authorization: Bearer null`
- Or `Authorization: Bearer undefined`

---

## Step 6: Run Diagnostic Tool

In browser console, run:
```javascript
await window.helpyDebugJwt();
```

This will show:
- ✅/❌ If JWT token is received
- ✅/❌ If `clerk_id` claim is present
- ✅/❌ If Supabase can read the claim
- ✅/❌ If data access works

---

## Step 7: Test in Supabase SQL Editor

**⚠️ IMPORTANT:** The SQL Editor runs with service role, so `get_clerk_id()` will return NULL there. This is normal!

To test if JWT is working, you need to test from your **browser app**, not SQL Editor.

---

## Step 8: Verify Errors Are Fixed

After completing steps 1-7, check if these errors are gone:

**Before (❌):**
- `406 (Not Acceptable)` errors
- `PGRST116: The result contains 0 rows`
- `usersInHousehold: 0`
- `Could not resolve user ID`

**After (✅):**
- No 406 errors
- Data loads successfully
- Users found in household
- App works normally

---

## Troubleshooting

### Issue: No `[SupabaseContext]` logs at all

**Possible causes:**
1. **Not signed in** - Check if `isSignedIn` is true
2. **Clerk not loaded** - Wait a few seconds, check for `[Clerk]` logs
3. **SupabaseProvider not mounted** - Check `index.tsx` to ensure it wraps `<App />`

**Fix:**
```javascript
// In browser console
console.log('Clerk user:', window.Clerk?.user);
console.log('Is signed in:', window.Clerk?.user ? 'YES' : 'NO');
```

### Issue: JWT token received but no `clerk_id` claim

**Fix:**
1. Go back to Clerk Dashboard → JWT Templates
2. Verify the template has: `{ "clerk_id": "{{user.id}}" }`
3. Save the template
4. Sign out and sign back in

### Issue: JWT in console but not in Network tab

**Fix:**
- The custom fetch should fix this
- Make sure you refreshed after the code changes
- Check if you see `[Supabase] Request with JWT:` logs

### Issue: Still getting 406 errors

**Check:**
1. Is `Authorization` header present in Network tab? ✅
2. Does the JWT have `clerk_id` claim? ✅ (check console logs)
3. Did you run migration `041_jwt_diagnostic_and_fix.sql`? ✅
4. Is user in database with matching `clerk_id`? (Check in Supabase Dashboard)

---

## Quick Checklist

- [ ] Clerk JWT template named `supabase` exists
- [ ] Template has `{ "clerk_id": "{{user.id}}" }` custom claim
- [ ] Hard refreshed browser after code changes
- [ ] Signed out and signed back in
- [ ] Console shows `[SupabaseContext] ✅ JWT token received`
- [ ] Console shows `[SupabaseContext] ✅ clerk_id claim present`
- [ ] Network tab shows `Authorization: Bearer eyJ...` header
- [ ] No more 406 errors
- [ ] App loads data successfully

---

## Still Having Issues?

Run this in browser console and share the output:
```javascript
// Full diagnostic
await window.helpyDebugJwt();

// Check if authenticated client exists
const { getAuthenticatedSupabaseClient } = await import('./contexts/SupabaseContext');
const client = getAuthenticatedSupabaseClient();
console.log('Authenticated client:', client ? 'EXISTS' : 'NULL');

// Check Clerk
console.log('Clerk user:', window.Clerk?.user?.id);
console.log('Is signed in:', !!window.Clerk?.user);
```




