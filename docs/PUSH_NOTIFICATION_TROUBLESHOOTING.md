# Push Notification Troubleshooting Guide

This guide helps you debug push notifications from the edge function (FCM) to the user's device.

## Overview of the Flow

1. **Database Trigger** → Triggers edge function when data is inserted
2. **Edge Function** → Encrypts payload and sends to FCM endpoint
3. **FCM (Google)** → Delivers to user's browser
4. **Browser** → Decrypts and delivers to service worker
5. **Service Worker** → Shows notification to user

## Step-by-Step Debugging

### 1. Check Edge Function Logs (Supabase Dashboard)

Go to **Supabase Dashboard → Edge Functions → send-notification → Logs**

Look for these log entries in order:

#### ✅ Success Flow:
```
[Push] Processing {table} notification for household {id}
[Push] Found {N} eligible user(s)
[Push] Found {N} subscription(s) in database
[Push] 📤 Sending to {N} subscription(s)...
[Push] Encrypting payload: {...}
[Push] Encryption complete: {...}
[Push] Sending to FCM endpoint: {...}
[Push] FCM Response: { status: 201, ... }
[Push] ✅ Successfully sent to {endpoint}...
[Push] 📊 Final results: { successful: N, ... }
```

#### ❌ Common Errors:

**No subscriptions found:**
```
[Push] No push subscriptions found for recipients
```
→ **Fix:** User needs to enable notifications in the app

**VAPID JWT signing failed:**
```
[Push] ❌ Failed to sign VAPID JWT: {...}
```
→ **Fix:** Check VAPID_PRIVATE_KEY format in edge function environment variables

**FCM returned 400/401:**
```
[Push] ❌ Failed to send (400): Invalid request
```
→ **Fix:** Check VAPID keys match between client and server

**FCM returned 410:**
```
[Push] ⚠️ Subscription expired (410)
```
→ **Fix:** Subscription is invalid, will be auto-removed. User needs to re-subscribe.

**FCM returned 403:**
```
[Push] ❌ Failed to send (403): Forbidden
```
→ **Fix:** VAPID authentication failed. Check VAPID keys and subject.

### 2. Check Notification Permission (Browser Console)

**Step-by-step:**

1. **Open Browser DevTools:**
   - Press `F12` or `Ctrl+Shift+I` (Windows/Linux) or `Cmd+Option+I` (Mac)
   - Or right-click on the page → "Inspect" or "Inspect Element"

2. **Go to Console Tab:**
   - Click the "Console" tab at the top of DevTools

3. **Run this command:**
   ```javascript
   console.log('Notification Permission:', Notification.permission);
   ```

4. **Check the result:**
   - ✅ `"granted"` = Permission is granted, notifications should work
   - ⚠️ `"default"` = Permission not yet requested, user needs to allow
   - ❌ `"denied"` = Permission denied, user must enable in browser settings

5. **If permission is denied, fix it:**
   - **Chrome/Edge:** Click the lock icon (🔒) in the address bar → Site settings → Notifications → Allow
   - **Firefox:** Click the lock icon → More information → Permissions → Notifications → Allow
   - **Safari:** Safari → Settings → Websites → Notifications → Find your site → Allow

### 3. Check Push Subscription (Browser Console)

**Step-by-step:**

1. **In the same Console tab**, run this command:
   ```javascript
   navigator.serviceWorker.getRegistration('/')
     .then(reg => {
       if (!reg) {
         console.log('❌ No service worker registration found');
         return null;
       }
       console.log('✅ Service worker found:', reg.scope);
       return reg.pushManager.getSubscription();
     })
     .then(sub => {
       if (sub) {
         console.log('✅ Push subscription exists!');
         console.log('Endpoint:', sub.endpoint);
         console.log('Subscription object:', sub.toJSON());
       } else {
         console.log('❌ No push subscription found');
         console.log('User needs to enable notifications in the app');
       }
     })
     .catch(err => {
       console.error('❌ Error checking subscription:', err);
     });
   ```

