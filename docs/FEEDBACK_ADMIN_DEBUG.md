# Debugging Admin Access to Feedback System

If you're an admin but can't see feedback messages from other users, follow these steps:

## Step 1: Check Your Role in Database

Run this SQL query in Supabase SQL Editor:

```sql
SELECT id, name, email, role, clerk_id, household_id
FROM users
WHERE email = 'your-email@gmail.com';
```

**Expected Result:**
- `role` should be `'Admin'` (exactly, case-sensitive)
- `clerk_id` should be set (not NULL)
- `household_id` should match the household where tickets are created

## Step 2: Use the Debug Button

1. Go to Profile → Settings → Feedback
2. As an admin, you'll see a yellow debug box at the top
3. Click "🔍 Debug: Check JWT & Role"
4. Check the browser console (F12 → Console tab) for detailed logs

**What to Look For:**
- Clerk ID from Clerk: `user_xxx...`
- Clerk ID in Database: Should match the Clerk ID
- Role in Database: Should be `'Admin'`
- IDs Match: Should be `✅ Yes`

## Step 3: Check JWT Token

### Method 1: Browser Network Tab
1. Open DevTools (F12) → Network tab
2. Filter by your Supabase URL
3. Find any request to `support_tickets`
4. Check the `Authorization` header
5. Copy the JWT token (the part after `Bearer `)
6. Go to https://jwt.io and paste the token
7. Check the payload for `clerk_id`

### Method 2: Browser Console
Run this in the browser console:

```javascript
// Check Clerk user
const { useUser } = require('@clerk/clerk-react');
// Or in React component:
const { user } = useUser();
console.log('Clerk ID:', user?.id);
```

## Step 4: Verify RLS Policies

Run this SQL query:

```sql
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'support_tickets';
```

The SELECT policy should check:
- User can see their own tickets: `user_id IN (SELECT id FROM users WHERE clerk_id = get_clerk_id())`
- OR Admin can see all: `EXISTS (SELECT 1 FROM users WHERE clerk_id = get_clerk_id() AND role = 'Admin')`

## Step 5: Test RLS Directly

Run this query (it will respect RLS):

```sql
SELECT 
  st.*,
  u.name as user_name,
  u.email as user_email,
  u.role as user_role
FROM support_tickets st
LEFT JOIN users u ON st.user_id = u.id;
```

**If you see tickets:** RLS is working correctly
**If you see no tickets:** RLS is blocking access

## Common Issues

### Issue 1: clerk_id is NULL in database
**Symptom:** Debug shows `DB Clerk ID: null`
**Fix:** 
- Make sure you logged in through Clerk (not Supabase Auth)
- The clerk_id should be set automatically on first login
- If missing, you may need to update it manually:

```sql
UPDATE users
SET clerk_id = 'your-clerk-user-id'
WHERE email = 'your-email@gmail.com';
```

### Issue 2: Role is not 'Admin'
**Symptom:** Debug shows `Role: Spouse` (or other role)
**Fix:** Run migration 057:

```sql
UPDATE users
SET role = 'Admin'
WHERE email IN ('cryptohkrc@gmail.com', 'julianoliko@gmail.com');
```

### Issue 3: Clerk ID mismatch
**Symptom:** Debug shows `IDs Match: ❌ No`
**Fix:** Update the clerk_id in the database to match your Clerk user ID:

```sql
UPDATE users
SET clerk_id = 'your-actual-clerk-id-from-jwt'
WHERE email = 'your-email@gmail.com';
```

### Issue 4: JWT doesn't include clerk_id
**Symptom:** `get_clerk_id()` returns NULL
**Fix:** 
- Check Clerk JWT template configuration
- Make sure `clerk_id` is included in the JWT claims
- See: `docs/SUPABASE_CLERK_JWT_CONFIG.md`

## Quick Fix Script

If you know your Clerk user ID, run this:

```sql
-- Replace 'your-clerk-id' with your actual Clerk user ID
-- Replace 'your-email@gmail.com' with your email

UPDATE users
SET 
  role = 'Admin',
  clerk_id = 'your-clerk-id'
WHERE email = 'your-email@gmail.com';

-- Verify
SELECT id, name, email, role, clerk_id
FROM users
WHERE email = 'your-email@gmail.com';
```

## Still Not Working?

1. Check browser console for errors
2. Check Supabase logs for RLS policy violations
3. Verify you're in the same household as the tickets
4. Try logging out and back in to refresh the JWT token
