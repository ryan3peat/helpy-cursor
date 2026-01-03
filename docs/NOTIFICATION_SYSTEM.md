# Helpy Notification System

Complete documentation for the push notification system in Helpy.

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [User Experience](#user-experience)
4. [Technical Components](#technical-components)
5. [Database Schema](#database-schema)
6. [Edge Function](#edge-function)
7. [Client-Side Services](#client-side-services)
8. [Bell Icon States](#bell-icon-states)
9. [Troubleshooting](#troubleshooting)
10. [Testing](#testing)

---

## Overview

Helpy uses Web Push API to send real-time notifications to household members when activities occur:

- 🛒 Shopping items added/bought
- 📝 Tasks added/completed
- 🍽️ Meals planned
- 💰 Expenses logged
- 📌 Family Board updated

**Key Principle:** The notification toggle works like WhatsApp — ON means it works, OFF means it's off. No confusion.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER ACTION                                  │
│              (e.g., adds item to shopping list)                     │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      DATABASE TRIGGER                                │
│              queue_notification() → notification_queue               │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   BATCH PROCESSOR                                    │
│         process_notification_batches() (immediate or 5-min backup)  │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    EDGE FUNCTION                                     │
│                 send-notification/index.ts                           │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ 1. Query eligible users (not Child, notifications_enabled) │    │
│  │ 2. Filter out creator (except Liko test mode)              │    │
│  │ 3. Get push subscriptions from database                    │    │
│  │ 4. Encrypt payload with VAPID/Web Push                     │    │
│  │ 5. Send to FCM/APNS endpoints                              │    │
│  │ 6. Remove expired subscriptions (410/404)                  │    │
│  │ 7. Queue failed for retry (5xx)                            │    │
│  │ 8. Save to notifications table (in-app history)           │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    SERVICE WORKER                                    │
│                      sw-push.js                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ 1. Receive encrypted push                                   │    │
│  │ 2. Decrypt and parse JSON payload                          │    │
│  │ 3. Show notification with title, body, icon                │    │
│  │ 4. Increment app badge                                      │    │
│  │ 5. Handle click → open app to relevant page                │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## User Experience

### Toggling Notifications ON

1. User taps the notification toggle in Settings
2. Browser shows "Allow notifications?" prompt
3. If user taps Allow:
   - Push subscription is created in browser
   - Subscription saved to `push_subscriptions` table
   - **Capability check** verifies everything works
   - Bell icon turns blue ✓
4. If user taps Block:
   - Error modal shows with instructions
   - Toggle reverts to OFF

### Toggling Notifications OFF

1. User taps the toggle
2. Subscription removed from browser
3. Subscription deleted from database
4. Bell icon turns gray ✓

### App Load Behavior

Every time the app opens:
1. `checkNotificationCapability()` runs
2. Verifies: permission granted + service worker + browser subscription + database match
3. If broken → auto-fix silently if possible
4. Updates bell icon to reflect **actual** status

---

## Technical Components

### Files Overview

| File | Purpose |
|------|---------|
| `supabase/functions/send-notification/index.ts` | Edge function that sends push notifications |
| `services/pushNotificationService.ts` | Client-side push subscription management |
| `public/sw-push.js` | Service worker for receiving/displaying notifications |
| `services/appBadgeService.ts` | App icon badge management |
| `components/Profile.tsx` | Notification toggle UI |
| `App.tsx` | Capability check on load |

### Key Functions

#### `pushNotificationService.ts`

```typescript
// Check if notifications will ACTUALLY work
checkNotificationCapability(userId, householdId): Promise<{
  capable: boolean;
  reason?: 'unsupported' | 'permission_denied' | 'permission_not_asked' | 
           'no_service_worker' | 'no_browser_subscription' | 
           'no_database_subscription' | 'subscription_mismatch';
}>

// Try to silently fix broken notifications
autoFixNotificationIssues(userId, householdId): Promise<boolean>

// Subscribe user to push notifications
subscribeToPush(userId, householdId): Promise<PushSubscription | null>

// Unsubscribe from push notifications
unsubscribeFromPush(userId, householdId): Promise<void>

// Validate and sync subscription on app load
validateAndSyncSubscription(userId, householdId, notificationsEnabled): Promise<{
  valid: boolean;
  action: 'none' | 'synced' | 'cleaned' | 'disabled';
}>
```

---

## Database Schema

### `push_subscriptions` Table

```sql
CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,           -- FCM/APNS push endpoint URL
  p256dh_key TEXT NOT NULL,         -- Encryption key (base64url)
  auth_key TEXT NOT NULL,           -- Auth secret (base64url)
  user_agent TEXT,                  -- Browser info
  device_fingerprint TEXT,          -- Unique device identifier
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, endpoint)
);
```

### `notifications` Table (In-App History)

```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL,
  recipient_user_id UUID NOT NULL,
  type TEXT NOT NULL,               -- 'todo_item', 'meal', 'expense', 'family_board'
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  reference_id UUID,                -- ID of the item
  reference_table TEXT,             -- Source table name
  triggered_by_user_id UUID,
  triggered_by_name TEXT,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### `notification_queue` Table (Batching)

```sql
CREATE TABLE notification_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  event_type TEXT NOT NULL,         -- 'INSERT', 'UPDATE', 'DELETE'
  record_data JSONB NOT NULL,
  old_record_data JSONB,
  created_by_user_id UUID,
  batch_key TEXT NOT NULL,          -- For grouping: household_id:table:type:user
  processed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Edge Function

### Location
`supabase/functions/send-notification/index.ts`

### Environment Variables

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key for database access |
| `VAPID_PUBLIC_KEY` | Web Push VAPID public key (base64url) |
| `VAPID_PRIVATE_KEY` | Web Push VAPID private key (PKCS8, base64url) |
| `VAPID_SUBJECT` | Contact email (e.g., `mailto:hello@helpy.app`) |

### Notification Format

```
Title: [Emoji] [Page Name]
Body:  [Item Name]
       [action] by [User]

Examples:
  🛒 Shopping
  Milk
  added by Ryan

  ✅ Tasks
  Take out trash
  done by Michelle
```

### Special Cases

1. **Liko Test Mode**: `julianoliko@gmail.com` receives notifications for their own actions (for testing)
2. **Helper Restrictions**: Helpers don't receive expense notifications from others
3. **Child Exclusion**: Users with role "Child" never receive notifications

---

## Client-Side Services

### Service Worker (`sw-push.js`)

Handles:
- Receiving push events
- Decrypting payload
- Showing notifications
- Incrementing app badge (IndexedDB persisted)
- Click handling → navigate to relevant page
- CLEAR_BADGE message from app

### App Badge

The app icon shows a badge count:
- Incremented when notification received (service worker)
- Cleared when app opens (via `markAppAsSeen()`)
- Uses Badging API (Chrome 81+, Safari 17.4+)

---

## Bell Icon States

| Icon | Color | Meaning | User Action |
|------|-------|---------|-------------|
| 🔔 Bell | Blue (primary) | Notifications working | None |
| 🔔• BellDot | Orange | Setup incomplete | Toggle off/on or check permissions |
| 🔕 BellOff | Gray | Disabled by user | Toggle on if desired |
| 🔕 BellOff | Red | Child account | Cannot enable |

### Logic (Dashboard/Profile)

```tsx
if (user.role === 'Child') return <BellOff gray />;
if (!user.notificationsEnabled) return <BellOff red />;
if (!user.hasPushSubscription) return <BellDot orange />;
return <Bell blue />;
```

---

## Troubleshooting

### User Reports: "Bell is blue but I don't get notifications"

**This should not happen anymore.** The system now:
1. Validates capability on every app load
2. Auto-fixes if possible
3. Updates bell icon to reflect reality

If it still happens:
1. Check browser console for `[Push]` logs
2. Run `helpyDebugPush()` in console
3. Check Edge Function logs in Supabase Dashboard

### Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| "Permission denied" | User blocked in browser | Open browser settings, allow notifications |
| "No service worker" | SW not registered | Refresh page, clear cache |
| "Subscription mismatch" | DB has old subscription | Auto-fixed on app load |
| "No browser subscription" | Subscription expired | Auto-fixed by re-subscribing |

### Debug Commands

```javascript
// In browser console:
helpyDebugPush('user_xxx', 'household-uuid')

// Output shows:
// - Push supported
// - Notification permission
// - Service worker status
// - Browser subscription
// - Database subscriptions
```

---

## Testing

### Test Liko's Self-Notifications

1. Log in as `julianoliko@gmail.com`
2. Add a shopping item
3. Should receive notification immediately

### Test Normal Flow

1. Log in as User A on Device 1
2. Log in as User B on Device 2
3. User A adds a shopping item
4. User B receives notification on Device 2

### Verify Bell Icon States

1. Toggle notifications OFF → bell turns gray/red
2. Toggle notifications ON → Allow prompt → bell turns blue
3. Close app, revoke permission in browser → reopen → bell should turn orange

---

## Migrations

Run these in order if setting up fresh:

1. `migrations/007_push_notifications.sql` - Base tables
2. `migrations/022_fix_notifications_complete.sql` - Fixes
3. `migrations/025_notification_batching.sql` - Batching system
4. `migrations/027_notification_system_cleanup.sql` - Cleanup + fingerprinting
5. `migrations/028_batch_processing_backup.sql` - Backup timer
6. `migrations/029_push_retry_queue.sql` - Retry queue

---

## Deployment

### Edge Function

```bash
supabase functions deploy send-notification --no-verify-jwt
```

Or via Supabase Dashboard → Edge Functions → Deploy

### Frontend

Push to deployment branch or run:
```bash
vercel deploy --prod
```

---

## Version History

| Date | Change |
|------|--------|
| Jan 3, 2026 | Added capability check, auto-fix, reliable toggle |
| Jan 3, 2026 | Added Liko test mode |
| Jan 3, 2026 | Replaced alert() with Helpy modal |
| Jan 3, 2026 | Added device fingerprinting |
| Jan 3, 2026 | Added batch processing backup |
| Jan 3, 2026 | Added retry queue for failed pushes |

---

## Contact

For issues with notifications, check:
1. Browser console logs (`[Push]` prefix)
2. Supabase Edge Function logs
3. `push_subscriptions` table in database

