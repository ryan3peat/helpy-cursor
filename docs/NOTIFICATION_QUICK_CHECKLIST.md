# Notification Setup Quick Checklist

## ✅ Step 1: Deploy Edge Function

```bash
# Install Supabase CLI (if needed)
npm install -g supabase

# Login
supabase login

# Link project
supabase link --project-ref rnnqusevbnxnxmhlajlr

# Deploy function
supabase functions deploy send-notification
```

**Verify:** Go to Supabase Dashboard → Edge Functions → see `send-notification` listed

---

## ✅ Step 2: Generate VAPID Keys

```bash
npx web-push generate-vapid-keys
```

**Save both keys** - you'll need them in the next steps.

---

## ✅ Step 3: Set Edge Function Secrets

### Using CLI:
```bash
supabase secrets set SUPABASE_URL=https://rnnqusevbnxnxmhlajlr.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
supabase secrets set VAPID_PUBLIC_KEY=your_public_key
supabase secrets set VAPID_PRIVATE_KEY=your_private_key
supabase secrets set VAPID_SUBJECT=mailto:your-email@example.com
```

### Or using Dashboard:
1. Supabase Dashboard → Edge Functions → `send-notification` → Settings → Secrets
2. Add each secret one by one

**Get Service Role Key:** Dashboard → Settings → API → service_role key

---

## ✅ Step 4: Set Frontend VAPID Key

### Local (.env file):
```env
VITE_VAPID_PUBLIC_KEY=your_public_key_here
```

### Production (Vercel):
1. Vercel Dashboard → Project → Settings → Environment Variables
2. Add `VITE_VAPID_PUBLIC_KEY` = your public key
3. Redeploy

---

## ✅ Step 5: Test with Users

1. **User A** (Creator):
   - Profile → Account Settings → Enable Notifications
   - Allow browser permission
   - Verify: `SELECT * FROM push_subscriptions WHERE user_id = 'user-a-id';`

2. **User B** (Recipient):
   - Profile → Account Settings → Enable Notifications
   - Allow browser permission
   - Verify: `SELECT * FROM push_subscriptions WHERE user_id = 'user-b-id';`

3. **Test:**
   - As User A, create a new todo item or meal
   - Check Edge Function logs: Dashboard → Edge Functions → send-notification → Logs
   - User B should receive notification

---

## 🔍 Quick Verification Queries

```sql
-- Check users with notifications enabled
SELECT name, notifications_enabled, 
       (SELECT COUNT(*) FROM push_subscriptions WHERE user_id = users.id) as subscriptions
FROM users;

-- Check recent notifications
SELECT * FROM notifications ORDER BY created_at DESC LIMIT 5;

-- Check if items have created_by set
SELECT COUNT(*) as total, 
       COUNT(created_by) as with_creator 
FROM todo_items;
```

---

## 🐛 Common Issues

| Problem | Fix |
|---------|-----|
| Edge function not found | Deploy it: `supabase functions deploy send-notification` |
| VAPID keys missing | Set secrets in edge function settings |
| No subscriptions | User needs to enable notifications in app + grant browser permission |
| Creator gets notification | Check `created_by` is set (frontend passes `createdBy`) |
| Edge function errors | Check logs in Dashboard → Edge Functions → send-notification → Logs |

---

## 📞 Need Help?

1. Run verification: `migrations/009_verify_notifications.sql`
2. Check edge function logs
3. See full guide: `docs/NOTIFICATION_DEPLOYMENT_GUIDE.md`






