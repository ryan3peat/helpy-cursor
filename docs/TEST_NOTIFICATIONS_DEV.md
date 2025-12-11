# Testing Notifications in Dev Mode

Complete guide to test push notifications in your development environment.

## Prerequisites Checklist

Before testing, verify:
- [x] Migration 007 has been run (tables, triggers, columns created)
- [x] Migration 010 has been run (trigger function URL fixed)
- [x] Edge function `send-notification` is deployed
- [x] Edge function has all secrets set (VAPID keys, SUPABASE_URL, etc.)
- [x] Frontend has `VITE_VAPID_PUBLIC_KEY` in `.env` file

---

## Step 1: Setup Test Users

You need at least 2 users in the same household to test:

### User A (Creator):
1. Open your app in browser (e.g., `http://localhost:5173`)
2. Login as User A
3. Go to **Profile** → **Account Settings**
4. Toggle **"Enable Notifications"** ON
5. Browser will show permission prompt → Click **"Allow"**
6. Check browser console - you should see:
   ```
   [Push] Service worker registered
   [Push] Subscription saved to database
   ```

### User B (Recipient):
1. Open your app in a **different browser** or **incognito window**
   - Or use a different device
   - Or use a different browser profile
2. Login as User B (must be in same household as User A)
3. Go to **Profile** → **Account Settings**
4. Toggle **"Enable Notifications"** ON
5. Browser will show permission prompt → Click **"Allow"**
6. Check browser console for same messages

### Verify Subscriptions in Database:

Run this SQL in Supabase SQL Editor:
```sql
SELECT 
  u.name,
  u.notifications_enabled,
  COUNT(ps.id) as subscription_count,
  ps.endpoint
FROM users u
LEFT JOIN push_subscriptions ps ON u.id = ps.user_id
WHERE u.household_id = 'your-household-id'
GROUP BY u.id, u.name, u.notifications_enabled, ps.endpoint
ORDER BY u.name;
```

You should see:
- Both users have `notifications_enabled = true`
- Both users have `subscription_count > 0`
- Endpoints are listed (these are the push subscription URLs)

---

## Step 2: Test Creating an Item

### As User A (Creator):

1. **Create a new todo item:**
   - Go to Shopping List or Tasks
   - Add a new item (e.g., "Test Notification Item")
   - The item should save successfully

2. **Verify `created_by` is set:**
   ```sql
   SELECT id, name, created_by, household_id, created_at
   FROM todo_items
   ORDER BY created_at DESC
   LIMIT 1;
   ```
   - The `created_by` field should have User A's UUID (not NULL)

### Check Edge Function Logs:

1. Go to **Supabase Dashboard** → **Edge Functions** → **send-notification**
2. Click **"Logs"** tab
3. You should see logs like:
   ```
   [Push] Processing todo_items notification for household xxx
   [Push] Sent 1/1 notifications
   ```
   - If you see errors, check what they say

### Check User B's Device:

**User B should receive a push notification:**
- Notification should appear even if browser/app is closed
- Notification title: "Shopping List Updated" or "New Task Added"
- Notification body: "{User A's name} added "{item name}" to the Shopping List"

---

## Step 3: Verify Notification Was Saved

Check the `notifications` table:
```sql
SELECT 
  n.*,
  u.name as recipient_name,
  u2.name as triggered_by_name
FROM notifications n
JOIN users u ON n.recipient_user_id = u.id
LEFT JOIN users u2 ON n.triggered_by_user_id = u2.id
ORDER BY n.created_at DESC
LIMIT 5;
```

You should see:
- A new notification record
- `recipient_user_id` = User B's ID
- `triggered_by_user_id` = User A's ID
- `read = false`
- `title` and `body` populated

---

## Step 4: Test Different Item Types

Test all three types:

### Test Meals:
1. As User A, add a meal
2. User B should receive: "Meal Plan Updated" notification

### Test Expenses:
1. As User A, add an expense
2. User B should receive: "New Expense Added" notification

### Test Tasks:
1. As User A, add a task (not shopping item)
2. User B should receive: "New Task Added" notification

---

## Troubleshooting

### Issue: No notification received

