# Stripe Webhook Setup Guide

## Problem
Webhook events from Stripe are not reaching your Vercel endpoint. You see events in Stripe Dashboard but NO logs in Vercel for `/api/stripe-webhook`.

## Root Cause
The webhook endpoint is not configured in Stripe Dashboard, so Stripe doesn't know where to send events.

## Solution: Configure Webhook in Stripe Dashboard

### Step 1: Access Stripe Webhook Settings
1. Go to: https://dashboard.stripe.com/webhooks
2. Click **"Add endpoint"** or **"Add webhook endpoint"**

### Step 2: Configure Webhook Endpoint
1. **Endpoint URL**: `https://www.helpyfam.com/api/stripe-webhook`
   - ⚠️ Must use `https://` (not `http://`)
   - ⚠️ Must use `www.helpyfam.com` (match your production domain)
   - ⚠️ Path must be exactly `/api/stripe-webhook`

2. **Description**: "Helpy Subscription Webhook" (optional)

3. **Events to send**: Select these events:
   - ✅ `checkout.session.completed`
   - ✅ `customer.subscription.created`
   - ✅ `customer.subscription.updated`
   - ✅ `customer.subscription.deleted`
   - ✅ `invoice.paid`
   - ✅ `invoice.payment_failed`
   - ✅ `invoice.finalization_failed`
   - ✅ `customer.subscription.trial_will_end`

   Or select **"Send all events"** (recommended for testing)

### Step 3: Get Webhook Signing Secret
1. After creating the webhook, click on it
2. Find **"Signing secret"** section
3. Click **"Reveal"** or **"Click to reveal"**
4. Copy the secret (starts with `whsec_...`)

### Step 4: Add Secret to Vercel Environment Variables
1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add new variable:
   - **Name**: `STRIPE_WEBHOOK_SECRET`
   - **Value**: The signing secret from Step 3 (starts with `whsec_...`)
   - **Environment**: Production (and Preview if needed)
3. **Redeploy** your application after adding the variable

### Step 5: Test the Webhook
1. **Test endpoint accessibility**:
   ```bash
   curl https://www.helpyfam.com/api/stripe-webhook
   ```
   Should return: `{"status":"ok","message":"Stripe webhook endpoint is accessible",...}`

2. **Trigger a test event**:
   - In Stripe Dashboard → Webhooks → Your endpoint
   - Click **"Send test webhook"**
   - Select `checkout.session.completed`
   - Click **"Send test webhook"**

3. **Check Vercel logs**:
   - Go to Vercel Dashboard → Your Project → Functions → `stripe-webhook`
   - You should now see logs like:
     ```
     🚀 ===== STRIPE WEBHOOK HANDLER CALLED =====
     📥 Raw request received: ...
     ✅ checkout.session.completed event received
     ```

## Verification Checklist

- [ ] Webhook endpoint created in Stripe Dashboard
- [ ] Endpoint URL is: `https://www.helpyfam.com/api/stripe-webhook`
- [ ] Events are selected (at minimum: `checkout.session.completed`)
- [ ] Webhook signing secret copied from Stripe
- [ ] `STRIPE_WEBHOOK_SECRET` added to Vercel environment variables
- [ ] Application redeployed after adding environment variable
- [ ] Test webhook sent from Stripe Dashboard
- [ ] Logs appear in Vercel Functions

## Troubleshooting

### No logs in Vercel after configuring webhook
1. **Check webhook URL**: Must be exactly `https://www.helpyfam.com/api/stripe-webhook`
2. **Check environment variable**: `STRIPE_WEBHOOK_SECRET` must be set in Vercel
3. **Check webhook status**: In Stripe Dashboard, check if webhook shows "Enabled" status
4. **Check webhook logs**: In Stripe Dashboard → Webhooks → Your endpoint → "Recent events", check if requests are being sent and what response codes they're getting

### Webhook returns 400 errors
- Check that `STRIPE_WEBHOOK_SECRET` matches the signing secret from Stripe Dashboard
- Ensure the secret starts with `whsec_`
- Redeploy after updating the environment variable

### Webhook returns 500 errors
- Check Vercel function logs for detailed error messages
- Verify Supabase connection and credentials
- Check RLS policies on `households` table

## Important Notes

- **Webhook secret is different from API keys**: The webhook signing secret (`whsec_...`) is different from your Stripe secret key (`sk_...`)
- **Each webhook endpoint has its own secret**: If you have multiple webhooks (dev, staging, prod), each has a unique secret
- **Secrets are environment-specific**: Use different secrets for test mode vs live mode webhooks
- **Webhooks are async**: Events may arrive seconds or minutes after the action occurs
