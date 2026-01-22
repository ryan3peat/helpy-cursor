// api/sync-subscription.ts
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

const PLAN_LIMITS = {
  free: { maxFamily: 3, maxHelpers: 1 },
  core: { maxFamily: 4, maxHelpers: 1 },
  pro: { maxFamily: 8, maxHelpers: 4 },
  test: { maxFamily: 4, maxHelpers: 1 },
};

function priceIdToPlan(priceId?: string | null): 'core' | 'pro' | 'test' | null {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_CORE_MONTHLY_PRICE_ID || priceId === process.env.STRIPE_CORE_YEARLY_PRICE_ID) return 'core';
  if (priceId === process.env.STRIPE_PRO_MONTHLY_PRICE_ID || priceId === process.env.STRIPE_PRO_YEARLY_PRICE_ID) return 'pro';
  if (priceId === process.env.STRIPE_TEST_PRICE_ID) return 'test';
  return null;
}

// CORS: Only allow helpyfam.com, localhost, and Vercel previews
const ALLOWED_ORIGINS = ['https://app.helpyfam.com', 'https://www.helpyfam.com'];
function setCorsHeaders(req: any, res: any) {
  const origin = req.headers.origin as string | undefined;
  if (origin && (ALLOWED_ORIGINS.includes(origin) || origin.startsWith('http://localhost:') || origin.endsWith('.vercel.app'))) {
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

  const { householdId, sessionId } = req.body;

  if (!householdId) {
    return res.status(400).json({ error: 'Missing householdId' });
  }

  try {
    let subscriptionId: string | null = null;
    let plan: 'core' | 'pro' | 'test' | null = null;
    let period: 'monthly' | 'yearly' | null = null;
    let periodEnd: number | null = null;
    let stripeCustomerId: string | null = null;
    let status: string | null = null;
    let trialEnd: number | null = null;
    let cancelAtPeriodEnd: boolean = false;

    if (sessionId) {
      try {
        const session = await stripe.checkout.sessions.retrieve(sessionId, {
          expand: ['subscription', 'subscription.items.data.price'],
        });
        stripeCustomerId = typeof session.customer === 'string' ? session.customer : session.customer?.id || null;
        if (session.subscription && typeof session.subscription !== 'string') {
          const sub = session.subscription as Stripe.Subscription;
          subscriptionId = sub.id;
          status = sub.status;
          periodEnd = sub.current_period_end || null;
          trialEnd = sub.trial_end || null;
          cancelAtPeriodEnd = sub.cancel_at_period_end || false;
          const priceId = sub.items?.data?.[0]?.price?.id;
          plan = priceIdToPlan(priceId);
          const interval = sub.items?.data?.[0]?.price?.recurring?.interval;
          period = interval === 'year' ? 'yearly' : 'monthly';
        }
      } catch (err) {
        logger.error('sync-subscription: error retrieving session', err);
      }
    }

    // If still missing, try by household's existing subscription id
    if (!subscriptionId) {
      const { data: household } = await supabase
        .from('households')
        .select('stripe_subscription_id, stripe_customer_id')
        .eq('id', householdId)
        .single();

      stripeCustomerId = household?.stripe_customer_id || stripeCustomerId;
      if (household?.stripe_subscription_id) {
        logger.log('[sync-subscription] Retrieving subscription from Stripe:', household.stripe_subscription_id);
        let sub: Stripe.Subscription;
        try {
          sub = await stripe.subscriptions.retrieve(household.stripe_subscription_id);
          logger.log('[sync-subscription] Raw Stripe subscription data:', {
            id: sub.id,
            status: sub.status,
            cancel_at_period_end: sub.cancel_at_period_end,
            cancel_at: sub.cancel_at,
            canceled_at: sub.canceled_at,
            trial_end: sub.trial_end,
            current_period_end: sub.current_period_end,
            current_period_start: sub.current_period_start,
          });
          
          subscriptionId = sub.id;
          status = sub.status;
          periodEnd = sub.current_period_end || null;
          trialEnd = sub.trial_end || null;
          cancelAtPeriodEnd = sub.cancel_at_period_end === true; // Explicit boolean check
          const priceId = sub.items?.data?.[0]?.price?.id;
          plan = priceIdToPlan(priceId);
          const interval = sub.items?.data?.[0]?.price?.recurring?.interval;
          period = interval === 'year' ? 'yearly' : 'monthly';
          logger.log('[sync-subscription] Parsed values:', { plan, status, cancelAtPeriodEnd, periodEnd, trialEnd });
        } catch (stripeError: any) {
          logger.error('[sync-subscription] Error retrieving subscription from Stripe:', stripeError.message);
          logger.log('[sync-subscription] This might mean the subscription ID is invalid or the subscription was deleted');
          // Continue without updating subscription data
          return res.status(200).json({ success: false, error: 'Subscription not found in Stripe' });
        }
      }
    }

    if (!plan || !subscriptionId) {
      return res.status(404).json({ error: 'Unable to determine subscription status' });
    }

    const limits = PLAN_LIMITS[plan];
    const periodEndISO = periodEnd ? new Date(periodEnd * 1000).toISOString() : null;
    const trialEndISO = trialEnd ? new Date(trialEnd * 1000).toISOString() : null;
    const isTrial = status === 'trialing' && !!trialEnd;

    logger.log('[sync-subscription] Updating database with:', {
      householdId,
      plan,
      status,
      cancelAtPeriodEnd,
      isTrial,
      periodEndISO,
    });

    const { error: updateError } = await supabase
      .from('households')
      .update({
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: subscriptionId,
        subscription_status: status || 'active',
        subscription_plan: plan,
        subscription_period: period || 'monthly',
        ...(periodEndISO && { subscription_current_period_end: periodEndISO }),
        max_family_members: limits.maxFamily,
        max_helpers: limits.maxHelpers,
        is_trial: isTrial,
        ...(trialEndISO && { trial_ends_at: trialEndISO }),
        cancel_at_period_end: cancelAtPeriodEnd,
      })
      .eq('id', householdId);

    if (updateError) {
      logger.error('sync-subscription update error:', updateError);
      return res.status(500).json({ error: 'Failed to update subscription' });
    }

    return res.status(200).json({ success: true, plan, status, cancelAtPeriodEnd });
  } catch (error: any) {
    logger.error('sync-subscription error:', error);
    return res.status(500).json({ error: error.message || 'Server error' });
  }
}

