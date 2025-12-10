# Testing if Service Worker Receives Push Events

If FCM shows success but you don't see `[SW]` logs, the push event might not be reaching the service worker.

## Important: Browser Behavior

**Most browsers only deliver push notifications when:**
- The browser tab is **in the background** (not active/focused)
- OR the browser window is **minimized**
- OR the browser is **closed** (but still running in background)

**If your tab is active/focused, the browser may suppress the push event!**

## Test Steps

### Step 1: Verify Service Worker is Active and Controlling

Run in console:

```javascript
navigator.serviceWorker.getRegistration('/').then(reg => {
  if (reg) {
    console.log('Service Worker State:', reg.active?.state);
    console.log('Controlling:', reg.active ? 'Yes' : 'No');
    
    // Check if service worker is controlling this page
    if (navigator.serviceWorker.controller) {
      console.log('✅ Service worker is controlling this page');
      console.log('Controller script:', navigator.serviceWorker.controller.scriptURL);
    } else {
      console.log('⚠️ Service worker is NOT controlling this page');
      console.log('→ Try refreshing the page or closing/reopening the tab');
    }
  }
});
```

**If service worker is NOT controlling:**
- Refresh the page (Ctrl+R or Cmd+R)
- Or close and reopen the tab
- Or unregister and re-register the service worker

### Step 2: Test with Tab in Background

1. **Open your app in a tab**
2. **Open DevTools Console** (F12)
3. **Filter for `[SW]`** in console
4. **Switch to a different tab** (or minimize the browser)
5. **In another tab/browser**, trigger a notification (create a todo item)
6. **Switch back** to your app tab
7. **Check console** for `[SW]` logs

### Step 3: Add Test Logging to Service Worker

If you still don't see logs, add this test to verify the service worker is running:

**In the browser console, run:**

```javascript
// Send a message to the service worker to test if it's active
navigator.serviceWorker.getRegistration('/').then(reg => {
  if (reg && reg.active) {
    reg.active.postMessage({ type: 'TEST', message: 'Hello from page' });
    console.log('✅ Test message sent to service worker');
  } else {
    console.log('❌ Service worker not active');
  }
});
```

**Then check the service worker logs** - you should see:
```
[SW] Message received: {type: "TEST", message: "Hello from page"}
```

If you don't see this, the service worker isn't running properly.

### Step 4: Check Service Worker Console

Service worker logs appear in a **separate console**:

1. **Open DevTools** (F12)
2. **Go to Application tab** (or Storage in Firefox)
3. **Click "Service Workers"** in left sidebar
4. **Find your service worker**
5. **Click "Inspect"** or the link next to it
6. This opens a **separate DevTools window** for the service worker
7. **Check the Console tab** in that window for `[SW]` logs

**This is important!** Service worker logs might appear in the service worker's console, not the page console.

### Step 5: Force Service Worker Update

If the service worker is stale, force an update:

```javascript
navigator.serviceWorker.getRegistrations().then(regs => {
  regs.forEach(reg => {
    reg.update();
    console.log('Service worker update requested');
  });
});

// Then unregister and re-register
navigator.serviceWorker.getRegistrations().then(regs => {
  regs.forEach(reg => reg.unregister());
  console.log('Service workers unregistered');
  location.reload(); // This will re-register on reload
});
```

### Step 6: Test Manual Push Event (Advanced)

If you want to test if the service worker can receive push events at all, you can simulate one:

**⚠️ This is for testing only - requires browser extension or special setup**

Alternatively, check if the browser is actually receiving the push:

```javascript
// Check if browser has received any push events
// (This won't show historical events, but can help debug)

// Listen for service worker messages
navigator.serviceWorker.addEventListener('message', event => {
  console.log('Message from service worker:', event.data);
});

// Check service worker state periodically
setInterval(() => {
  navigator.serviceWorker.getRegistration('/').then(reg => {
    if (reg && reg.active) {
      console.log('Service worker is active:', new Date().toISOString());
    }
  });
}, 5000);
```

## Common Issues

### Issue: Tab is Active/Focused
**Solution:** Test with tab in background or browser minimized

### Issue: Service Worker Not Controlling Page
**Solution:** Refresh page or unregister/re-register service worker

### Issue: Service Worker Console Not Checked
**Solution:** Check the service worker's own console (Application tab → Service Workers → Inspect)

### Issue: Browser Suppressing Notifications
**Solution:** 
- Check browser notification settings
- Some browsers require "Quiet hours" or "Focus assist" to be disabled
- Check Windows/Mac notification center settings

### Issue: Service Worker Not Updated
**Solution:** Force update or hard refresh (Ctrl+Shift+R or Cmd+Shift+R)

## Next Steps

1. **Try Step 2** (test with tab in background) - this is the most common issue
2. **Try Step 4** (check service worker console) - logs might be there
3. **Check browser notification settings** - system-level settings might be blocking

If none of these work, the push subscription might be stale even though it exists. Try re-subscribing:
- Disable notifications in your app
- Re-enable notifications in your app
- This will create a fresh subscription

