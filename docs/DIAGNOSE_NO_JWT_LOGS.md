# Diagnose: No JWT Logs Appearing

If you're not seeing any `[SupabaseContext]` logs, follow these steps:

## Step 1: Check Console Filter

1. Open DevTools Console (F12)
2. **Clear the console** (trash icon)
3. **Check the filter** - Make sure it's not filtering out logs
   - Look for a filter/search box at the top
   - Clear any text in it
   - Make sure "All levels" or "Verbose" is selected

## Step 2: Check if SupabaseContext is Mounting

After refreshing the page, you should see:
```
[SupabaseContext] 🎯 Component rendering/mounting
[SupabaseContext] Clerk available: true
[SupabaseContext] useAuth result: { hasGetToken: true, isSignedIn: true, ... }
[SupabaseContext] 📊 Current state: { isSignedIn: true, ... }
[SupabaseContext] 🔄 useEffect triggered { isSignedIn: true, ... }
```

**If you see NONE of these logs:**
- SupabaseProvider is not mounting
- Check `index.tsx` to ensure `<SupabaseProvider>` wraps `<App />`
- Check if there's a JavaScript error preventing React from rendering

## Step 3: Manual JWT Test

In browser console, run:
```javascript
await window.helpyTestJWT();
```

This will:
- Check if Clerk is available
- Check if user is signed in
- Attempt to get JWT token manually
- Show token claims

**Expected output:**
```
🔍 Manual JWT Test Starting...
Clerk available: true
isSignedIn: true
getToken available: true
📝 Attempting to get token with template: supabase
✅ Token received! Length: 500
Token preview: eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
📋 Token claims: { clerk_id: "user_xxx", sub: "user_xxx", ... }
clerk_id claim: user_xxx
```

**If you see errors:**
- `User is not signed in` → Sign in first
- `getToken function not available` → Clerk not loaded
- `Token is NULL` → JWT template not configured

## Step 4: Check Clerk Status

Run in console:
```javascript
// Check Clerk
console.log('Clerk object:', window.Clerk);
console.log('Clerk user:', window.Clerk?.user);
console.log('Is signed in:', !!window.Clerk?.user);
console.log('Session:', window.Clerk?.session);
```

**Expected:**
- `Clerk object:` should show an object (not `undefined`)
- `Clerk user:` should show user object if signed in
- `Is signed in:` should be `true` if signed in

## Step 5: Check Network Tab for Authorization Header

1. Open **Network** tab in DevTools
2. Filter by: `supabase.co`
3. Click on any failed request (406 error)
4. Go to **Headers** tab
5. Scroll to **Request Headers**
6. Look for `Authorization: Bearer ...`

**If Authorization header is missing:**
- JWT is not being sent
- This confirms the issue

**If Authorization header exists:**
- JWT is being sent but might be invalid
- Check if it has `clerk_id` claim (decode it at jwt.io)

## Step 6: Check if SupabaseProvider is in the Component Tree

Run in console:
```javascript
// This will show React component tree (if React DevTools is installed)
// Or check manually in index.tsx
```

Check `index.tsx` - it should look like:
```tsx
<ClerkProvider>
  <SupabaseProvider>
    <App />
  </SupabaseProvider>
</ClerkProvider>
```

## Common Issues & Fixes

### Issue 1: No logs at all
**Cause:** Console filter or SupabaseProvider not mounting
**Fix:** 
- Clear console filter
- Check `index.tsx` structure
- Check for JavaScript errors preventing render

### Issue 2: `isSignedIn: false`
**Cause:** User not signed in or Clerk not loaded
**Fix:**
- Sign in to your app
- Wait for Clerk to initialize (check for `[Clerk]` logs)
- Check if ClerkProvider is wrapping the app

### Issue 3: `getToken is not a function`
**Cause:** Clerk not loaded or useAuth hook failing
**Fix:**
- Check if ClerkProvider is in component tree
- Check for Clerk initialization errors
- Verify Clerk publishable key is correct

### Issue 4: Token is NULL
**Cause:** JWT template not configured in Clerk
**Fix:**
- Go to Clerk Dashboard → JWT Templates
- Create template named `supabase`
- Add claim: `{ "clerk_id": "{{user.id}}" }`
- Sign out and back in

## Quick Diagnostic Script

Run this all at once in console:
```javascript
(async () => {
  console.log('=== JWT DIAGNOSTIC ===');
  console.log('1. Clerk available:', !!window.Clerk);
  console.log('2. User signed in:', !!window.Clerk?.user);
  console.log('3. Test JWT retrieval:');
  await window.helpyTestJWT();
  console.log('4. Check authenticated client:');
  const { getAuthenticatedSupabaseClient } = await import('./contexts/SupabaseContext');
  const client = getAuthenticatedSupabaseClient();
  console.log('   Client exists:', !!client);
  console.log('=== END DIAGNOSTIC ===');
})();
```

## Next Steps

After running diagnostics, share:
1. What logs you see (or don't see)
2. Result of `window.helpyTestJWT()`
3. Whether Authorization header exists in Network tab
4. Any errors in console
