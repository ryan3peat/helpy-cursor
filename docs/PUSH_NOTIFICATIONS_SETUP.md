# Push Notifications Setup Guide

This guide explains how to set up mobile push notifications for the Helpy app.

## Overview

Helpy uses Web Push Notifications to notify household members when items are added to:
- Shopping List
- Tasks
- Meals
- Expenses

Notifications are sent to all household members except:
- The user who created the item
- Users with the "Child" role
- Users who have disabled notifications

## Architecture

```
User adds item → Supabase INSERT → Database Trigger → Edge Function → Web Push API → Device Notification
```

## Setup Steps

### 1. Generate VAPID Keys

VAPID (Voluntary Application Server Identification) keys are required for Web Push authentication.

**Option A: Using npx (recommended)**
```bash
npx web-push generate-vapid-keys
```

**Option B: Online generator**
Visit: https://www.attheminute.com/vapid-key-generator/

You'll get two keys:
- **Public Key**: Safe to expose in frontend code
- **Private Key**: Keep secret, only used in backend

### 2. Configure Environment Variables

#### Local Development (.env)

Create or update your `.env` file in the project root:

```env
# VAPID Keys for Web Push Notifications
VITE_VAPID_PUBLIC_KEY=your_public_key_here
VAPID_PRIVATE_KEY=your_private_key_here
VAPID_SUBJECT=mailto:your-email@example.com
```

#### Vercel (Production)

Add these environment variables in Vercel Dashboard:
1. Go to your project settings
2. Navigate to "Environment Variables"
3. Add:
   - `VITE_VAPID_PUBLIC_KEY` - Your public VAPID key
   - `VAPID_PRIVATE_KEY` - Your private VAPID key  
   - `VAPID_SUBJECT` - mailto:your-email@example.com or https://your-domain.com

#### Supabase Edge Functions

Set secrets for the Edge Function:
```bash
supabase secrets set VAPID_PUBLIC_KEY=your_public_key_here
supabase secrets set VAPID_PRIVATE_KEY=your_private_key_here
supabase secrets set VAPID_SUBJECT=mailto:your-email@example.com
```

### 3. Run Database Migration

Execute the migration to create the required tables and triggers:

1. Go to Supabase Dashboard
2. Navigate to SQL Editor
3. Open and run `migrations/007_push_notifications.sql`

This creates:
- `push_subscriptions` table - stores device subscriptions
- `notifications` table - stores notification history
- Database triggers on `todo_items`, `meals`, `expenses`

### 4. Enable pg_net Extension

The database trigger uses `pg_net` to make HTTP requests:

1. Go to Supabase Dashboard
2. Navigate to Database → Extensions
3. Search for "pg_net"
4. Enable it

### 5. Deploy Edge Function

Deploy the notification sender Edge Function:

```bash
# Login to Supabase CLI
supabase login

# Link your project
supabase link --project-ref your-project-ref

# Deploy the function
supabase functions deploy send-notification
```

### 6. Update Database Trigger URL

After deploying, update the trigger function with your actual Supabase URL:

```sql
-- In Supabase SQL Editor, update the trigger function
CREATE OR REPLACE FUNCTION notify_household_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR_SUPABASE_ANON_KEY'
    ),
    body := jsonb_build_object(
      'table', TG_TABLE_NAME,
      'record', row_to_json(NEW),
      'household_id', NEW.household_id::text,
      'created_by_user_id', NULL
    )
  );
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to send notification: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## Testing

### 1. Enable Notifications in App

1. Open Helpy app
2. Go to Profile → Account Settings
3. Toggle "Enable Notifications" ON
4. Accept the browser permission prompt

### 2. Test Notification

From another account in the same household:
1. Add an item to Shopping List
2. The first user should receive a notification

### 3. Debug

Check browser console for:
- `[Push] Service worker registered`
- `[Push] Subscription saved to database`

Check Supabase logs for:
- Edge Function invocations
- Any errors in the trigger

## Browser Support

| Browser | Support |
|---------|---------|
| Chrome (Android) | ✅ Full support |
| Safari (iOS 16.4+) | ✅ Full support |
| Firefox | ✅ Full support |
| Edge | ✅ Full support |
| Safari (macOS) | ✅ Full support |
| Chrome (iOS) | ❌ Not supported (uses Safari engine) |

Note: iOS users must add the app to their home screen (as a PWA) for notifications to work.

## Troubleshooting

### Notifications not appearing

1. Check browser notification permissions
2. Verify VAPID keys are correct
3. Check if user has `notifications_enabled = true` in database
4. Verify push subscription exists in `push_subscriptions` table

### Permission denied

User needs to:
1. Go to browser settings
2. Find site permissions
3. Allow notifications for the Helpy domain

### Edge Function errors

Check Supabase Dashboard → Edge Functions → Logs for detailed error messages.

### Database trigger not firing

1. Verify pg_net extension is enabled
2. Check trigger exists: 
   ```sql
   SELECT * FROM pg_trigger WHERE tgname LIKE '%notify%';
   ```

## Security Considerations

1. **Private Key**: Never expose `VAPID_PRIVATE_KEY` in frontend code
2. **RLS**: Push subscriptions are protected by Row Level Security
3. **Validation**: Edge function validates household membership before sending

## Notification Message Format

| Type | Title | Body |
|------|-------|------|
| Shopping | "Shopping List Updated" | "{User} added "{item}" to the Shopping List" |
| Task | "New Task Added" | "{User} added a task: "{task}"" |
| Meal | "Meal Plan Updated" | "{User} added {type}: "{description}"" |
| Expense | "New Expense Added" | "{User} added an expense: {merchant} (${amount})" |

