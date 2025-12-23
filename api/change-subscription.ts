// api/change-subscription.ts
// Handles upgrading/downgrading between paid plans (Core <-> Pro)
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-11-17.clover',
});

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PRICE_IDS: Record<string, string> = {
  core_monthly: process.env.STRIPE_CORE_MONTHLY_PRICE_ID!,
  core_yearly: process.env.STRIPE_CORE_YEARLY_PRICE_ID!,
  pro_monthly: process.env.STRIPE_PRO_MONTHLY_PRICE_ID!,
  pro_yearly: process.env.STRIPE_PRO_YEARLY_PRICE_ID!,
};

const PLAN_LIMITS = {
  free: { maxFamily: 3, maxHelpers: 1 },
  core: { maxFamily: 4, maxHelpers: 1 },
  pro: { maxFamily: 8, maxHelpers: 4 },
};

function priceIdToPlan(priceId?: string | null): 'core' | 'pro' | null {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_CORE_MONTHLY_PRICE_ID || priceId === process.env.STRIPE_CORE_YEARLY_PRICE_ID) return 'core';
  if (priceId === process.env.STRIPE_PRO_MONTHLY_PRICE_ID || priceId === process.env.STRIPE_PRO_YEARLY_PRICE_ID) return 'pro';
  return null;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { householdId, newPlan, newPeriod, requesterId } = req.body;
    // newPlan: 'core' | 'pro'
    // newPeriod: 'monthly' | 'yearly'

    if (!householdId || !newPlan || !newPeriod) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // Verify requester is Admin or SuperAdmin
    if (requesterId) {
      const { data: requester } = await supabase
        .from('users')
        .select('id, household_id, role, clerk_id')
        .or(`clerk_id.eq.${requesterId},id.eq.${requesterId}`)
        .eq('household_id', householdId)
        .maybeSingle();

      if (!requester) {
        return res.status(403).json({ error: 'Requester not found' });
      }

      if (requester.role !== 'Admin' && requester.role !== 'SuperAdmin') {
        return res.status(403).json({ error: 'Only admins can change subscription plans' });
      }
    }

    const priceKey = `${newPlan}_${newPeriod}`;
    const newPriceId = PRICE_IDS[priceKey];

    if (!newPriceId) {
      return res.status(400).json({ error: 'Invalid plan or period' });
    }

    // Get household and subscription info
    const { data: household, error: householdError } = await supabase
      .from('households')
      .select('stripe_customer_id, stripe_subscription_id, subscription_status, subscription_plan')
      .eq('id', householdId)
      .single();

    if (householdError || !household) {
      return res.status(404).json({ error: 'Household not found' });
    }

    if (!household.stripe_subscription_id) {
      return res.status(400).json({ error: 'No active subscription found. Please subscribe first.' });
    }

    // Get current subscription from Stripe
    let subscription: Stripe.Subscription;
    try {
      subscription = await stripe.subscriptions.retrieve(household.stripe_subscription_id);
    } catch (error: any) {
      if (error.code === 'resource_missing') {
        return res.status(400).json({ error: 'Subscription not found. Please subscribe first.' });
      }
      throw error;
    }

    if (subscription.status !== 'active' && subscription.status !== 'trialing') {
      return res.status(400).json({ error: 'Subscription is not active. Please subscribe first.' });
    }

    // Get the current subscription item
    const subscriptionItemId = subscription.items.data[0]?.id;
    if (!subscriptionItemId) {
      return res.status(400).json({ error: 'Invalid subscription structure' });
    }

    // Check if already on this plan
    const currentPriceId = subscription.items.data[0]?.price?.id;
    const currentPlan = priceIdToPlan(currentPriceId);
    
    if (currentPlan === newPlan) {
      // Same plan, might be changing period
      const currentInterval = subscription.items.data[0]?.price?.recurring?.interval;
      const newInterval = newPeriod === 'yearly' ? 'year' : 'month';
      
      if (currentInterval === newInterval) {
        return res.status(400).json({ error: 'You are already on this plan and billing period' });
      }
    }

    // Update the subscription with the new price
    // Using proration_behavior: 'create_prorations' to charge/credit the difference
    const updatedSubscription = await stripe.subscriptions.update(
      household.stripe_subscription_id,
      {
        items: [
          {
            id: subscriptionItemId,
            price: newPriceId,
          },
        ],
        proration_behavior: 'create_prorations', // Prorates the change
        metadata: {
          household_id: householdId,
          previous_plan: currentPlan || 'unknown',
          new_plan: newPlan,
        },
      }
    );

    // Update database with new plan info
    const limits = PLAN_LIMITS[newPlan as keyof typeof PLAN_LIMITS];
    const periodEnd = updatedSubscription.current_period_end 
      ? new Date(updatedSubscription.current_period_end * 1000).toISOString() 
      : null;

    const { error: updateError } = await supabase
      .from('households')
      .update({
        subscription_plan: newPlan,
        subscription_status: updatedSubscription.status,
        subscription_period: newPeriod,
        ...(periodEnd && { subscription_current_period_end: periodEnd }),
        max_family_members: limits.maxFamily,
        max_helpers: limits.maxHelpers,
      })
      .eq('id', householdId);

    if (updateError) {
      console.error('Database update error:', updateError);
      // Continue anyway - Stripe is the source of truth
    }

    return res.status(200).json({
      success: true,
      plan: newPlan,
      status: updatedSubscription.status,
      message: currentPlan && newPlan !== currentPlan 
        ? `Successfully changed from ${currentPlan.toUpperCase()} to ${newPlan.toUpperCase()}`
        : 'Subscription updated successfully',
    });
  } catch (error: any) {
    console.error('Change subscription error:', error);
    return res.status(500).json({ error: error.message || 'Failed to change subscription' });
  }
}


