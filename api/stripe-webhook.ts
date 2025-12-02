// api/stripe-webhook.ts
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

export const config = { api: { bodyParser: false } };

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-11-17.clover',
});

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PLAN_LIMITS = {
  free: { maxFamily: 4, maxHelpers: 0 },
  core: { maxFamily: 6, maxHelpers: 2 },
  pro: { maxFamily: 10, maxHelpers: 999 },
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).end();
  }

  // Get raw body for Stripe signature verification
  const buf = Buffer.from(await req.text());
  const sig = req.headers.get('stripe-signature');

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      buf,
      sig!,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    console.log(`⚠️ Webhook signature verification failed: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Log all events for audit
  const dataObject = event.data.object as any;
  const householdId = dataObject.metadata?.household_id;
  
  if (householdId) {
    try {
      await supabase.from('subscription_events').insert({
        household_id: householdId,
        stripe_event_id: event.id,
        event_type: event.type,
        data: dataObject,
      });
    } catch (error) {
      console.error('Error logging event:', error);
    }
  }

  // Handle events per Stripe's minimum requirements
  switch (event.type) {
    case 'checkout.session.completed': {
      // Payment successful, subscription created
      const session = event.data.object as Stripe.Checkout.Session;
      const plan = session.metadata?.plan as 'core' | 'pro';
      const period = session.metadata?.period;
      const hid = session.metadata?.household_id;

      if (hid && plan) {
        const limits = PLAN_LIMITS[plan];
        await supabase.from('households').update({
          stripe_customer_id: session.customer as string,
          stripe_subscription_id: session.subscription as string,
          subscription_status: 'active',
          subscription_plan: plan,
          subscription_period: period,
          max_family_members: limits.maxFamily,
          max_helpers: limits.maxHelpers,
        }).eq('id', hid);
      }
      break;
    }

    case 'invoice.paid': {
      // Continue provisioning as payments continue
      const invoice = event.data.object as any; // Use 'any' to avoid type issues
      const subscriptionId = invoice.subscription;

      if (subscriptionId && typeof subscriptionId === 'string') {
        try {
          const subscription = (await stripe.subscriptions.retrieve(subscriptionId)) as Stripe.Subscription;
          const hid = subscription.metadata?.household_id;
          
          if (hid) {
            await supabase.from('households').update({
              subscription_status: 'active',
              subscription_current_period_end: new Date(
                (subscription as any).current_period_end * 1000
              ).toISOString(),
            }).eq('id', hid);
          }
        } catch (error) {
          console.error('Error retrieving subscription:', error);
        }
      }
      break;
    }

    case 'invoice.payment_failed': {
      // Payment failed - subscription becomes past_due
      const invoice = event.data.object as any; // Use 'any' to avoid type issues
      const subscriptionId = invoice.subscription;

      if (subscriptionId && typeof subscriptionId === 'string') {
        try {
          const subscription = (await stripe.subscriptions.retrieve(subscriptionId)) as Stripe.Subscription;
          const hid = subscription.metadata?.household_id;
          
          if (hid) {
            await supabase.from('households').update({
              subscription_status: 'past_due',
            }).eq('id', hid);
          }
        } catch (error) {
          console.error('Error retrieving subscription:', error);
        }
      }
      break;
    }

    case 'customer.subscription.deleted': {
      // Subscription canceled - revert to free tier
      const subscription = event.data.object as Stripe.Subscription;
      const hid = subscription.metadata?.household_id;
      
      if (hid) {
        await supabase.from('households').update({
          subscription_status: 'canceled',
          subscription_plan: 'free',
          stripe_subscription_id: null,
          max_family_members: PLAN_LIMITS.free.maxFamily,
          max_helpers: PLAN_LIMITS.free.maxHelpers,
        }).eq('id', hid);
      }
      break;
    }

    default:
      console.log(`Unhandled event type: ${event.type}`);
  }

  return res.status(200).json({ received: true });
}