**Check 1: Edge Function Logs**
- Go to Dashboard → Edge Functions → send-notification → Logs
- Look for errors or warnings
- Common errors:
  - `VAPID not configured` → Check secrets are set
  - `No eligible users` → Check user roles and notifications_enabled
  - `No push subscriptions found` → Users need to enable notifications

**Check 2: Browser Console**
- Open DevTools (F12) → Console
- Look for `[Push]` messages
- Check for errors

**Check 3: Database Verification**
```sql
-- Check if item was created with created_by
SELECT id, name, created_by, household_id 
FROM todo_items 
ORDER BY created_at DESC 
LIMIT 1;

-- Check if users are eligible
SELECT 
  u.id,
  u.name,
  u.role,
  u.notifications_enabled,
  COUNT(ps.id) as subscriptions
FROM users u
LEFT JOIN push_subscriptions ps ON u.id = ps.user_id
WHERE u.household_id = 'your-household-id'
GROUP BY u.id, u.name, u.role, u.notifications_enabled;
```

**Check 4: Browser Permissions**
- Go to browser settings → Site permissions → Notifications
- Ensure your localhost domain is allowed
- Try resetting permissions and re-enabling

**Check 5: Service Worker**
- Open DevTools → Application → Service Workers
- Verify service worker is registered
- Check `/sw-push.js` is accessible

### Issue: Creator receives notification

**Problem:** `created_by` is not set correctly

**Fix:**
```sql
-- Check if created_by is NULL
SELECT id, name, created_by FROM todo_items ORDER BY created_at DESC LIMIT 1;

-- If NULL, check frontend is passing createdBy
-- In App.tsx, handleAddTodoItem should include: createdBy: currentUser?.id
```

### Issue: Edge function not called

**Check trigger function:**
```sql
-- Verify trigger exists
SELECT * FROM pg_trigger WHERE tgname LIKE '%notify%';

-- Check trigger function URL
SELECT pg_get_functiondef(oid) 
FROM pg_proc 
WHERE proname = 'notify_household_on_insert';
```

The function should have your actual Supabase URL, not `YOUR_PROJECT_REF`.

### Issue: VAPID errors

**Check keys match:**
- Frontend `.env` has `VITE_VAPID_PUBLIC_KEY`
- Edge function secret has `VAPID_PUBLIC_KEY` (same value)
- Edge function secret has `VAPID_PRIVATE_KEY`
- Keys were generated together (from same `npx web-push generate-vapid-keys` command)

---

## Quick Test Script

Run this to verify everything is set up:

```sql
-- Quick verification query
SELECT 
  'Users with notifications' as check_type,
  COUNT(*) FILTER (WHERE notifications_enabled = true) as enabled_count,
  COUNT(*) as total_users
FROM users
WHERE household_id = 'your-household-id'

UNION ALL

SELECT 
  'Push subscriptions' as check_type,
  COUNT(*) as enabled_count,
  COUNT(DISTINCT user_id) as total_users
FROM push_subscriptions
WHERE household_id = 'your-household-id'

UNION ALL

SELECT 
  'Recent items with created_by' as check_type,
  COUNT(*) FILTER (WHERE created_by IS NOT NULL) as enabled_count,
  COUNT(*) as total_users
FROM todo_items
WHERE created_at > NOW() - INTERVAL '1 hour';
```

---

## Success Indicators

You'll know it's working when:

✅ User B receives push notification when User A creates item  
✅ Edge function logs show "Sent X/X notifications"  
✅ `notifications` table has new record  
✅ Browser console shows `[Push]` success messages  
✅ Notification appears even when browser is closed  

---

## Next Steps After Testing

Once notifications work in dev:

1. **Deploy to production:**
   - Set `VITE_VAPID_PUBLIC_KEY` in Vercel environment variables
   - Ensure edge function secrets are set in production Supabase project
   - Test with production users

2. **Monitor:**
   - Check edge function logs regularly
   - Monitor for expired subscriptions
   - Check notification delivery rates

3. **Enhance:**
   - Add notification preferences (users choose what to be notified about)
   - Add in-app notification center (display from `notifications` table)
   - Add notification sounds/badges



