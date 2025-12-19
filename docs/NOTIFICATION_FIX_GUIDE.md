# Notification System Fix Guide

Based on the verification results, here are the issues and how to fix them:

## 🔴 CRITICAL Issues

### 1. Trigger Function URL Not Configured

**Problem:** The trigger function still has the placeholder `YOUR_PROJECT_REF` instead of your actual Supabase project reference.

**Fix:**
1. Find your Supabase project reference:
   - Check your `.env` file for `VITE_SUPABASE_URL` (e.g., `https://abcdefghijklmnop.supabase.co`)
   - OR go to Supabase Dashboard and check the URL
   - The project ref is the part before `.supabase.co`

2. Run the fix script:
   - Open `migrations/010_fix_trigger_url.sql`
   - Replace `'YOUR_PROJECT_REF'` on line 12 with your actual project reference
   - Run it in Supabase SQL Editor

**Example:**
```sql
DECLARE
  project_ref TEXT := 'abcdefghijklmnop';  -- Your actual project ref
```

## ⚠️ WARNING Issues

### 2. No Push Subscriptions Found

**Problem:** No users have subscribed to push notifications yet (0 subscriptions).

**Why this happens:**
- Users need to enable notifications in the app
- They need to grant browser permission
- The app needs to call `subscribeToPush()` when they enable notifications

**Fix:**
1. Check if users have `notifications_enabled = true` in the database:
   ```sql
   SELECT id, name, notifications_enabled FROM users;
   ```

2. In the app, users need to:
   - Go to Profile → Account Settings
   - Toggle "Enable Notifications" ON
   - Accept the browser permission prompt
   - This should create a record in `push_subscriptions` table

3. Verify subscriptions were created:
   ```sql
   SELECT * FROM push_subscriptions;
   ```

### 3. Missing `created_by` on Existing Items

**Problem:** Existing todo items (36) and meals (40) don't have `created_by` set.

**Why this happens:**
- These items were created before the `created_by` column was added
- The frontend code now sets `createdBy` for new items, but old items don't have it

**Impact:**
- Old items won't trigger notifications (they're missing the creator info)
- New items should work fine (frontend sets `createdBy`)

**Fix Options:**

**Option A: Leave as-is (Recommended)**
- Old items won't send notifications, but new items will work
- This is fine if you don't need notifications for historical data

**Option B: Backfill created_by (Optional)**
If you want to set a default creator for old items:
```sql
-- Set all old todo_items to first user in household (or NULL)
UPDATE todo_items 
SET created_by = (
  SELECT id FROM users 
  WHERE household_id = todo_items.household_id 
  AND role != 'Child' 
  LIMIT 1
)
WHERE created_by IS NULL;

-- Same for meals
UPDATE meals 
SET created_by = (
  SELECT id FROM users 
  WHERE household_id = meals.household_id 
  AND role != 'Child' 
  LIMIT 1
)
WHERE created_by IS NULL;
```

## ✅ What's Working

Based on the verification, these should now be working after running migration 007:
- ✅ pg_net extension
- ✅ push_subscriptions table
- ✅ notifications table
- ✅ created_by columns (on todo_items, meals)
- ✅ notifications_enabled column
- ✅ All three triggers (todo_items, meals, expenses)
- ✅ Trigger function exists

## 🧪 Testing Notifications

After fixing the URL, test notifications:

1. **Setup:**
   - User A: Enable notifications in Profile → Account Settings
   - User B: Enable notifications in Profile → Account Settings
   - Both should be in the same household
   - Both should have `notifications_enabled = true` in database

2. **Test:**
   - As User A, create a new todo item or meal
   - User B should receive a push notification
   - Check `notifications` table for the notification record

3. **Debug:**
   - Check Supabase Edge Function logs: Dashboard → Edge Functions → send-notification → Logs
   - Check browser console for `[Push]` messages
   - Verify `push_subscriptions` table has entries

## 📋 Checklist

- [ ] Fix trigger function URL (migration 010)
- [ ] Verify edge function is deployed (`send-notification`)
- [ ] Verify VAPID keys are set in edge function environment variables
- [ ] Have at least 2 users enable notifications in the app
- [ ] Test by creating a new item
- [ ] Check edge function logs for errors

## 🔍 Additional Checks

### Check Edge Function Deployment
```bash
# If using Supabase CLI
supabase functions list
```

### Check VAPID Keys
The edge function needs these environment variables:
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT` (e.g., `mailto:your-email@example.com`)

Set them in Supabase Dashboard → Edge Functions → send-notification → Settings → Secrets

### Check Recent Notifications
```sql
SELECT 
  n.*,
  u.name as recipient_name,
  u2.name as triggered_by_name
FROM notifications n
JOIN users u ON n.recipient_user_id = u.id
LEFT JOIN users u2 ON n.triggered_by_user_id = u2.id
ORDER BY n.created_at DESC
LIMIT 10;
```








