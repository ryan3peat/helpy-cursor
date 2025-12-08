# Deploy Edge Function Without Linking

Since linking is causing config issues, you can deploy directly without linking:

## Option 1: Deploy Directly (No Link Needed)

```bash
# Login first
npx supabase login

# Deploy directly with project ref
npx supabase functions deploy send-notification --project-ref rnnqusevbnxnxmhlajlr
```

This skips the linking step entirely and deploys directly to your project.

---

## Option 2: Use Dashboard (Easiest - No CLI) ✅ Recommended

Since CLI is causing issues, use the Dashboard instead:

### Step 1: Deploy Function

1. Go to **Supabase Dashboard** → **Edge Functions**
2. Click **"Create a new function"** or **"New Function"**
3. Name it: `send-notification`
4. Open `supabase/functions/send-notification/index.ts` in your editor
5. Copy the entire file contents
6. Paste into the Dashboard code editor
7. Click **"Deploy"**

### Step 2: Set Secrets

1. Go to **Edge Functions** → **send-notification**
2. Click **"Settings"** tab
3. Scroll to **"Secrets"** section
4. Add each secret (click "Add secret" for each):

   **Required Secrets:**
   - `SUPABASE_URL` = `https://rnnqusevbnxnxmhlajlr.supabase.co`
   - `SUPABASE_SERVICE_ROLE_KEY` = (get from Dashboard → Settings → API → service_role key)
   - `VAPID_PUBLIC_KEY` = (generate with `npx web-push generate-vapid-keys`)
   - `VAPID_PRIVATE_KEY` = (from same command)
   - `VAPID_SUBJECT` = `mailto:your-email@example.com`

### Step 3: Generate VAPID Keys

Run this in terminal:
```bash
npx web-push generate-vapid-keys
```

Copy the Public Key and Private Key to use in secrets above.

---

## Why Dashboard is Better

- ✅ No CLI installation needed
- ✅ No config file issues
- ✅ Visual interface
- ✅ Easy to update secrets
- ✅ Can see logs directly in Dashboard

---

## After Deployment

1. Verify function exists: Dashboard → Edge Functions → see `send-notification`
2. Test by creating an item in your app
3. Check logs: Dashboard → Edge Functions → send-notification → Logs
