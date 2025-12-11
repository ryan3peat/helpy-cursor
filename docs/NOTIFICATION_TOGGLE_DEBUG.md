# Notification Toggle Debug Guide

## Issue: Toggle won't turn ON

### Fix Applied

The toggle now:
1. ✅ Updates database immediately (even if subscription fails)
2. ✅ Then attempts subscription (non-blocking)
3. ✅ Toggle stays ON in database regardless of subscription success

### Check VAPID Key Configuration

The toggle requires `VITE_VAPID_PUBLIC_KEY` to be set in your `.env` file.

**Check if it's set:**
1. Open your `.env` file (in project root)
2. Look for: `VITE_VAPID_PUBLIC_KEY=...`
3. If missing, add it with your public VAPID key

**Verify in browser console:**
1. Open browser DevTools (F12)
2. Go to Console tab
3. Type: `console.log(import.meta.env.VITE_VAPID_PUBLIC_KEY)`
4. Should show your VAPID public key (not empty string)

**If VAPID key is missing:**
- The subscription will fail silently
- Toggle will still save to database (due to fix)
- But push notifications won't work

### Check Database Default

Run this SQL to verify default is TRUE:
```sql
SELECT column_default 
FROM information_schema.columns
WHERE table_name = 'users' 
  AND column_name = 'notifications_enabled';
```

Should show: `true`

If not, run: `migrations/014_verify_notifications_default.sql`

### Debug Steps

1. **Check browser console** when toggling ON:
   - Look for `[Push]` messages
   - Look for errors
   - Check if VAPID key is logged

2. **Check database** after toggling:
   ```sql
   SELECT id, name, notifications_enabled 
   FROM users 
   WHERE id = 'your-user-id';
   ```
   Should show `notifications_enabled = true`

3. **Check push subscriptions**:
   ```sql
   SELECT * FROM push_subscriptions 
   WHERE user_id = 'your-user-id';
   ```
   Should have at least one subscription if toggle worked

4. **Check browser permissions**:
   - Browser Settings → Site Permissions → Notifications
   - Ensure your localhost/domain is allowed

### Common Issues

| Issue | Solution |
|-------|----------|
| Toggle won't stay ON | Check browser console for errors |
| VAPID key missing | Add to `.env` file |
| Permission denied | Allow notifications in browser settings |
| Subscription fails | Check VAPID key matches edge function |
| Database not updating | Check console for update errors |

### Test the Fix

1. Refresh browser
2. Go to Profile → Account Settings
3. Toggle ON
4. Check console for `[Push]` messages
5. Check database: `SELECT notifications_enabled FROM users WHERE id = 'your-id'`
6. Should be `true` even if subscription failed



