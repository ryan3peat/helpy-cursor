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

### 2. Check Service Worker Logs (Browser Console)

Open **Browser DevTools → Console** and filter for `[SW]`

#### ✅ Success Flow:
```
[SW] 🔔 Push event received
[SW] Push event details: {...}
[SW] ✅ Successfully parsed push data as JSON: {...}
[SW] 📱 Showing notification: {...}
[SW] ✅ Notification shown successfully
```

#### ❌ Common Errors:

**No push event received:**
- Check if service worker is registered: `navigator.serviceWorker.getRegistrations()`
- Check if subscription exists: `registration.pushManager.getSubscription()`
- Verify service worker is active in DevTools → Application → Service Workers

**Failed to parse push data:**
```
[SW] ❌ Failed to parse push data as JSON: {...}
[SW] ❌ Received raw encrypted data - browser decryption may have failed
```
→ **Fix:** Browser couldn't decrypt. Check:
  - Content-Encoding header matches (should be `aes128gcm`)
  - Subscription keys (p256dh, auth) are correct
  - VAPID keys match between client and server

**Notification permission denied:**
```
[SW] ❌ Failed to show notification: NotAllowedError
```
→ **Fix:** User needs to grant notification permission in browser settings

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

