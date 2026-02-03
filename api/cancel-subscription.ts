// api/cancel-subscription.ts
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

// Inline logger to avoid module resolution issues in Vercel serverless
const isDev = process.env.NODE_ENV !== 'production';
const logger = {
  log: (...args: unknown[]) => isDev && console.log(...args),
  error: (...args: unknown[]) => console.error(...args),
};

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-11-17.clover',
});

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// CORS: Only allow helpyfam.com, localhost, and Vercel previews
const ALLOWED_ORIGINS = ['https://app.helpyfam.com', 'https://www.helpyfam.com'];
function setCorsHeaders(req: any, res: any) {
  const origin = req.headers.origin as string | undefined;
  if (origin && (ALLOWED_ORIGINS.includes(origin) || origin.startsWith('http://localhost:') || origin.startsWith('https://localhost') || origin.endsWith('.vercel.app'))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
}

export default async function handler(req: any, res: any) {
  setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { householdId, requesterId } = req.body;

  if (!householdId) {
    return res.status(400).json({ error: 'Missing householdId' });
  }

  try {
    // Verify requester is Admin or SuperAdmin
    if (requesterId) {
      const { data: requester } = await supabase
        .from('users')
        .select('id, household_id, role, clerk_id')
        .eq('clerk_id', requesterId)
        .eq('household_id', householdId)
        .maybeSingle();

      if (!requester) {
        return res.status(403).json({ error: 'Requester not found' });
      }

      if (requester.role !== 'Admin' && requester.role !== 'SuperAdmin') {
        return res.status(403).json({ error: 'Only admins can cancel subscriptions' });
      }
    }
    const { data: household, error: householdError } = await supabase
      .from('households')
      .select('stripe_subscription_id')
      .eq('id', householdId)
      .single();

    if (householdError) {
      logger.error('Error fetching household for cancel:', householdError);
      return res.status(500).json({ error: 'Unable to fetch household' });
    }

    // If there is an active Stripe subscription, cancel it immediately
    if (household?.stripe_subscription_id) {
      try {
        await stripe.subscriptions.cancel(household.stripe_subscription_id, {
          invoice_now: false,
          prorate: false,
        });
      } catch (stripeError: any) {
        // If the subscription is already canceled or missing, continue to downgrade locally
        if (stripeError?.code !== 'resource_missing') {
          logger.error('Stripe cancel error:', stripeError);
          return res.status(500).json({ error: stripeError.message || 'Failed to cancel Stripe subscription' });
        }
      }
    }

    // Immediately set household to free plan
    const { error: updateError } = await supabase
      .from('households')
      .update({
        subscription_status: 'canceled',
        subscription_plan: 'free',
        subscription_period: null,
        subscription_current_period_end: null,
        stripe_subscription_id: null,
        max_family_members: 3,
        max_helpers: 1,
        cancel_at_period_end: false, // Not pending, it's done
        is_trial: false,
        trial_ends_at: null,
      })
      .eq('id', householdId);

    if (updateError) {
      logger.error('Error downgrading household to free:', updateError);
      return res.status(500).json({ error: 'Failed to downgrade subscription' });
    }

    return res.status(200).json({ success: true });
  } catch (error: any) {
    logger.error('cancel-subscription error:', error);
    return res.status(500).json({ error: error.message || 'Server error' });
  }
}






