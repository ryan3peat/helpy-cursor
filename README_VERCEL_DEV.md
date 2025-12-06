# Vercel Dev Environment Variables Setup

## Problem
When running `vercel dev`, Vercel pulls environment variables from your Vercel project settings (which have production keys), overriding `.env.local`.

## Solution: Set Development Environment Variables in Vercel

1. Go to your Vercel Dashboard: https://vercel.com/dashboard
2. Select your project
3. Go to **Settings** → **Environment Variables**
4. Add your **development/test** keys for the **Development** environment:
   - `VITE_CLERK_PUBLISHABLE_KEY` = `pk_test_...` (your test key)
   - `CLERK_SECRET_KEY` = `sk_test_...` (your test key)
   - `STRIPE_SECRET_KEY` = `sk_test_...` (your test key)
   - `STRIPE_WEBHOOK_SECRET` = `whsec_...` (from `stripe listen`)
   - All other Stripe price IDs and Supabase keys

5. Make sure to select **Development** (not Production) when adding each variable
6. Restart `vercel dev`

## Alternative: Use npm run dev for Frontend

If you only need to test the frontend (not API routes):
- Use `npm run dev` - this will use `.env.local` correctly
- Use `vercel dev` only when you need to test API routes like `/api/stripe-webhook`

## Verify It's Working

After setting development env vars in Vercel, restart `vercel dev` and check:
- Console should show: `🔵 [Clerk] Initializing with key: pk_test_...`
- Debug button should show test key, not production key

