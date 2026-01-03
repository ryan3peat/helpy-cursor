# Notification System Upgrade

This document summarizes the comprehensive notification system improvements made on Jan 3, 2026.

## Changes Made

### 1. Edge Function Fixes (`supabase/functions/send-notification/index.ts`)

- **Fixed**: Added `email` to user query (was missing, causing LIKO_TEST_MODE to never work)
- **Removed**: LIKO_TEST_MODE - everyone now follows the same rules (no self-notifications)
- **Added**: Retry queue support for 5xx server errors
- **Added**: Better logging for failed pushes

### 2. Subscription Validation (`services/pushNotificationService.ts`)

- **Added**: `validateAndSyncSubscription()` - validates browser subscription matches database on app load
- **Added**: `generateDeviceFingerprint()` - creates unique device identifier to prevent duplicate subscriptions
- **Added**: `triggerBatchProcessing()` - client-side RPC call to process notification batches
- **Added**: `startPeriodicBatchProcessing()` / `stopPeriodicBatchProcessing()` - runs every 5 minutes as backup

### 3. App Integration (`App.tsx`)

- **Updated**: Push initialization now validates and syncs subscriptions on load
- **Added**: Periodic batch processing starts automatically when app loads

### 4. SQL Migrations (Run in Supabase SQL Editor)

#### Migration 027: Cleanup and Fingerprinting
- Cleans up stale push subscriptions (keeps only 2 newest per user)
- Removes orphaned user records (no email, no clerk_id)
- Adds `device_fingerprint` column to push_subscriptions
- Creates `cleanup_stale_push_subscriptions()` function
- Creates `upsert_push_subscription()` function

#### Migration 028: Batch Processing Backup
- Creates `trigger_notification_batches()` RPC function
- Adds pg_cron job if available (every 5 minutes)

#### Migration 029: Push Retry Queue
- Creates `push_retry_queue` table
- Creates `queue_push_for_retry()` function
- Creates `process_push_retry_queue()` function
- Creates `trigger_push_retries()` RPC function
- Adds pg_cron job if available (every 2 minutes)

---

## Deployment Steps

### Step 1: Run SQL Migrations

Go to **Supabase Dashboard → SQL Editor** and run these in order:

1. `migrations/027_notification_system_cleanup.sql`
2. `migrations/028_batch_processing_backup.sql`
3. `migrations/029_push_retry_queue.sql`

### Step 2: Deploy Edge Function

```bash
cd ~/Desktop/HELPY\ CURSOR/helpy-cursor
supabase login  # if not logged in
supabase functions deploy send-notification --no-verify-jwt
```

Or deploy via Supabase Dashboard:
1. Go to Edge Functions → send-notification
2. Click Deploy/Update

### Step 3: Deploy Frontend

The frontend changes will be deployed automatically when you push to your deployment branch, or run:

```bash
vercel deploy --prod
```

---

## Verification

After deployment, verify the system is working:

### 1. Check Push Subscriptions

```sql
SELECT 
  (SELECT name FROM users WHERE id = user_id) as user_name,
  COUNT(*) as subscription_count,
  MAX(created_at) as newest
FROM push_subscriptions 
GROUP BY user_id;
```

Each user should have 1-2 subscriptions max.

### 2. Check Retry Queue

```sql
SELECT * FROM push_retry_queue WHERE retry_count < max_retries;
```

Should be empty unless there are actual failures.

### 3. Test Notification Flow

1. User A adds a shopping item
2. User B should receive notification within 15 seconds
3. Check Edge Function logs for success messages

### 4. Check Batch Processing

```sql
SELECT * FROM public.trigger_notification_batches();
```

Should return success with processed count.

---

## Rollback

If issues occur:

### Rollback Edge Function
Redeploy the previous version from git:
```bash
git checkout HEAD~1 -- supabase/functions/send-notification/index.ts
supabase functions deploy send-notification --no-verify-jwt
```

### Rollback Migrations
The migrations are additive and don't break existing functionality. However, if needed:

```sql
-- Remove retry queue
DROP TABLE IF EXISTS push_retry_queue;
DROP FUNCTION IF EXISTS queue_push_for_retry;
DROP FUNCTION IF EXISTS process_push_retry_queue;
DROP FUNCTION IF EXISTS trigger_push_retries;

-- Remove batch processing RPC
DROP FUNCTION IF EXISTS trigger_notification_batches;

-- Remove device fingerprint column
ALTER TABLE push_subscriptions DROP COLUMN IF EXISTS device_fingerprint;
```

---

## Architecture After Upgrade

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT (App.tsx)                             │
├─────────────────────────────────────────────────────────────────────┤
│  On Load:                                                            │
│  1. validateAndSyncSubscription() - ensures DB matches browser       │
│  2. startPeriodicBatchProcessing() - backup batch trigger (5 min)    │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      DATABASE TRIGGERS                               │
├─────────────────────────────────────────────────────────────────────┤
│  queue_notification() → notification_queue → process_batches()      │
│  (with pg_cron backup OR client-side RPC every 5 min)               │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    EDGE FUNCTION (send-notification)                 │
├─────────────────────────────────────────────────────────────────────┤
│  1. Query eligible users (with email now!)                           │
│  2. Filter out creator (everyone follows same rules)                 │
│  3. Send to all push endpoints                                       │
│  4. Remove expired subscriptions (410/404)                           │
│  5. Queue failed for retry (5xx) → push_retry_queue                  │
│  6. Save to notifications table                                      │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    RETRY QUEUE (push_retry_queue)                    │
├─────────────────────────────────────────────────────────────────────┤
│  process_push_retry_queue() runs via:                                │
│  - pg_cron every 2 minutes (if available)                            │
│  - OR client RPC call                                                │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Key Improvements

| Before | After |
|--------|-------|
| "by Someone" appeared randomly | Always shows correct creator name |
| LIKO_TEST_MODE broken | Removed - same rules for everyone |
| Stale subscriptions accumulated | Auto-cleanup, max 2 per user |
| Orphaned users in database | Cleaned up |
| No subscription validation | Validates on every app load |
| Duplicate device subscriptions | Device fingerprinting prevents duplicates |
| Batches stuck if no new items | Periodic processing every 5 minutes |
| Failed pushes lost forever | Retry queue with exponential backoff |