2. **What to look for:**
   - ✅ If you see `"✅ Push subscription exists!"` with an endpoint URL, subscription is active
   - ❌ If you see `"❌ No push subscription found"`, the user needs to re-enable notifications

3. **Alternative - One-line check:**
   ```javascript
   navigator.serviceWorker.getRegistration('/').then(r => r?.pushManager.getSubscription()).then(s => console.log(s ? '✅ Has subscription' : '❌ No subscription', s));
   ```

### 4. Check Service Worker Logs (Browser Console)

**Step-by-step:**

1. **In the Console tab**, you'll see logs automatically when a push notification arrives

2. **Filter logs to see only service worker messages:**
   - Look for the filter/search box at the top of the console
   - Type `[SW]` to filter for service worker logs only
   - Or type `SW` to see all service worker related messages

3. **What you should see when a notification arrives:**

   **✅ Success Flow:**
   ```
   [SW] 🔔 Push event received
   [SW] Push event details: {hasData: true, dataType: "object", ...}
   [SW] ✅ Successfully parsed push data as JSON: {title: "...", body: "...", ...}
   [SW] 📱 Showing notification: {title: "...", body: "...", type: "..."}
   [SW] ✅ Notification shown successfully
   ```

4. **If you don't see any logs:**
   - The push event might not be reaching the service worker
   - Check if service worker is active: Go to **Application tab → Service Workers** (see below)
   - Make sure the page is open (service workers only receive pushes when browser is running)

5. **Check Service Worker Status:**
   - Click the **"Application"** tab (or "Storage" in Firefox) in DevTools
   - In the left sidebar, click **"Service Workers"**
   - You should see your service worker listed with status **"activated and is running"**
   - If it says "waiting" or "redundant", click "Update" or "Unregister" and refresh

