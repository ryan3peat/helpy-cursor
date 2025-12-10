# Browser Console Debug Commands for Push Notifications

Copy and paste these commands into your browser's Developer Console (F12 → Console tab).

## Quick Check - All in One

Run this single command to check everything at once:

```javascript
(async () => {
  console.log('=== PUSH NOTIFICATION DIAGNOSTICS ===\n');
  
  // 1. Check Notification Permission
  const permission = Notification.permission;
  console.log('1. Notification Permission:', permission === 'granted' ? '✅ GRANTED' : permission === 'denied' ? '❌ DENIED' : '⚠️ DEFAULT (not requested)');
  
  // 2. Check Service Worker
  const reg = await navigator.serviceWorker.getRegistration('/');
  if (reg) {
    console.log('2. Service Worker:', '✅ REGISTERED');
    console.log('   Scope:', reg.scope);
    console.log('   State:', reg.active?.state || 'not active');
    
    // 3. Check Push Subscription
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      console.log('3. Push Subscription:', '✅ EXISTS');
      console.log('   Endpoint:', sub.endpoint.substring(0, 60) + '...');
      const keys = sub.toJSON().keys;
      console.log('   Has p256dh key:', keys.p256dh ? '✅' : '❌');
      console.log('   Has auth key:', keys.auth ? '✅' : '❌');
    } else {
      console.log('3. Push Subscription:', '❌ NOT FOUND');
      console.log('   → User needs to enable notifications in the app');
    }
  } else {
    console.log('2. Service Worker:', '❌ NOT REGISTERED');
    console.log('3. Push Subscription:', '❌ CANNOT CHECK (no service worker)');
  }
  
  console.log('\n=== END DIAGNOSTICS ===');
})();
```

## Individual Checks

### 1. Check Notification Permission

```javascript
console.log('Notification Permission:', Notification.permission);
```

**Expected Results:**
- `"granted"` ✅ - Permission is granted, notifications should work
- `"default"` ⚠️ - Permission not yet requested
- `"denied"` ❌ - Permission denied, need to enable in browser settings

**If denied, fix it:**
- **Chrome/Edge:** Click lock icon (🔒) in address bar → Site settings → Notifications → Allow
- **Firefox:** Click lock icon → More information → Permissions → Notifications → Allow
- **Safari:** Safari → Settings → Websites → Notifications → Find your site → Allow

### 2. Check Service Worker Registration

```javascript
navigator.serviceWorker.getRegistrations().then(regs => {
  console.log('Service Workers found:', regs.length);
  regs.forEach((reg, i) => {
    console.log(`\nService Worker ${i + 1}:`);
    console.log('  Scope:', reg.scope);
    console.log('  Active State:', reg.active?.state || 'not active');
    console.log('  Waiting State:', reg.waiting?.state || 'none');
    console.log('  Installing State:', reg.installing?.state || 'none');
  });
});
```

**Expected Results:**
- Should see at least 1 service worker with `scope: "/"`
- `active.state` should be `"activated"`

### 3. Check Push Subscription

```javascript
navigator.serviceWorker.getRegistration('/')
  .then(reg => {
    if (!reg) {
      console.log('❌ No service worker registration found');
      return null;
    }
    console.log('✅ Service worker found');
    return reg.pushManager.getSubscription();
  })
  .then(sub => {
    if (sub) {
      console.log('✅ Push subscription exists!');
      console.log('Endpoint:', sub.endpoint);
      console.log('Full subscription:', sub.toJSON());
    } else {
      console.log('❌ No push subscription found');
      console.log('→ User needs to enable notifications in the app');
    }
  })
  .catch(err => {
    console.error('❌ Error:', err);
  });
```

**Expected Results:**
- Should see `"✅ Push subscription exists!"` with an endpoint URL
- Endpoint should start with `https://fcm.googleapis.com/fcm/send/`

### 4. Monitor Service Worker Logs (Real-time)

**Step 1:** Open Console tab in DevTools (F12)

**Step 2:** Filter for service worker logs:
- Look for the filter box at the top of console
- Type: `[SW]` or `SW`

**Step 3:** Trigger a notification (create a todo item, expense, etc.)

**Step 4:** Watch for these logs:

```
[SW] 🔔 Push event received
[SW] Push event details: {...}
[SW] ✅ Successfully parsed push data as JSON: {...}
[SW] 📱 Showing notification: {...}
[SW] ✅ Notification shown successfully
```

**If you see errors:**
- `[SW] ❌ Failed to parse push data` → Decryption issue
- `[SW] ❌ Failed to show notification: NotAllowedError` → Permission denied
- No logs at all → Push event not reaching service worker

### 5. Check Service Worker Status (Application Tab)

**Step 1:** Open DevTools (F12)

**Step 2:** Click **"Application"** tab (or "Storage" in Firefox)

**Step 3:** In left sidebar, click **"Service Workers"**

**Step 4:** Look for your service worker:
- Status should be: **"activated and is running"**
- Scope should be: `/`
- Source should be: `/sw-push.js`

**If status is "waiting" or "redundant":**
- Click "Update" button
- Or click "Unregister" and refresh the page

### 6. Test Notification Display (Manual)

```javascript
navigator.serviceWorker.getRegistration('/')
  .then(reg => {
    if (!reg) {
      console.log('❌ No service worker');
      return;
    }
    return reg.showNotification('Test Notification', {
      body: 'If you see this, notifications are working!',
      icon: '/icons/icon-192.png',
      badge: '/icons/favicon-32.png',
      tag: 'test-notification'
    });
  })
  .then(() => {
    console.log('✅ Test notification sent');
  })
  .catch(err => {
    console.error('❌ Failed to show test notification:', err);
  });
```

**Expected Results:**
- Should see a notification appear
- If you get an error, check notification permission (#1)

### 7. Check All Subscriptions in Database (via App)

If your app has a debug function, use it:

```javascript
// If available in your app
await window.helpyDebugPush(userId, householdId);
```

This will show:
- VAPID key status
- Browser support
- Permission status
- Service worker status
- Subscription status
- Database subscriptions

## Common Issues & Quick Fixes

### Issue: Permission is "denied"
**Fix:** Enable in browser settings (see #1 above)

### Issue: No service worker found
**Fix:** Refresh the page, or check if service worker file exists at `/sw-push.js`

### Issue: No push subscription
**Fix:** User needs to enable notifications in your app (toggle in settings/profile)

### Issue: Service worker logs show errors
**Fix:** Check the specific error message:
- `NotAllowedError` → Permission denied
- `Failed to parse` → Decryption issue (check VAPID keys match)
- No logs at all → Push not reaching service worker (check subscription is valid)

### Issue: FCM shows success but no notification appears
**Check in order:**
1. Notification permission (#1)
2. Service worker is active (#2)
3. Push subscription exists (#3)
4. Service worker logs (#4) - do you see `[SW] 🔔 Push event received`?

## Still Having Issues?

1. **Check browser console for errors** - Look for red error messages
2. **Check Network tab** - See if service worker file loads correctly
3. **Try different browser** - Chrome, Firefox, Edge
4. **Check browser notification settings** - System-level notification settings
5. **Try incognito/private mode** - Rules out extension interference

