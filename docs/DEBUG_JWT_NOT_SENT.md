# Debug: JWT Token Not Being Sent

## Problem
- 401 Unauthorized errors
- No `Authorization: Bearer ...` header in Network tab
- RLS policy violations

## How to Check if JWT is Being Sent

### Method 1: Network Tab (Most Reliable)

1. **Open DevTools** → **Network** tab
2. **Clear network log**
3. **Sign in** to your app
4. **Find request** to `*.supabase.co` (e.g., POST to `/rest/v1/households`)
5. **Click on the request**
6. **Go to "Headers" tab**
7. **Look in "Request Headers"** section
8. **Find "Authorization"** header

**What to look for:**
- ✅ `Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...` (long token)
- ❌ No `Authorization` header at all
- ❌ `Authorization: Bearer null` or empty

### Method 2: Browser Console

Add this to your code temporarily to log the token:

```javascript
// In SupabaseContext.tsx, add logging:
const token = await getToken({ template: 'supabase' });
console.log('[DEBUG] JWT Token:', token ? `Present (${token.length} chars)` : 'MISSING');
console.log('[DEBUG] Token preview:', token?.substring(0, 50));
```

### Method 3: Check SupabaseContext Logs

Look in browser console for:
- `[SupabaseContext] Failed to create authenticated client` - JWT issue
- `[SupabaseContext] No JWT token received` - Template not working
- No logs at all - SupabaseProvider might not be initializing

## Common Causes

### 1. SupabaseProvider Not Initialized

**Check:**
- Is `SupabaseProvider` wrapping `<App />` in `index.tsx`?
- Is it inside `<ClerkProvider>`?

**Fix:**
```tsx
<ClerkProvider>
  <SupabaseProvider>
    <App />
  </SupabaseProvider>
</ClerkProvider>
```

### 2. User Not Signed In Yet

**Check:**
- Is `isSignedIn` true when SupabaseProvider initializes?
- Check console for Clerk authentication status

**Fix:**
- SupabaseProvider waits for `isSignedIn` to be true
- If user signs in after component mounts, client might not update

### 3. JWT Template Not Configured

**Check:**
- Go to Clerk Dashboard → JWT Templates
- Verify template named `supabase` exists
- Verify it has `clerk_id` claim

**Fix:**
- Create/configure the template
- Sign out and back in to get fresh token

### 4. Timing Issue - Client Not Ready

**Problem:**
- Auth component tries to use `supabase` before SupabaseProvider initializes
- `useSupabase()` returns null initially

**Fix:**
- Add null check in Auth component
- Wait for client to be ready before making queries

## Quick Test

Add this to `Auth.tsx` to debug:

```typescript
const supabase = useSupabase();

useEffect(() => {
  console.log('[Auth Debug] Supabase client:', supabase ? 'Ready' : 'Not ready');
  console.log('[Auth Debug] Client type:', supabase?.supabaseUrl ? 'Authenticated' : 'Default');
}, [supabase]);
```

## Check Supabase Logs

1. Go to **Supabase Dashboard** → **Logs** → **API Logs**
2. Look for requests from your app
3. Check if requests have `Authorization` header
4. Look for 401 errors

## Check Clerk Logs

1. Go to **Clerk Dashboard** → **Sessions**
2. Find your active session
3. Check if JWT tokens are being generated
4. Look for any errors in token generation

## Expected Flow

1. User signs in with Clerk
2. ClerkProvider provides `getToken()` function
3. SupabaseProvider calls `getToken({ template: 'supabase' })`
4. Clerk returns JWT token with `clerk_id` claim
5. SupabaseProvider creates authenticated client with token
6. All Supabase requests include `Authorization: Bearer <token>` header
7. Supabase verifies JWT and extracts `clerk_id`
8. RLS policies use `get_clerk_id()` to check access

## If JWT Still Not Being Sent

1. **Check SupabaseProvider is in component tree**
2. **Verify Clerk user is signed in** (`isSignedIn === true`)
3. **Check JWT template exists and is active**
4. **Sign out and back in** (forces fresh token)
5. **Check browser console for errors**