6. **Common Error Logs to Look For:**

   **❌ Failed to parse push data:**
   ```
   [SW] ❌ Failed to parse push data as JSON: {...}
   [SW] ❌ Received raw encrypted data - browser decryption may have failed
   ```
   → **Fix:** Browser couldn't decrypt. This means:
   - Content-Encoding header might not match (should be `aes128gcm`)
   - Subscription keys (p256dh, auth) might be wrong
   - VAPID keys might not match between client and server

   **❌ Failed to show notification:**
   ```
   [SW] ❌ Failed to show notification: NotAllowedError
   ```
   → **Fix:** Notification permission is denied. See #2 above to fix.

   **❌ No push event received:**
   - If you see FCM success logs but no `[SW] 🔔 Push event received`:
   - Service worker might not be active
   - Browser might be closed or tab inactive
   - Subscription might be expired (check #3 above)

7. **Real-time Monitoring:**
   - Keep the Console tab open
   - Trigger a notification (create a todo item, expense, etc.)
   - Watch for the `[SW]` logs to appear immediately
   - If logs don't appear, the push isn't reaching the service worker

### 3. Check Client-Side Subscription

Run in browser console:
```javascript
// Check if subscription exists
const registration = await navigator.serviceWorker.getRegistration('/');
const subscription = await registration?.pushManager.getSubscription();
console.log('Subscription:', subscription);

// Check subscription details
if (subscription) {
  console.log('Endpoint:', subscription.endpoint);
  console.log('Keys:', subscription.toJSON().keys);
}
```

### 4. Verify Database Subscriptions

Run in Supabase SQL Editor:
```sql
-- Check all subscriptions
SELECT 
  ps.id,
  ps.user_id,
  ps.endpoint,
  ps.created_at,
  u.name as user_name,
  u.household_id
FROM push_subscriptions ps
LEFT JOIN users u ON ps.user_id = u.id
ORDER BY ps.created_at DESC;

-- Check subscriptions for specific user
SELECT * FROM push_subscriptions 
WHERE user_id = 'USER_UUID_HERE';
```

### 5. Test End-to-End

#### Test from Browser Console:
```javascript
// Use the debug function
await window.helpyDebugPush(userId, householdId);
```

#### Test by Triggering a Notification:
1. Create a todo item, meal, or expense as User A
2. User B should receive a notification
3. Check both edge function logs and service worker logs

### 6. Common Issues & Solutions

#### Issue: Notifications work in Chrome but not Firefox
**Solution:** Firefox may require different VAPID key format. Ensure keys are base64url encoded.

#### Issue: Notifications work locally but not in production
**Solution:** 
- Check VAPID keys are set in production environment
- Verify service worker is deployed and accessible at `/sw-push.js`
- Check HTTPS is enabled (required for push notifications)

#### Issue: Edge function logs show success but no notification appears
**Solution:**
- Check service worker logs in browser console
- Verify notification permission is granted
- Check if browser is blocking notifications (check browser notification settings)
- Try sending a test notification: `await registration.showNotification('Test', { body: 'Hello' })`

#### Issue: "Subscription expired" errors
**Solution:**
- User's browser may have refreshed subscription keys
- Service worker should handle `pushsubscriptionchange` event
- User may need to re-enable notifications

### 7. Detailed Log Reference

#### Edge Function Log Prefixes:
- `[Push]` - General push notification logs
- `[Push] ✅` - Success indicators
- `[Push] ❌` - Error indicators
- `[Push] ⚠️` - Warning indicators
- `[Push] 📤` - Sending notifications
- `[Push] 📊` - Statistics/summary

#### Service Worker Log Prefixes:
- `[SW]` - Service worker logs
- `[SW] 🔔` - Push event received
- `[SW] ✅` - Success indicators
- `[SW] ❌` - Error indicators
- `[SW] ⚠️` - Warning indicators
- `[SW] 📱` - Showing notification

### 8. Environment Variables Checklist

**Edge Function (Supabase):**
- ✅ `VAPID_PUBLIC_KEY` - Base64url encoded public key
- ✅ `VAPID_PRIVATE_KEY` - Base64url encoded private key (PKCS8 format)
- ✅ `VAPID_SUBJECT` - Email or URL (e.g., `mailto:hello@helpy.app`)
- ✅ `SUPABASE_URL` - Your Supabase project URL
- ✅ `SUPABASE_SERVICE_ROLE_KEY` - Service role key

**Client (Vite/Environment):**
- ✅ `VITE_VAPID_PUBLIC_KEY` - Must match edge function's public key

### 9. Quick Diagnostic Commands

**In Browser Console:**
```javascript
// 1. Check service worker
navigator.serviceWorker.getRegistrations().then(regs => console.log(regs));

// 2. Check subscription
navigator.serviceWorker.getRegistration('/')
  .then(reg => reg?.pushManager.getSubscription())
  .then(sub => console.log(sub));

// 3. Check permission
console.log(Notification.permission);

// 4. Test notification
navigator.serviceWorker.getRegistration('/')
  .then(reg => reg?.showNotification('Test', { body: 'Hello' }));

// 5. Full diagnostic
await window.helpyDebugPush(userId, householdId);
```

**In Supabase SQL:**
```sql
-- Check recent notifications sent
SELECT * FROM notifications ORDER BY created_at DESC LIMIT 10;

-- Check subscription count
SELECT COUNT(*) FROM push_subscriptions;

-- Check users with notifications enabled
SELECT u.id, u.name, u.notifications_enabled, 
       COUNT(ps.id) as subscription_count
FROM users u
LEFT JOIN push_subscriptions ps ON u.id = ps.user_id
WHERE u.notifications_enabled = true
GROUP BY u.id, u.name, u.notifications_enabled;
```

## Next Steps

If you're still having issues after checking all the above:

1. **Share the logs** - Copy relevant log entries from both edge function and service worker
2. **Check browser compatibility** - Ensure browser supports Web Push API
3. **Verify network** - Check if FCM endpoints are accessible
4. **Test with different browsers** - Chrome, Firefox, Edge
5. **Check browser console for errors** - Look for any JavaScript errors

## Additional Resources

- [Web Push Protocol (RFC 8291)](https://www.rfc-editor.org/rfc/rfc8291.html)
- [VAPID Specification](https://tools.ietf.org/html/rfc8292)
- [MDN: Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
- [MDN: Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)

