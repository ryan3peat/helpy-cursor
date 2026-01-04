# Push Notifications Architecture

> **Last Updated:** January 6, 2026
> **Status:** Working on iOS PWA, Android PWA, Chrome Desktop

## Overview

Helpy uses Web Push API for notifications. Notifications work in PWA mode only (not in browser).

## Critical Knowledge

### User ID Types

**IMPORTANT:** The app uses TWO types of user IDs:

| Type | Format | Example | Used In |
|------|--------|---------|---------|
| **Clerk ID** | `user_xxxxx` | `user_36L688nqMQ5KZDl...` | `currentUser.id` in React, app state |
| **Supabase UUID** | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` | `27c787f0-2140-48bc-8c5d-3167f3ebf10b` | Database tables, `push_subscriptions.user_id` |

When `currentUser` is loaded from the database:
- `currentUser.id` is set to the **Clerk ID** (if user has one)
- The Supabase UUID is stored in `userIdCache` for resolution

### Why This Matters

The `push_subscriptions` table uses **Supabase UUIDs** as foreign keys to `users.id`. If you try to save a subscription with a Clerk ID, it will fail with a foreign key violation.

**Solution:** Always use the API route `/api/save-push-subscription-v2` which resolves Clerk ID → UUID server-side.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT (Browser/PWA)                     │
├─────────────────────────────────────────────────────────────────┤
│  App.tsx                                                         │
│  └─ useEffect (on currentUser change)                           │
│     └─ ensureCurrentSubscriptionSaved()                         │
│        └─ Calls /api/save-push-subscription-v2                  │
│  └─ useEffect (service worker message listener)                 │
│     └─ Handles NAVIGATE messages for in-app navigation          │
│                                                                  │
│  sw-push.js (Service Worker)                                    │
│  └─ Listens for push events → shows notifications               │
│  └─ Handles notification clicks:                                │
│     └─ If app open: postMessage(NAVIGATE) → in-app navigation  │
│     └─ If app closed: openWindow() → full page load             │
├─────────────────────────────────────────────────────────────────┤
│                         VERCEL API ROUTES                        │
├─────────────────────────────────────────────────────────────────┤
│  /api/save-push-subscription-v2.ts                              │
│  └─ Resolves Clerk ID → Supabase UUID                           │
│  └─ Saves subscription using service role (bypasses RLS)        │
├─────────────────────────────────────────────────────────────────┤
│                         SUPABASE                                 │
├─────────────────────────────────────────────────────────────────┤
│  Database:                                                       │
│  └─ push_subscriptions table                                    │
│  └─ users table (with clerk_id column)                          │
│                                                                  │
│  Edge Function: send-notification                               │
│  └─ Triggered by database triggers on todo_items, meals, etc.  │
│  └─ Encrypts payload with VAPID                                 │
│  └─ Sends to push endpoints (Apple/Google)                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Files

### Client-Side

| File | Purpose |
|------|---------|
| `services/pushNotificationService.ts` | All push notification logic |
| `utils/pwaUtils.ts` | PWA detection, device ID |
| `components/NotificationPrompt.tsx` | First-launch notification modal |
| `public/sw-push.js` | Service worker for receiving push + notification click handling |
| `App.tsx` | Auto-sync on app load + NAVIGATE message listener for in-app navigation |
| `components/Profile.tsx` | Notification toggle UI |

### Server-Side (Vercel)

| File | Purpose |
|------|---------|
| `api/save-push-subscription-v2.ts` | **PRIMARY** - Save subscriptions with Clerk ID resolution |
| `api/save-push-subscription.ts` | Legacy - requires UUID directly |

### Supabase

| Resource | Purpose |
|----------|---------|
| `push_subscriptions` table | Stores browser push endpoints |
| `send-notification` Edge Function | Sends actual push notifications |
| Database triggers | Fire Edge Function on INSERT/UPDATE |

---

## Database Schema

### push_subscriptions table

```sql
CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,           -- Push service URL (Apple/Google)
  p256dh_key TEXT NOT NULL,         -- Encryption key
  auth_key TEXT NOT NULL,           -- Auth secret
  user_agent TEXT,                  -- Browser info
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, endpoint)         -- One subscription per user per endpoint
);
```

### RLS Policies

See `migrations/049_fix_push_subscriptions_rls_complete.sql` for current policies.

Key points:
- SELECT: Users can view subscriptions in their household
- INSERT/UPDATE/DELETE: Users can manage their own subscriptions
- Service role (used by API) bypasses RLS

---

## Flow: Enabling Notifications

### First-Time Setup (via NotificationPrompt)

1. User installs PWA and opens app
2. `NotificationPrompt.tsx` appears (if not previously dismissed)
3. User taps "Enable"
4. Browser shows OS permission prompt
5. If granted:
   - `subscribeToPush()` creates browser subscription
   - Subscription saved via `/api/save-push-subscription-v2`
   - `users.notifications_enabled` set to `true`
   - `users.has_push_subscription` set to `true`

### On Every App Load

1. `App.tsx` useEffect runs when `currentUser` changes
2. If `notificationsEnabled === true` AND `Notification.permission === 'granted'`:
   - Calls `ensureCurrentSubscriptionSaved()`
   - This ensures the CURRENT browser's subscription is in the database
   - Handles case where user cleared cache (new subscription endpoint)

### Toggle OFF (in Profile Settings)

1. User toggles notification switch OFF
2. `users.notifications_enabled` set to `false`
3. Browser subscription is **preserved** (not deleted)
4. Push messages still arrive but Edge Function skips this user

### Toggle ON (in Profile Settings)

1. User toggles notification switch ON
2. Check if browser subscription exists:
   - If yes: Just set `notifications_enabled = true`
   - If no: Create new subscription, save to DB
3. `users.notifications_enabled` set to `true`

---

## Flow: Sending Notifications

1. User creates/updates todo, meal, expense, or family board
2. Database trigger fires `send-notification` Edge Function
3. Edge Function:
   - Determines notification type and content
   - Gets all users in household with `notifications_enabled = true`
   - Filters out the creator (except Liko for testing)
   - Gets all push subscriptions for eligible users
   - Encrypts payload with VAPID
   - Sends to each push endpoint
4. Push service (Apple/Google) delivers to device
5. `sw-push.js` receives push event, shows notification

---

## Flow: Notification Click Handling

When user taps a notification, `sw-push.js` handles navigation:

### If App is Already Open

Uses **in-app navigation** via `postMessage` to avoid Clerk auth flash:

1. Service worker finds existing app window via `clients.matchAll()`
2. Sends `NAVIGATE` message: `client.postMessage({ type: 'NAVIGATE', url: '/#todo?section=shopping' })`
3. `App.tsx` message listener receives the message
4. Parses URL and calls `setActiveView()` / `setNavData()`
5. App navigates instantly without page reload
6. Clerk session stays active (no auth screen flash)

### If App is Closed

Uses **full page navigation**:

1. Service worker calls `clients.openWindow(fullUrl)`
2. New browser window/tab opens with the target URL
3. React app loads fresh, Clerk validates session
4. User sees "Tidying things up..." loader briefly, then app

### Message Types (SW ↔ Client)

| Direction | Type | Purpose |
|-----------|------|---------|
| Client → SW | `CLEAR_BADGE` | Clear app icon badge |
| Client → SW | `SYNC_BADGE` | Sync badge with notification count |
| Client → SW | `PING` | Health check |
| **SW → Client** | `NAVIGATE` | In-app navigation from notification click |

### Why postMessage Instead of navigate()?

The original approach used `client.navigate(fullUrl)` which caused:
- Full page reload
- React unmount/remount
- Clerk re-verification (takes ~1 second)
- Brief flash of auth screen before main app

Using `postMessage` keeps React in memory and navigates without reload.

---

## Debugging

### Bell Icon Colors

| Color | Meaning |
|-------|---------|
| **Blue** | Working - notifications enabled and subscription synced |
| **Orange** | Incomplete - enabled but no subscription |
| **Pink/Red** | Disabled or blocked |
| **Grey** | Child role (can't receive notifications) |

### Common Issues

#### "Notifications not working on iOS"

1. Check if running as PWA (not browser)
2. Check `Notification.permission === 'granted'`
3. Check database for subscription with matching endpoint
4. Check Edge Function logs in Supabase

#### "Sync failing with user ID error"

The sync is probably using a Clerk ID instead of UUID. Ensure you're using `/api/save-push-subscription-v2` which handles resolution.

#### "Stale subscription after reinstall"

When user reinstalls PWA:
- Browser creates NEW subscription with new endpoint
- Old endpoint in database no longer works
- `ensureCurrentSubscriptionSaved()` should sync the new endpoint on app load

### Liko Test Mode

For testing, Liko (`julianoliko@gmail.com`) receives their OWN notifications. This is hardcoded in the Edge Function:

```typescript
// In send-notification/index.ts
if (creatorEmail === 'julianoliko@gmail.com') {
  // Don't filter out Liko from recipients
}
```

---

## Environment Variables

### Client (.env.local)

```
VITE_VAPID_PUBLIC_KEY=<public key>
VITE_APP_URL=https://app.helpyfam.com
```

### Vercel

```
SUPABASE_URL=<supabase url>
SUPABASE_SERVICE_ROLE_KEY=<service role key>
```

### Supabase Edge Function Secrets

```
VAPID_PUBLIC_KEY=<public key>
VAPID_PRIVATE_KEY=<private key>
VAPID_SUBJECT=mailto:julianoliko@gmail.com
```

---

## Migrations

| Migration | Purpose |
|-----------|---------|
| `022_fix_notifications_complete.sql` | Initial notification setup |
| `048_fix_push_subscriptions_rls.sql` | Fix SELECT policy |
| `049_fix_push_subscriptions_rls_complete.sql` | Fix all RLS policies |

---

## Testing Checklist

- [ ] Enable notifications on iOS PWA
- [ ] Enable notifications on Android PWA
- [ ] Enable notifications on Chrome Desktop
- [ ] Toggle OFF and ON again
- [ ] Clear cache and reinstall PWA (should auto-sync)
- [ ] Create task → other household members receive notification
- [ ] Update family board → notification received
- [ ] Add expense → notification received
- [ ] Click notification (app open) → navigates without auth flash
- [ ] Click notification (app closed) → opens app and navigates correctly

---

## Known Limitations

1. **PWA Only**: Notifications don't work in regular browser
2. **iOS Persistence**: iOS may aggressively cache JS - sometimes need full reinstall
3. **Multiple Devices**: Each device has its own subscription endpoint
4. **Service Worker**: Must be registered and active for notifications to work

---

## Related Memories

When working on notifications, these agent memories are relevant:
- Memory about Clerk ID vs UUID resolution
- Memory about bell icon colors
- Memory about Liko test mode
- Memory about RLS policies

