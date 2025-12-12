# How to Check if JWT Token is Being Sent

## Step-by-Step Instructions

### 1. Open Browser DevTools
- Press `F12` or right-click → Inspect
- Go to **Network** tab

### 2. Clear Network Log
- Right-click in Network tab → **Clear**

### 3. Sign In to Your App
- This will trigger Supabase requests

### 4. Find Supabase Requests
- Look for requests to `*.supabase.co`
- Specifically look for:
  - `POST /rest/v1/households`
  - `GET /rest/v1/users`
  - Any other Supabase requests

### 5. Check Request Headers
- **Click on a request** (e.g., the POST to households)
- Go to **Headers** tab
- Scroll down to **Request Headers** section
- Look for: **`Authorization`**

### 6. What to Look For

**✅ JWT is Being Sent:**
```
Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyX2FiYzEyMyIsImNsZXJrX2lkIjoidXNlcl9hYmMxMjMiLCJpYXQiOjE2NDAwMDAwMDAsImV4cCI6MTY0MDAzNjAwMH0...
```
- Long token starting with `eyJ`
- Should be ~200-500 characters

**❌ JWT is NOT Being Sent:**
- No `Authorization` header at all
- Or `Authorization: Bearer null`
- Or `Authorization: Bearer undefined`

## Alternative: Check in Console

Add this temporarily to see if JWT is being generated:

```javascript
// In browser console after signing in
const { useAuth } = require('@clerk/clerk-react');
// Actually, better to check in SupabaseContext logs
```

Look for console logs:
- `[SupabaseContext] ✅ JWT token received` - Good!
- `[SupabaseContext] ❌ No JWT token received` - Problem!

## Check Supabase Logs

1. Go to **Supabase Dashboard** → **Logs** → **API Logs**
2. Look for requests from your app
3. Check if requests have `Authorization` header
4. Look for 401 errors (indicates missing/invalid JWT)

## Check Clerk Logs

1. Go to **Clerk Dashboard** → **Sessions**
2. Find your active session
3. Check if JWT tokens are being generated
4. Look for any errors

## If JWT is Missing

The most common causes:
1. **SupabaseProvider not initialized** - Check it wraps `<App />`
2. **User not signed in** - Check `isSignedIn` is true
3. **JWT template not configured** - Check Clerk Dashboard
4. **Timing issue** - Client not ready when Auth tries to use it

## Quick Fix Test

In browser console (after signing in):
```javascript
// Check if SupabaseProvider has authenticated client
// This is a bit tricky from console, but you can check Network tab
```

The Network tab is the most reliable way to verify JWT is being sent.
