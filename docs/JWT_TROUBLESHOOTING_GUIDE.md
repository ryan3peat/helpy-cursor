# JWT & RLS Troubleshooting Guide

This guide helps diagnose and fix JWT token issues between Clerk and Supabase.

## Quick Diagnosis

### Step 1: Run the JWT Debug Tool

Open your browser console and run:

```javascript
window.helpyDebugJwt()
```

This will check:
- If the authenticated Supabase client exists
- If JWT tokens are being retrieved from Clerk
- If the `clerk_id` claim is present in the JWT
- If Supabase can read the `clerk_id` from the JWT
- If RLS policies are allowing data access

### Step 2: Check for Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `406 Not Acceptable` | RLS blocking access | JWT missing or `clerk_id` claim missing |
| `PGRST116` | Query returned 0 rows but `.single()` expected 1 | RLS blocking, data doesn't exist, or wrong ID |
| `usersInHousehold: 0` | No users found in household | User not in database or RLS blocking |
| `400 Bad Request` | Invalid query parameters | Check column types match query values |

---

## A) Verify Clerk JWT Template is Working

### Step 1: Check if JWT Template Exists

1. Go to [Clerk Dashboard](https://dashboard.clerk.com)
2. Navigate to **Configure** → **JWT Templates**
3. Look for a template named `supabase` (or whatever `VITE_CLERK_JWT_TEMPLATE_NAME` is set to)

### Step 2: Verify Template Configuration

Your template should have these settings:

**Name:** `supabase`

**Claims (Custom Claims section):**
```json
{
  "clerk_id": "{{user.id}}"
}
```

**Lifetime:** 60 seconds (or higher)

### Step 3: Test Token Retrieval

In browser console:
```javascript
// Check if template is working
const result = await window.Clerk.session.getToken({ template: 'supabase' });
console.log('Token:', result);

// Decode to see claims
const payload = JSON.parse(atob(result.split('.')[1]));
console.log('Claims:', payload);
// Should show: { ..., clerk_id: "user_xxxx", ... }
```

### Step 4: Common JWT Template Issues

| Issue | Symptom | Fix |
|-------|---------|-----|
| Template doesn't exist | `getToken()` returns null | Create template in Clerk Dashboard |
| Missing `clerk_id` claim | `get_clerk_id()` returns NULL in Supabase | Add `{ "clerk_id": "{{user.id}}" }` to template |
| Wrong template name | Token works but no `clerk_id` | Check `VITE_CLERK_JWT_TEMPLATE_NAME` matches |
| Token expired | Works briefly then fails | Increase token lifetime in Clerk |

---

## B) Verify Supabase is Using the JWT Template

### Step 1: Check Network Tab

1. Open Browser DevTools → **Network** tab
2. Filter by `supabase.co`
3. Click on any request to your Supabase project
4. Look at **Headers** → **Request Headers**
5. Find `Authorization: Bearer eyJ...`

If `Authorization` header is missing:
- JWT is not being sent
- Check `SupabaseContext.tsx` is wrapping your app
- Check for console errors about JWT

### Step 2: Decode the JWT in Network Tab

Copy the token (after "Bearer ") and decode it:
```javascript
// In browser console
const token = "eyJ..."; // paste your token
const payload = JSON.parse(atob(token.split('.')[1]));
console.log(payload);
```

**Expected output:**
```json
{
  "sub": "user_abc123...",
  "clerk_id": "user_abc123...",  // <-- THIS IS REQUIRED
  "iat": 1234567890,
  "exp": 1234567950,
  "iss": "https://clerk.your-app.com"
}
```

**If `clerk_id` is missing:** Your JWT template is not configured correctly.

### Step 3: Test Supabase Functions Directly

Run this SQL in Supabase SQL Editor (while signed in to your app):

```sql
-- Check if JWT is reaching Supabase
SELECT get_clerk_id() as clerk_id;

-- If this returns NULL, JWT is not working
-- If this returns your clerk_id (user_xxx), JWT is working

-- Check if user exists with that clerk_id
SELECT id, clerk_id, household_id, email 
FROM users 
WHERE clerk_id = get_clerk_id();

-- Check what household the user should access
SELECT get_user_household_id() as household_id;
```

---

## C) Verify It Works in the App

### Step 1: Console Checks

After signing in, check browser console for these messages:

**Good signs:**
```
[SupabaseContext] ✅ JWT token received: eyJ...
[SupabaseContext] ✅ Authenticated Supabase client created
[App] Basic auth test passed
```

**Bad signs:**
```
[SupabaseContext] ❌ No JWT token received from Clerk
[App] Basic auth test failed
[App] Household fetch error: ...
```

### Step 2: Test Data Access

In browser console:
```javascript
// This should work if JWT is correct
const { data, error } = await window.supabase
  .from('users')
  .select('id, clerk_id')
  .limit(1);

console.log('Data:', data, 'Error:', error);
```

If this returns empty array or error, RLS is blocking.

### Step 3: Full Debug Run

```javascript
// Run comprehensive debug
await window.helpyDebugJwt();
```

Check the summary for any ❌ items.

---

## Fixing Common Issues

### Issue 1: "No JWT token received"

**Cause:** Clerk JWT template not set up or wrong name.

**Fix:**
1. Create template named `supabase` in Clerk Dashboard
2. Add claim: `{ "clerk_id": "{{user.id}}" }`
3. OR set `VITE_CLERK_JWT_TEMPLATE_NAME` to match your existing template name
4. Sign out and sign back in

### Issue 2: "get_clerk_id() returns NULL"

**Cause:** JWT doesn't have `clerk_id` claim.

**Fix:**
1. Edit your Clerk JWT template
2. Add to Custom Claims: `{ "clerk_id": "{{user.id}}" }`
3. Save template
4. Sign out and sign back in to get new token

### Issue 3: "User not in database"

**Cause:** User authenticated with Clerk but not in Supabase users table.

**Fix:**
1. Check if signup API was called
2. Run in Supabase SQL Editor:
```sql
SELECT * FROM users WHERE email = 'your@email.com';
```
3. If no user, the signup flow may have failed

### Issue 4: "406 Not Acceptable" on household queries

**Cause:** RLS policy blocking access because:
- `get_clerk_id()` returns NULL (no JWT)
- User's `household_id` doesn't match the query

**Fix:**
1. Run `window.helpyDebugJwt()` to identify the issue
2. Ensure JWT has `clerk_id` claim
3. Verify user exists in database with correct `household_id`

### Issue 5: Token works then stops working

**Cause:** Token expired.

**Fix:**
1. Increase token lifetime in Clerk JWT template (e.g., 3600 seconds)
2. The app should refresh tokens automatically

---

## Emergency: Temporarily Disable RLS

If you need to debug without RLS blocking (NOT FOR PRODUCTION):

```sql
-- Disable RLS on households temporarily
ALTER TABLE households DISABLE ROW LEVEL SECURITY;

-- Test your queries...

-- Re-enable when done
ALTER TABLE households ENABLE ROW LEVEL SECURITY;
```

---

## Clerk JWT Template Quick Setup

1. Go to Clerk Dashboard → Configure → JWT Templates
2. Click "New Template"
3. Name: `supabase`
4. Token Lifetime: `3600` (1 hour)
5. Custom Claims:
```json
{
  "clerk_id": "{{user.id}}"
}
```
6. Click Save
7. Update `.env`:
```
VITE_CLERK_JWT_TEMPLATE_NAME=supabase
```
8. Restart app and sign out/in

---

## Debug Checklist

- [ ] JWT template exists in Clerk Dashboard
- [ ] Template has `clerk_id` claim with value `{{user.id}}`
- [ ] `VITE_CLERK_JWT_TEMPLATE_NAME` matches template name (or defaults to `supabase`)
- [ ] Console shows "JWT token received" message
- [ ] Network tab shows `Authorization: Bearer` header on Supabase requests
- [ ] Decoded JWT contains `clerk_id` field
- [ ] `window.helpyDebugJwt()` shows all green checks
- [ ] User exists in Supabase `users` table with matching `clerk_id`
- [ ] User has valid `household_id` in the database
