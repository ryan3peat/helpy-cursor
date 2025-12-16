# Notification System Deployment Guide

Complete step-by-step guide to deploy and test push notifications.

## Step 1: Deploy the send-notification Edge Function

### Option A: Using Supabase CLI (Recommended)

1. **Install Supabase CLI** (if not already installed):
   ```bash
   npm install -g supabase
   ```

2. **Login to Supabase**:
   ```bash
   supabase login
   ```
   This will open your browser to authenticate.

3. **Link your project**:
   ```bash
   supabase link --project-ref rnnqusevbnxnxmhlajlr
   ```
   Replace `rnnqusevbnxnxmhlajlr` with your project reference if different.

4. **Deploy the function**:
   ```bash
   supabase functions deploy send-notification
   ```

5. **Verify deployment**:
   - Go to Supabase Dashboard → Edge Functions
   - You should see `send-notification` in the list
   - Click on it to see details and logs

### Option B: Using Supabase Dashboard

1. Go to Supabase Dashboard → Edge Functions
2. Click "Create a new function"
3. Name it `send-notification`
4. Copy the contents of `supabase/functions/send-notification/index.ts`
5. Paste into the editor
6. Click "Deploy"

---

## Step 2: Set Environment Variables for Edge Function

The edge function needs these environment variables (called "Secrets" in Supabase):

### Required Variables:
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Your service role key (keep secret!)
- `VAPID_PUBLIC_KEY` - Public VAPID key
- `VAPID_PRIVATE_KEY` - Private VAPID key (keep secret!)
- `VAPID_SUBJECT` - Email or URL (e.g., `mailto:your-email@example.com`)

### How to Set Them:

#### Using Supabase CLI:
```bash
# Set Supabase URL (usually auto-detected, but set explicitly)
supabase secrets set SUPABASE_URL=https://rnnqusevbnxnxmhlajlr.supabase.co

# Set Service Role Key (get from Dashboard → Settings → API)
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Set VAPID keys (generate first - see below)
supabase secrets set VAPID_PUBLIC_KEY=your_public_key_here
supabase secrets set VAPID_PRIVATE_KEY=your_private_key_here
supabase secrets set VAPID_SUBJECT=mailto:your-email@example.com
```

#### Using Supabase Dashboard:
1. Go to Supabase Dashboard → Edge Functions → `send-notification`
2. Click on "Settings" tab
3. Scroll to "Secrets" section
4. Add each secret:
   - Click "Add secret"
   - Enter the name (e.g., `VAPID_PUBLIC_KEY`)
   - Enter the value
   - Click "Save"

### Generate VAPID Keys:

**Option 1: Using npx (Recommended)**
```bash
npx web-push generate-vapid-keys
```

This will output something like:
```
=======================================

Public Key:
BEl62iUYgUivxIkv69yViEuiBIa40HIe8F3j-3qjfYj...
Private Key:
...
=======================================
```

**Option 2: Online Generator**
Visit: https://www.attheminute.com/vapid-key-generator/
- Copy the Public Key
- Copy the Private Key

**Important:**
- **Public Key**: Also needs to be set in your frontend `.env` as `VITE_VAPID_PUBLIC_KEY`
- **Private Key**: Only used in the edge function (backend)
- **Subject**: Usually your email like `mailto:your-email@example.com` or your website URL

### Get Your Service Role Key:
1. Go to Supabase Dashboard → Settings → API
2. Find "service_role" key (NOT the anon key)
3. Copy it (this is sensitive - keep it secret!)

---

## Step 3: Configure Frontend VAPID Key

The frontend also needs the VAPID public key:

1. **Add to your `.env` file** (local development):
   ```env
   VITE_VAPID_PUBLIC_KEY=your_public_key_here
   ```

2. **Add to Vercel** (production):
   - Go to Vercel Dashboard → Your Project → Settings → Environment Variables
   - Add `VITE_VAPID_PUBLIC_KEY` with your public key value
   - Redeploy your app

3. **Verify it's loaded**:
   - The key is used in `services/pushNotificationService.ts`
   - Check browser console - you should see `[Push]` messages when notifications are initialized

---

## Step 4: Have Users Enable Notifications

Users need to enable notifications in the app. Here's what happens:

### User Flow:
1. User opens the app
2. Goes to **Profile** → **Account Settings**
3. Toggles **"Enable Notifications"** ON
4. Browser shows permission prompt → User clicks **"Allow"**
5. App calls `subscribeToPush()` which:
   - Creates a push subscription
   - Saves it to `push_subscriptions` table
   - User is now subscribed!

### Verify Users Are Subscribed:

