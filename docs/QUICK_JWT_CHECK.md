# Quick JWT Check - Browser Console

## Method 1: Check Network Tab (Most Reliable)

1. **Open DevTools** (F12)
2. **Network** tab
3. **Clear** network log
4. **Sign in** to app
5. **Find request** to `*.supabase.co` (e.g., POST `/rest/v1/households`)
6. **Click request** → **Headers** tab
7. **Look for** `Authorization: Bearer eyJ...` in Request Headers

**If you see it:** ✅ JWT is being sent
**If missing:** ❌ JWT is not being sent

## Method 2: Check Console Logs

After signing in, look for these logs in browser console:

**Good signs:**
- `[SupabaseContext] ✅ JWT token received: eyJ...`
- `[SupabaseContext] ✅ Authenticated Supabase client created`
- `[Supabase] Creating authenticated client with JWT token`

**Bad signs:**
- `[SupabaseContext] ❌ No JWT token received`
- `[SupabaseContext] Failed to create authenticated client`
- `No JWT template exists with name: supabase`

## Method 3: Test in Console

After signing in, run this in browser console:

```javascript
// Check if we can get JWT token
// Note: This requires Clerk to be loaded
const checkJWT = async () => {
  try {
    // Access Clerk's getToken (this is a bit hacky but works)
    const clerk = window.Clerk;
    if (clerk && clerk.user) {
      const token = await clerk.user.getToken({ template: 'supabase' });
      console.log('JWT Token:', token ? `Present (${token.length} chars)` : 'MISSING');
      console.log('Token preview:', token?.substring(0, 50));
      return token;
    } else {
      console.log('Clerk not loaded or user not signed in');
      return null;
    }
  } catch (e) {
    console.error('Error getting JWT:', e);
    return null;
  }
};

checkJWT();
```

## What the Errors Mean

### 401 Unauthorized
- **Meaning:** Supabase rejected the request
- **Cause:** No JWT token or invalid JWT
- **Fix:** Check Network tab for Authorization header

### 42501 RLS Policy Violation
- **Meaning:** JWT token exists but RLS policy blocked the operation
- **Cause:** Policy check failed (e.g., `get_clerk_id()` returned NULL)
- **Fix:** Check if JWT has `clerk_id` claim

### No Authorization Header
- **Meaning:** JWT token not being sent
- **Cause:** SupabaseProvider not initialized or using default client
- **Fix:** Check SupabaseProvider is in component tree

## Expected Flow

1. User signs in → Clerk provides session
2. SupabaseProvider calls `getToken({ template: 'supabase' })`
3. Clerk returns JWT with `clerk_id` claim
4. SupabaseProvider creates authenticated client
5. All requests include `Authorization: Bearer <token>` header
6. Supabase verifies JWT and extracts `clerk_id`
7. RLS policies use `get_clerk_id()` to check access

## If JWT is Still Missing

1. **Check SupabaseProvider logs** in console
2. **Verify Clerk JWT template** exists and is active
3. **Sign out and back in** (forces fresh token)
4. **Check Network tab** for Authorization header
5. **Check Supabase logs** for 401 errors




