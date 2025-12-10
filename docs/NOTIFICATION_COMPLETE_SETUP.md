# Complete Push Notification Setup Guide

This guide will help you set up push notifications from scratch and verify everything is working.

## Quick Checklist

- [ ] Run the SQL migration `022_fix_notifications_complete.sql`
- [ ] Generate VAPID keys
- [ ] Add VAPID keys to `.env` file
- [ ] Add VAPID keys to Supabase Edge Function secrets
- [ ] Deploy the Edge Function (if not already deployed)
- [ ] Test by toggling notifications ON in the app

---

## Step 1: Run the Database Migration

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Open file: `migrations/022_fix_notifications_complete.sql`
3. Paste the entire contents and click **Run**
4. Check the output - you should see all green checkmarks

This migration:
- Enables the `pg_net` extension
- Creates/updates the trigger function with correct URL
- Ensures all triggers exist on `todo_items`, `meals`, `expenses`
- Creates the `push_subscriptions` table
- Adds `notifications_enabled` column to users
- Adds `created_by` column to track who created items

---

## Step 2: Generate VAPID Keys

VAPID keys are required for Web Push authentication. You need both a **public key** (for frontend) and **private key** (for backend).

### Method 1: Using npx (Recommended)

```bash
npx web-push generate-vapid-keys
```

Output:
```
Public Key:  BNxRLf...long string...
Private Key: 4h8k9j...long string...
```

### Method 2: Using Browser Console

Open browser DevTools (F12) → Console, paste this:

```javascript
async function generateVAPIDKeys() {
  const keyPair = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify']
  );
  
  const publicKey = await crypto.subtle.exportKey('raw', keyPair.publicKey);
  const privateKey = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
  
  const toBase64Url = (buffer) => btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  
  console.log('VITE_VAPID_PUBLIC_KEY=' + toBase64Url(publicKey));
  console.log('VAPID_PRIVATE_KEY=' + toBase64Url(privateKey));
}
generateVAPIDKeys();
```

**Important:** The browser method generates keys in PKCS8 format which is required by the Edge Function.

---

## Step 3: Add Keys to .env File

Add these to your `.env` file:

```env
# Push Notifications
VITE_VAPID_PUBLIC_KEY=your_public_key_here
VAPID_PRIVATE_KEY=your_private_key_here
VAPID_SUBJECT=mailto:hello@helpy.app
```

---

## Step 4: Add Keys to Supabase Edge Function Secrets

The Edge Function needs the same keys. Set them using **one** of these methods:

### Option A: Supabase CLI

```bash
supabase secrets set VAPID_PUBLIC_KEY=your_public_key_here
supabase secrets set VAPID_PRIVATE_KEY=your_private_key_here
supabase secrets set VAPID_SUBJECT=mailto:hello@helpy.app
```

### Option B: Supabase Dashboard

1. Go to **Supabase Dashboard** → **Edge Functions**
2. Click on `send-notification` function
3. Click **Manage secrets**
4. Add these secrets:
   - `VAPID_PUBLIC_KEY` = your public key
   - `VAPID_PRIVATE_KEY` = your private key
   - `VAPID_SUBJECT` = `mailto:hello@helpy.app`

---

## Step 5: Deploy the Edge Function (if needed)

Check if the function is deployed:
- Go to **Supabase Dashboard** → **Edge Functions**
- Look for `send-notification`

If not deployed, run:

```bash
supabase functions deploy send-notification
```

---

## Step 6: Add Keys to Vercel (for Production)

In **Vercel Dashboard** → **Settings** → **Environment Variables**, add:

- `VITE_VAPID_PUBLIC_KEY` = your public key

---

## Testing Notifications

### 1. Enable Notifications in App

1. Open the app
2. Go to **Profile** → **Account Settings**
3. Toggle **Notifications** ON
4. Accept the browser permission prompt

### 2. Check Browser Console

Look for these messages:
```
[Push] Service worker registered
[Push] Subscription saved to database
```

### 3. Run Debug Function

In browser console:
```javascript
window.helpyDebugPush()
```

This shows:
- VAPID key status
- Service worker status
- Browser subscription
- Database subscriptions

### 4. Check Database

Run in Supabase SQL Editor:

```sql
-- Check if your subscription was saved
SELECT * FROM push_subscriptions;

-- Check if notifications are enabled
SELECT name, notifications_enabled FROM users;
```

### 5. Test Notification

1. Have TWO users in the same household
2. User A adds a shopping item
3. User B should receive a notification

---

## Troubleshooting

### Notifications not appearing

| Check | How |
|-------|-----|
| Browser permission | Settings → Privacy → Notifications |
| VAPID keys match | Same key in .env AND Supabase secrets |
| Edge Function deployed | Dashboard → Edge Functions |
| pg_net enabled | Dashboard → Database → Extensions |
| Triggers exist | Run verification SQL in migration |

### Check Edge Function Logs

1. Go to **Supabase Dashboard** → **Edge Functions** → **send-notification**
2. Click **Logs**
3. Look for `[Push]` messages

### Common Errors

| Error | Solution |
|-------|----------|
| `VAPID not configured` | Add VAPID keys to Edge Function secrets |
| `Failed to sign VAPID JWT` | Private key is wrong format - regenerate using browser method |
| `Subscription expired (410)` | User needs to re-enable notifications |
| `Permission denied` | User blocked notifications in browser |

---

## iOS-Specific Notes

For iOS Safari (16.4+):
- User MUST add the app to Home Screen (as PWA)
- Notifications only work when app is added to Home Screen
- Chrome on iOS does NOT support push (uses Safari engine)

---

## Architecture Reference

```
User toggles ON → Browser asks permission → Subscription created → Saved to database
                                                                         ↓
User adds item → Database trigger fires → Edge Function called → Fetches subscriptions
                                                                         ↓
                                              Encrypts payload → Sends via Web Push API
                                                                         ↓
                                              Push service → Service Worker → Phone notification
```

