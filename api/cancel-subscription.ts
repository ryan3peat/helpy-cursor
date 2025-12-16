// api/cancel-subscription.ts
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-11-17.clover',
});

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { householdId } = req.body;

  if (!householdId) {
    return res.status(400).json({ error: 'Missing householdId' });
  }

  try {
    const { data: household, error: householdError } = await supabase
      .from('households')
      .select('stripe_subscription_id')
      .eq('id', householdId)
      .single();

    if (householdError) {
      console.error('Error fetching household for cancel:', householdError);
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
          console.error('Stripe cancel error:', stripeError);
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
      })
      .eq('id', householdId);

    if (updateError) {
      console.error('Error downgrading household to free:', updateError);
      return res.status(500).json({ error: 'Failed to downgrade subscription' });
    }

    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('cancel-subscription error:', error);
    return res.status(500).json({ error: error.message || 'Server error' });
  }
}




