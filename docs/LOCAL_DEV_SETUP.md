# Local Development Setup for Notifications

## Running Supabase Locally

If you're running Supabase locally (`supabase start`), you need to:

### 1. Get Your Local Anon Key

Run this command:
```bash
supabase status
```

Look for the `anon key` in the output, or check your `.env` file in the `supabase/.env` directory.

### 2. Update Trigger Function for Local

Run the local migration:
```sql
-- In Supabase local SQL Editor (http://localhost:54323)
-- Or via: supabase db reset (if you want to reset)
```

1. Open `migrations/015_fix_trigger_url_local.sql`
2. Replace `YOUR_LOCAL_ANON_KEY` with your local anon key
3. Run it in your local Supabase SQL Editor

### 3. Deploy Edge Function Locally

If you're running Supabase locally, you need to deploy the edge function locally:

```bash
# Make sure you're in the project root
supabase functions serve send-notification --env-file supabase/.env.local
```

Or if you've linked your local project:
```bash
supabase functions deploy send-notification --local
```

### 4. Set Local Edge Function Secrets

For local development, set secrets in your local Supabase:

```bash
# Set secrets for local edge function
supabase secrets set VAPID_PUBLIC_KEY=your_public_key --local
supabase secrets set VAPID_PRIVATE_KEY=your_private_key --local
supabase secrets set VAPID_SUBJECT=mailto:your-email@example.com --local
supabase secrets set SUPABASE_URL=http://localhost:9999 --local
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_local_service_role_key --local
```

Get the service role key from: `supabase status`

### 5. Update Frontend .env

Make sure your frontend `.env` has:
```env
VITE_SUPABASE_URL=http://localhost:54321
VITE_VAPID_PUBLIC_KEY=your_public_key
```

Note: Local Supabase API runs on port 54321, not 9999 (9999 is for functions)

## Switching Between Local and Production

### For Local Development:
- Use `migrations/015_fix_trigger_url_local.sql` (localhost:9999)
- Deploy edge function locally
- Use local Supabase URL in frontend

### For Production:
- Use `migrations/010_fix_trigger_url.sql` (production URL)
- Deploy edge function to production
- Use production Supabase URL in frontend

## Quick Check

Verify your setup:
```sql
-- Check trigger function URL
SELECT pg_get_functiondef(oid) 
FROM pg_proc 
WHERE proname = 'notify_household_on_insert';
```

Should show `http://localhost:9999` for local dev.








