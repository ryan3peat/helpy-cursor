# Vercel Development Environment Variables Checklist

When running `vercel dev`, Vercel pulls environment variables from your **Vercel Dashboard** (not `.env.local`). You must configure the **Development** environment in Vercel for local testing to work.

## How to Set Development Environment Variables

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your **helpy** project
3. Go to **Settings** → **Environment Variables**
4. For each variable below, click **Add New** and:
   - Enter the variable name
   - Enter the value
   - **IMPORTANT**: Check only the **Development** checkbox (uncheck Production/Preview if you want separate values)

---

## Required Environment Variables

### 1. Clerk Authentication (CRITICAL)

These are needed for user login/signup to work.

| Variable | Environment | Example Value | Notes |
|----------|-------------|---------------|-------|
| `VITE_CLERK_PUBLISHABLE_KEY` | Development | `pk_test_xxxx...` | Your **TEST** publishable key from Clerk Dashboard |
| `CLERK_SECRET_KEY` | Development | `sk_test_xxxx...` | Your **TEST** secret key from Clerk Dashboard |
| `VITE_CLERK_JWT_TEMPLATE_NAME` | Development | `supabase` | Optional - defaults to "supabase" |

**Where to find**: [Clerk Dashboard](https://dashboard.clerk.com) → Your App → **API Keys**

**IMPORTANT**: Use TEST keys (pk_test_, sk_test_) for Development, not production keys (pk_live_, sk_live_)!

---

### 2. Supabase Database (CRITICAL)

These are needed for all data operations (todos, meals, expenses, users).

| Variable | Environment | Example Value | Notes |
|----------|-------------|---------------|-------|
| `VITE_SUPABASE_URL` | Development | `https://xxxxx.supabase.co` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Development | `eyJhbGc...` | Public anon key |
| `SUPABASE_URL` | Development | `https://xxxxx.supabase.co` | Same as VITE_SUPABASE_URL (for API routes) |
| `SUPABASE_SERVICE_ROLE_KEY` | Development | `eyJhbGc...` | Service role key (for API routes) |

**Where to find**: [Supabase Dashboard](https://supabase.com/dashboard) → Your Project → **Settings** → **API**

---

### 3. App URL (CRITICAL for Auth Redirects)

| Variable | Environment | Example Value | Notes |
|----------|-------------|---------------|-------|
| `VITE_APP_URL` | Development | `http://localhost:3000` | Local dev URL |
| `NEXT_PUBLIC_APP_URL` | Development | `http://localhost:3000` | Fallback for some API routes |

---

### 4. Stripe Payments (Required for subscription features)

| Variable | Environment | Example Value | Notes |
|----------|-------------|---------------|-------|
| `STRIPE_SECRET_KEY` | Development | `sk_test_xxxx...` | Your **TEST** secret key |
| `STRIPE_WEBHOOK_SECRET` | Development | `whsec_xxxx...` | From `stripe listen` CLI |
| `STRIPE_CORE_MONTHLY_PRICE_ID` | Development | `price_xxxx...` | Test mode price ID |
| `STRIPE_CORE_YEARLY_PRICE_ID` | Development | `price_xxxx...` | Test mode price ID |
| `STRIPE_PRO_MONTHLY_PRICE_ID` | Development | `price_xxxx...` | Test mode price ID |
| `STRIPE_PRO_YEARLY_PRICE_ID` | Development | `price_xxxx...` | Test mode price ID |
| `STRIPE_TEST_PRICE_ID` | Development | `price_xxxx...` | Special test price ID |

**Where to find**: [Stripe Dashboard](https://dashboard.stripe.com/test/apikeys) (make sure you're in **Test mode**)

**For webhook testing locally**:
```bash
# Install Stripe CLI first, then run:
stripe listen --forward-to localhost:3000/api/stripe-webhook
# This will give you a whsec_xxx key to use as STRIPE_WEBHOOK_SECRET
```

---

### 5. Push Notifications (Optional but recommended)

| Variable | Environment | Example Value | Notes |
|----------|-------------|---------------|-------|
| `VITE_VAPID_PUBLIC_KEY` | Development | `BPxxxx...` | VAPID public key |

**Where to find**: These should already be generated and stored in your Supabase Edge Function secrets. Use the same keys for consistency.

---

### 6. AI/OCR Features (Optional)

| Variable | Environment | Example Value | Notes |
|----------|-------------|---------------|-------|
| `ALIBABA_CLOUD_API_KEY` | Development | `sk-xxxx...` | For receipt OCR |
| `GEMINI_API_KEY` | Development | `AIzaSy...` | For AI translations |

---

## Quick Copy-Paste Template

Here's a template with all variables (fill in your actual values):

```
# === CLERK (use TEST keys!) ===
VITE_CLERK_PUBLISHABLE_KEY=pk_test_YOUR_KEY_HERE
CLERK_SECRET_KEY=sk_test_YOUR_KEY_HERE

# === SUPABASE ===
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY

# === APP URLS ===
VITE_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000

# === STRIPE (use TEST keys!) ===
STRIPE_SECRET_KEY=sk_test_YOUR_KEY
STRIPE_WEBHOOK_SECRET=whsec_YOUR_KEY
STRIPE_CORE_MONTHLY_PRICE_ID=price_xxx
STRIPE_CORE_YEARLY_PRICE_ID=price_xxx
STRIPE_PRO_MONTHLY_PRICE_ID=price_xxx
STRIPE_PRO_YEARLY_PRICE_ID=price_xxx
STRIPE_TEST_PRICE_ID=price_xxx

# === PUSH NOTIFICATIONS ===
VITE_VAPID_PUBLIC_KEY=YOUR_VAPID_PUBLIC_KEY

# === AI/OCR (optional) ===
ALIBABA_CLOUD_API_KEY=sk-xxxx
GEMINI_API_KEY=AIzaSy...
```

---

## Verifying It Works

After setting up all variables in Vercel Dashboard:

1. **Restart `vercel dev`** (stop with Ctrl+C, then run again)

2. **Check browser console** for:
   ```
   🔵 [Clerk] Initializing with key: pk_test_...
   ```
   If you see `pk_live_...` instead, your Development env vars aren't set correctly.

3. **Run this in browser console** after the app loads:
   ```javascript
   // Test Clerk JWT
   window.helpyTestJWT()
   
   // Check env vars
   console.log({
     clerk: import.meta.env.VITE_CLERK_PUBLISHABLE_KEY?.substring(0, 15),
     supabase: import.meta.env.VITE_SUPABASE_URL,
     vapid: import.meta.env.VITE_VAPID_PUBLIC_KEY ? 'SET' : 'MISSING'
   })
   ```

4. **Try adding data** - if it works, you're all set!

---

## Troubleshooting

### "Data not saving" or "Can't add items"

1. Check browser Network tab for failing API calls (401 errors = auth issue)
2. Run `window.helpyTestJWT()` in console - should show "Token received!"
3. Verify `SUPABASE_SERVICE_ROLE_KEY` is set in Vercel Development env

### "Clerk loading timeout" or auth errors

1. Verify `VITE_CLERK_PUBLISHABLE_KEY` is a TEST key
2. Make sure `localhost:3000` and `localhost:3001` are allowed in [Clerk Dashboard](https://dashboard.clerk.com) → **Domains**

### Stripe webhooks not working locally

1. Run `stripe listen --forward-to localhost:3000/api/stripe-webhook`
2. Use the `whsec_xxx` key it provides as `STRIPE_WEBHOOK_SECRET` in Vercel

---

## Production vs Development

| Setting | Production | Development |
|---------|------------|-------------|
| Clerk Keys | `pk_live_`, `sk_live_` | `pk_test_`, `sk_test_` |
| Stripe Keys | `sk_live_` | `sk_test_` |
| App URL | `https://app.helpyfam.com` | `http://localhost:3000` |
| Webhook Secret | From Stripe Dashboard | From `stripe listen` CLI |

**Never use production keys for local development!**

