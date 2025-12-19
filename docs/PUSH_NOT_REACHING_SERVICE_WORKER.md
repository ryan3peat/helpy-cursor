# Push Not Reaching Service Worker - Debugging Guide

## Symptoms
- ✅ FCM shows success (status 201)
- ✅ Endpoints match
- ✅ Correct users found
- ✅ Service worker is active
- ✅ Test messages work
- ❌ No `[SW] 🔔 Push event received` logs

## Possible Causes

### 1. Browser Not Receiving Push from FCM
Even though FCM accepts the push, the browser might not receive it.

**Check:**
- Is Chrome Desktop actually running? (not just minimized, but process active)
- Is there a firewall blocking FCM?
- Is the browser in "Do Not Disturb" or "Focus Assist" mode?

### 2. Service Worker Not Registered for Push Events
The service worker might be active but not properly listening for push events.

**Check:**
- Service worker must be active AND controlling the page
- Push event listener must be registered before push arrives

### 3. Browser Suppressing Push
Some browsers suppress pushes in certain conditions.

**Check:**
- Windows Focus Assist settings
- Chrome notification settings
- Browser "quiet hours" or "do not disturb"

### 4. Subscription Mismatch (Even if Endpoints Match)
The subscription keys (p256dh, auth) might not match between database and browser.

**Check:**
- Compare subscription keys in database vs browser
- They must match exactly for decryption to work

## Debugging Steps

### Step 1: Verify Service Worker is Listening

After updating sw-push.js, check the service worker console for:

```
[SW] ✅ Push event listener should be registered
[SW] ✅ Service worker fully activated and controlling clients
```

If you don't see these, the service worker isn't fully activated.

### Step 2: Check Browser Network Tab

1. Open DevTools → Network tab
2. Filter for: `fcm` or `googleapis`
3. Trigger a notification
4. Look for requests to FCM
5. Check if browser is making any requests to FCM

**Expected:** You might see requests when browser checks for pushes, but this is browser-internal.

### Step 3: Verify Subscription Keys Match

Run in browser console:

```javascript
// Get browser subscription keys
navigator.serviceWorker.getRegistration('/')
  .then(reg => reg.pushManager.getSubscription())
  .then(sub => {
    const browserKeys = sub.toJSON().keys;
    console.log('Browser keys:');
    console.log('  p256dh:', browserKeys.p256dh);
    console.log('  auth:', browserKeys.auth);
    console.log('\n→ Compare with keys in push_subscriptions table');
    console.log('→ They must match EXACTLY');
  });
```

Then check database:
```sql
SELECT p256dh_key, auth_key 
FROM push_subscriptions 
WHERE endpoint = 'YOUR_ENDPOINT_HERE';
```

**They must match exactly!**

### Step 4: Test with Browser DevTools Push

1. Go to Application → Service Workers
2. Find your service worker
3. In the "Push" section, type: `{"test": true}`
4. Click "Push" button
5. Check service worker console for `[SW] 🔔 Push event received`

**If this works:** Browser can receive pushes, issue is with FCM delivery
**If this doesn't work:** Service worker push listener has an issue

### Step 5: Check for Silent Errors

The push might be arriving but failing silently. Check service worker console for:
- Any error messages
- Any warnings
- Check if there are unhandled promise rejections

### Step 6: Verify Service Worker is Controlling

Run in console:

```javascript
navigator.serviceWorker.getRegistration('/').then(reg => {
  console.log('Service worker controlling:', !!navigator.serviceWorker.controller);
  console.log('Service worker active:', !!reg?.active);
  console.log('Service worker state:', reg?.active?.state);
  
  if (navigator.serviceWorker.controller) {
    console.log('✅ Service worker is controlling this page');
  } else {
    console.log('❌ Service worker is NOT controlling - refresh page');
  }
});
```

**Must show:** `Service worker is controlling this page`

### Step 7: Check Windows Focus Assist

1. Windows Settings → System → Focus Assist
2. Make sure it's not blocking notifications
3. Or add Chrome to exceptions

### Step 8: Check Chrome Notification Settings

1. Chrome Settings → Privacy and security → Site settings → Notifications
2. Make sure your site is allowed
3. Check "Use quieter messaging" is OFF

## Advanced Debugging

### Add Push Event Listener in Main Thread

Add this to your main app code (temporary, for debugging):

```javascript
// In App.tsx or similar, add:
navigator.serviceWorker.addEventListener('message', (event) => {
  console.log('🔔 Message from service worker:', event.data);
  if (event.data && event.data.type === 'PUSH_RECEIVED') {
    console.log('✅ Push was received by service worker!');
  }
});
```

Then in service worker, send a message when push arrives:

```javascript
// In sw-push.js push event handler, add:
clients.matchAll().then(clients => {
  clients.forEach(client => {
    client.postMessage({ type: 'PUSH_RECEIVED', data: 'Push event fired' });
  });
});
```

This will confirm if the push event is firing.

## Most Likely Issue

Given that:
- Endpoints match ✅
- Users are correct ✅
- FCM accepts push ✅
- Service worker is active ✅

**Most likely:** The browser isn't receiving the push from FCM, or the subscription keys don't match (causing silent failure).

**Next steps:**
1. Verify subscription keys match exactly
2. Test with browser DevTools push (Step 4)
3. Check Windows Focus Assist / notification settings
4. Try a different browser to rule out Chrome-specific issue








