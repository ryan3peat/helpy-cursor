# Configure Supabase to Accept Clerk JWTs

## Problem
Error: `PGRST301: No suitable key or wrong key type`

This means Supabase can't verify the Clerk JWT token because it doesn't have Clerk's public key.

## Solution: Configure Clerk as Third-Party Auth in Supabase

### Step 1: Get Your Clerk Domain

1. Go to **Clerk Dashboard** → **Settings** → **Domains**
2. Note your Clerk domain (e.g., `helpyfam.com` or `informed-guppy-42.clerk.accounts.dev`)

### Step 2: Add Clerk to Supabase

1. Go to **Supabase Dashboard** → **Authentication** → **Providers**
2. Scroll down to **Third Party Auth** section
3. Click **"Add Provider"** or look for **"Clerk"** option
4. If Clerk is not listed:
   - Go to **Authentication** → **URL Configuration**
   - Or check **Settings** → **Auth** → **External Providers**

### Step 3: Alternative - Configure JWT Settings

If Supabase doesn't have native Clerk integration, you need to configure JWT verification:

1. **Get Clerk's JWKS URL:**
   - Your Clerk JWKS endpoint: `https://[your-clerk-domain]/.well-known/jwks.json`
   - Example: `https://informed-guppy-42.clerk.accounts.dev/.well-known/jwks.json`

2. **Configure Supabase JWT:**
   - Go to **Supabase Dashboard** → **Settings** → **API**
   - Look for **JWT Settings** or **JWT Secret**
   - This is complex and may require custom configuration

### Step 4: Recommended - Use Supabase's Clerk Integration

The easiest way is to use Supabase's built-in Clerk integration:

1. **In Supabase Dashboard:**
   - Go to **Authentication** → **Providers**
   - Find **"Clerk"** in the list
   - Enable it
   - Enter your Clerk domain

2. **Verify Integration:**
   - Supabase will automatically fetch Clerk's public keys
   - JWTs will be verified automatically

## Alternative Solution: Use Service Role for Push Subscriptions

If configuring Clerk JWT verification is too complex, we can temporarily use service role for push subscriptions (bypasses RLS) until we get JWT verification working.

## Check Current Status

1. Go to **Supabase Dashboard** → **Authentication** → **Providers**
2. Check if Clerk is listed and enabled
3. If not, follow Step 2 above

## Testing

After configuration:
1. Sign out and sign back in
2. Check browser console - should not see PGRST301 error
3. Push subscriptions should save successfully
