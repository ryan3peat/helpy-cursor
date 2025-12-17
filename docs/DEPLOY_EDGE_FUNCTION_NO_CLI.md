# Deploy Edge Function Without CLI

Since Supabase CLI global npm install isn't supported, here are alternative methods:

## Option 1: Use npx (No Installation Required) ✅ Recommended

You can use `npx` to run Supabase CLI without installing it globally:

```bash
# Login (will open browser)
npx supabase login

# Link project
npx supabase link --project-ref rnnqusevbnxnxmhlajlr

# Deploy function
npx supabase functions deploy send-notification
```

**Note:** Each command will download the CLI temporarily, but it works without installation.

---

## Option 2: Install via Scoop (Windows Package Manager)

If you have Scoop installed:

```powershell
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

If you don't have Scoop, install it first:
```powershell
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
Invoke-RestMethod -Uri https://get.scoop.sh | Invoke-Expression
```

Then install Supabase:
```powershell
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

---

## Option 3: Install via PowerShell Script

Run this in PowerShell:

```powershell
irm https://supabase.com/install.ps1 | iex
```

Then verify:
```powershell
supabase --version
```

---

## Option 4: Use Supabase Dashboard (No CLI Needed) ✅ Easiest

You can deploy and configure the edge function entirely through the Dashboard:

### Deploy Function via Dashboard:

1. **Go to Supabase Dashboard** → **Edge Functions**
2. Click **"Create a new function"** or **"New Function"**
3. Name it: `send-notification`
4. Copy the contents from `supabase/functions/send-notification/index.ts`
5. Paste into the code editor
6. Click **"Deploy"**

### Set Secrets via Dashboard:

1. Go to **Edge Functions** → **send-notification**
2. Click **"Settings"** tab
3. Scroll to **"Secrets"** section
4. Add each secret:
   - Click **"Add secret"**
   - Enter name: `SUPABASE_URL`
   - Enter value: `https://rnnqusevbnxnxmhlajlr.supabase.co`
   - Click **"Save"**
   - Repeat for:
     - `SUPABASE_SERVICE_ROLE_KEY` (get from Settings → API)
     - `VAPID_PUBLIC_KEY` (from `npx web-push generate-vapid-keys`)
     - `VAPID_PRIVATE_KEY` (from `npx web-push generate-vapid-keys`)
     - `VAPID_SUBJECT` (e.g., `mailto:your-email@example.com`)

### Generate VAPID Keys:

Run this in your terminal (no installation needed):
```bash
npx web-push generate-vapid-keys
```

Copy the Public Key and Private Key to use in the secrets above.

---

## Recommended Approach

**For quickest setup, use Option 4 (Dashboard)** - it's the easiest and doesn't require any CLI installation.

**For automation/CI, use Option 1 (npx)** - works without installation and can be scripted.







