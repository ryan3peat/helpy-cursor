# Install Supabase CLI for Local Development

## Prerequisites

- Node.js 18+ installed
- Docker Desktop installed and running (Supabase CLI uses Docker)

## Installation Methods

### Option 1: Using npm (Recommended)

```bash
npm install -g supabase
```

**Note:** If you get an error about global install not being supported, use Option 2 or 3.

### Option 2: Using Scoop (Windows)

```powershell
# Install Scoop first (if not installed)
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
Invoke-RestMethod -Uri https://get.scoop.sh | Invoke-Expression

# Install Supabase
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

### Option 3: Using npx (No Installation)

You can use Supabase CLI without installing:

```bash
npx supabase --version
npx supabase login
npx supabase start
```

Just prefix every command with `npx supabase` instead of just `supabase`.

### Option 4: Using PowerShell Installer

```powershell
irm https://supabase.com/install.ps1 | iex
```

---

## Verify Installation

```bash
supabase --version
```

Should show version number.

---

## Initial Setup

### 1. Login to Supabase

```bash
supabase login
```

This opens your browser to authenticate.

### 2. Link Your Project (Optional)

If you want to sync with your hosted project:

```bash
supabase link --project-ref rnnqusevbnxnxmhlajlr
```

### 3. Start Local Supabase

```bash
supabase start
```

This will:
- Start Docker containers
- Set up local database
- Start local API, Studio, and Functions

**First time takes a few minutes** (downloads Docker images).

### 4. Get Local Credentials

```bash
supabase status
```

This shows:
- API URL (usually `http://localhost:54321`)
- Studio URL (usually `http://localhost:54323`)
- Functions URL (usually `http://localhost:9999`)
- Anon key
- Service role key

---

## Using Local Supabase

### Access Local Studio

Open: `http://localhost:54323`

This is your local Supabase Dashboard.

### Run Migrations Locally

```bash
# Reset database and run all migrations
supabase db reset

# Or apply specific migration
supabase db push
```

### Deploy Edge Functions Locally

```bash
# Serve functions locally
supabase functions serve send-notification

# Or deploy to local
supabase functions deploy send-notification --local
```

### Set Secrets for Local Functions

```bash
supabase secrets set VAPID_PUBLIC_KEY=your_key --local
supabase secrets set VAPID_PRIVATE_KEY=your_key --local
supabase secrets set VAPID_SUBJECT=mailto:email@example.com --local
supabase secrets set SUPABASE_URL=http://localhost:54321 --local
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_key --local
```

Get keys from: `supabase status`

---

## Stop Local Supabase

```bash
supabase stop
```

---

## Troubleshooting

### Docker Not Running

Make sure Docker Desktop is installed and running.

### Port Already in Use

If ports are taken, Supabase will try different ports. Check `supabase status` for actual ports.

### Reset Everything

```bash
supabase stop
supabase start
```

---

## Recommendation

**For your use case, you probably DON'T need local Supabase.**

Just use the hosted Supabase at `https://rnnqusevbnxnxmhlajlr.supabase.co`:
- No installation needed
- No Docker required
- Everything works in the cloud
- Use migrations 010 and 013 (not 015)

Only install local Supabase if you specifically want to:
- Test changes offline
- Develop without internet
- Test migrations before deploying