Run this SQL query in Supabase:
```sql
SELECT 
  u.name,
  u.notifications_enabled,
  COUNT(ps.id) as subscription_count
FROM users u
LEFT JOIN push_subscriptions ps ON u.id = ps.user_id
GROUP BY u.id, u.name, u.notifications_enabled
ORDER BY u.name;
```

You should see:
- `notifications_enabled = true` for users who enabled it
- `subscription_count > 0` for users who granted browser permission

### Troubleshooting User Subscriptions:

**If user enabled notifications but no subscription exists:**
1. Check browser console for errors (look for `[Push]` messages)
2. Verify `VITE_VAPID_PUBLIC_KEY` is set in frontend
3. Check if browser supports push notifications
4. Verify service worker is registered (check `Application` tab in DevTools)

**Common Issues:**
- **Permission denied**: User needs to allow notifications in browser settings
- **No service worker**: Check if `/sw-push.js` is accessible
- **VAPID key mismatch**: Frontend and backend must use the same public key

---

## Step 5: Test Notifications

### Test Setup:
1. **User A** (Creator):
   - Enable notifications in Profile → Account Settings
   - Grant browser permission
   - Verify subscription exists in database

2. **User B** (Recipient):
   - Enable notifications in Profile → Account Settings
   - Grant browser permission
   - Verify subscription exists in database
   - Both users should be in the same household

### Test Steps:

1. **As User A**, create a new item:
   - Add a todo item, meal, or expense
   - The item should have `created_by` set (check database)

2. **Check Edge Function Logs**:
   - Go to Supabase Dashboard → Edge Functions → `send-notification` → Logs
   - You should see logs like:
     ```
     [Push] Processing todo_items notification for household xxx
     [Push] Sent 1/1 notifications
     ```

3. **Check User B's Device**:
   - User B should receive a push notification
   - Notification should appear even if app is closed

4. **Check Database**:
   ```sql
   -- Check if notification was saved
   SELECT * FROM notifications 
   ORDER BY created_at DESC 
   LIMIT 5;
   ```

### Debugging Test Failures:

**If no notification is received:**

1. **Check Edge Function Logs**:
   ```sql
   -- Check recent edge function invocations
   -- Go to Dashboard → Edge Functions → send-notification → Logs
   ```

2. **Check if trigger fired**:
   ```sql
   -- Check if item was created with created_by
   SELECT id, name, created_by, household_id 
   FROM todo_items 
   ORDER BY created_at DESC 
   LIMIT 1;
   ```

3. **Check recipient eligibility**:
   ```sql
   -- Verify User B should receive notifications
   SELECT 
     u.id,
     u.name,
     u.role,
     u.notifications_enabled,
     COUNT(ps.id) as subscription_count
   FROM users u
   LEFT JOIN push_subscriptions ps ON u.id = ps.user_id
   WHERE u.household_id = 'your-household-id'
     AND u.role != 'Child'
     AND u.notifications_enabled = true
   GROUP BY u.id, u.name, u.role, u.notifications_enabled;
   ```

4. **Check VAPID keys**:
   - Verify public key in frontend matches public key in edge function
   - Verify private key is set in edge function secrets

5. **Check browser console**:
   - Look for `[Push]` messages
   - Check for any errors

**Common Issues:**

| Issue | Solution |
|-------|----------|
| Edge function not invoked | Check trigger function URL is correct |
| VAPID error | Verify keys match between frontend and backend |
| No subscriptions | User needs to enable notifications in app |
| Permission denied | User needs to allow notifications in browser |
| Wrong recipient | Check user role (Child role is excluded) |
| Creator receives notification | Check `created_by` is set correctly |

---

## Quick Verification Checklist

After completing all steps, verify:

- [ ] Edge function `send-notification` is deployed
- [ ] Edge function has all required secrets set
- [ ] VAPID public key is in frontend `.env` / Vercel
- [ ] At least 2 users have enabled notifications
- [ ] At least 2 users have push subscriptions in database
- [ ] Trigger function URL is configured (migration 010)
- [ ] Created a test item and checked edge function logs
- [ ] Recipient received notification

---

## Next Steps After Testing

Once notifications are working:

1. **Monitor Edge Function Logs** regularly
2. **Check for expired subscriptions** (edge function handles this automatically)
3. **Consider adding notification preferences** (users can choose what to be notified about)
4. **Add in-app notification center** (display notifications from `notifications` table)

---

## Support

If notifications still don't work after following this guide:

1. Run verification script: `migrations/009_verify_notifications.sql`
2. Check edge function logs for errors
3. Verify all environment variables are set correctly
4. Test with browser DevTools open to see console messages






