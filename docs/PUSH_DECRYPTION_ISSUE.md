# Push Notification Decryption Issue

## Problem

Service worker receives push events but fails to parse the data:
```
[SW] ❌ Failed to parse push data as JSON: {error: "Test push "... is not valid JSON}
```

## Root Causes

### 1. Browser Test Push (Plain Text)
If you're using browser DevTools to test (Chrome: Application → Service Workers → Push), it sends **plain text**, not encrypted JSON. This is expected behavior.

**Solution:** Test with real notifications from your app, not browser test tools.

### 2. Browser Decryption Failure
If the browser can't decrypt the encrypted payload, it may deliver it as:
- Plain text (garbled)
- ArrayBuffer (raw bytes)
- Empty/null

**Common causes:**
- Content-Encoding header mismatch
- Subscription keys (p256dh, auth) don't match between database and browser
- VAPID keys don't match between client and server
- Encryption format doesn't match browser expectations

## Diagnosis Steps

### Step 1: Check What Data Type is Received

The updated service worker will now log what type of data it receives. Look for:
```
[SW] Raw push data as text: ...
[SW] Text data length: ...
[SW] Final data type detected: ...
```

### Step 2: Verify Subscription Keys Match

Run in browser console:
```javascript
// Get browser subscription
navigator.serviceWorker.getRegistration('/')
  .then(reg => reg.pushManager.getSubscription())
  .then(sub => {
    if (sub) {
      const browserKeys = sub.toJSON().keys;
      console.log('Browser subscription keys:');
      console.log('  p256dh:', browserKeys.p256dh);
      console.log('  auth:', browserKeys.auth);
      console.log('  endpoint:', sub.endpoint);
      
      // Now check database (you'll need to query your database)
      console.log('\n→ Compare these with keys in push_subscriptions table');
      console.log('→ Keys must match exactly for decryption to work');
    }
  });
```

### Step 3: Verify VAPID Keys Match

**Client (browser):**
- Check `VITE_VAPID_PUBLIC_KEY` in your `.env` file

**Server (edge function):**
- Check `VAPID_PUBLIC_KEY` in Supabase Edge Function environment variables
- They must be **identical**

### Step 4: Check Content-Encoding Header

In Supabase edge function logs, verify:
```
[Push] Sending to FCM endpoint: {
  headers: {
    'Content-Encoding': 'aes128gcm',  // ← Must be aes128gcm
    ...
  }
}
```

### Step 5: Test with Real Notification

**Don't use browser test tools** - they send plain text.

Instead:
1. Open your app in one browser/device
2. Switch to another browser/device (or have another user)
3. Create a todo item, expense, or meal
4. Check service worker logs for the real encrypted payload

## Common Issues & Fixes

### Issue: "Test push..." Error
**Cause:** Using browser DevTools test push (sends plain text)
**Fix:** Test with real notifications from your app

### Issue: Data Type is "arraybuffer"
**Cause:** Browser couldn't decrypt, delivered raw encrypted bytes
**Fix:** 
1. Check subscription keys match between browser and database
2. Verify VAPID keys match
3. Ensure Content-Encoding is `aes128gcm`

### Issue: Data Type is "text" but garbled
**Cause:** Decryption partially failed or wrong format
**Fix:**
1. Re-subscribe user (disable then enable notifications)
2. This creates fresh subscription with matching keys

### Issue: No data at all
**Cause:** Push event received but payload is empty
**Fix:**
1. Check edge function logs - is payload being encrypted?
2. Check FCM response - did it accept the push?
3. Verify subscription is still valid (not expired)

## Verification Checklist

- [ ] Not using browser test push tools
- [ ] Testing with real notifications from app
- [ ] Subscription keys match between browser and database
- [ ] VAPID public key matches between client and server
- [ ] Content-Encoding header is `aes128gcm`
- [ ] Service worker is active and controlling the page
- [ ] Notification permission is granted
- [ ] Browser is not suppressing notifications (tab in background)

## Next Steps

After updating the service worker with better logging:

1. **Trigger a real notification** (create todo/expense/meal)
2. **Check service worker logs** for:
   - `[SW] Raw push data as text: ...`
   - `[SW] Final data type detected: ...`
3. **Share the logs** - this will show exactly what the browser received

