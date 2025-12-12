# Verify JWT Token is Being Sent

## Quick Test in Browser Console

After signing in, open browser console and run:

```javascript
// Check if SupabaseProvider has authenticated client
const { useAuth } = require('@clerk/clerk-react');
// Actually, better to check in Network tab
```

## Better: Check Network Tab

1. **Open DevTools** → **Network** tab
2. **Clear network log** (right-click → Clear)
3. **Sign in** to your app
4. **Look for requests** to `*.supabase.co`
5. **Click on a request** (e.g., POST to `/rest/v1/households`)
6. **Check Request Headers**:
   - Look for: `Authorization: Bearer eyJ...`
   - If present: ✅ JWT is being sent
   - If missing: ❌ JWT is not being sent

## If JWT is Missing

### Check 1: SupabaseProvider is Initialized

In browser console:
```javascript
// Check if SupabaseContext is available
console.log('SupabaseProvider should be in component tree');
```

### Check 2: User is Signed In

```javascript
// Check Clerk user
const { useUser } = require('@clerk/clerk-react');
// User should be signed in
```

### Check 3: JWT Template Exists

1. Go to **Clerk Dashboard** → **Configure** → **JWT Templates**
2. Verify template named `supabase` exists
3. Verify it has claim: `{ "clerk_id": "{{user.id}}" }`

### Check 4: SupabaseContext Logs

Look in browser console for:
- `[SupabaseContext] Failed to create authenticated client` - indicates JWT token issue
- `[SupabaseContext] No JWT token received` - JWT template not working

## Expected Behavior

After deploying updated `Auth.tsx`:
- ✅ Auth component uses `useSupabase()` hook
- ✅ Authenticated client includes JWT in headers
- ✅ Requests to Supabase include `Authorization: Bearer ...` header
- ✅ RLS policies can read `clerk_id` from JWT

## Next Steps

1. **Deploy updated `Auth.tsx`** (uses authenticated client)
2. **Test sign-in** - check Network tab for JWT header
3. **If JWT is present** - RLS should work
4. **If JWT is missing** - check SupabaseContext logs and Clerk JWT template
