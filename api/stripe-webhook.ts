// api/stripe-webhook.ts
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { buffer } from 'micro';

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

// Helper to extract household_id from various event objects
async function getHouseholdIdFromSubscription(subscriptionId: string): Promise<string | null> {
  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    return subscription.metadata?.household_id || null;
  } catch (error) {
    console.error('Error retrieving subscription:', error);
    return null;
  }
}

export default async function handler(req: any, res: any) {
  // Log request details for debugging
  console.log('📥 Webhook request received:', {
    method: req.method,
    url: req.url,
    headers: {
      host: req.headers?.host,
      'stripe-signature': req.headers?.['stripe-signature'] ? 'present' : 'missing',
      'content-type': req.headers?.['content-type'],
    },
  });

  if (req.method !== 'POST') {
    return res.status(405).end();
  }

  // Get raw body for Stripe signature verification using micro's buffer helper
  let buf: Buffer;
  try {
    buf = await buffer(req);
    console.log('✅ Body buffer created, size:', buf.length);
  } catch (error) {
    console.error('❌ Error reading request body:', error);
    return res.status(400).send('Error reading request body');
  }

  const sig = req.headers?.['stripe-signature'] || req.headers?.get?.('stripe-signature');

  if (!sig) {
    console.log('⚠️ Missing stripe-signature header');
    return res.status(400).send('Missing stripe-signature header');
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      buf,
      sig,
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

  console.log(`📥 Received webhook event: ${event.type}`);

  // Handle events per Stripe's best practices
  switch (event.type) {
    case 'checkout.session.completed': {
      // Payment successful, subscription created
      const session = event.data.object as Stripe.Checkout.Session;
      const plan = session.metadata?.plan as 'core' | 'pro';
      const period = session.metadata?.period;
      const hid = session.metadata?.household_id;

      console.log(`✅ checkout.session.completed for household: ${hid}, plan: ${plan}`);

      if (hid && plan && session.subscription) {
        const limits = PLAN_LIMITS[plan];
        
        // Retrieve subscription to get period end date
        try {
          const subscriptionId = typeof session.subscription === 'string' 
            ? session.subscription 
            : session.subscription.id;
          
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          
          await supabase.from('households').update({
            stripe_customer_id: session.customer as string,
            stripe_subscription_id: subscriptionId,
            subscription_status: 'active',
            subscription_plan: plan,
            subscription_period: period,
            subscription_current_period_end: new Date(
              subscription.current_period_end * 1000
            ).toISOString(),
            max_family_members: limits.maxFamily,
            max_helpers: limits.maxHelpers,
          }).eq('id', hid);

          console.log(`✅ Updated household ${hid} subscription to ${plan}`);
        } catch (error) {
          console.error('Error retrieving subscription in checkout.session.completed:', error);
          // Fallback: update without period_end, it will be set by invoice.paid event
          await supabase.from('households').update({
            stripe_customer_id: session.customer as string,
            stripe_subscription_id: typeof session.subscription === 'string' 
              ? session.subscription 
              : session.subscription.id,
            subscription_status: 'active',
            subscription_plan: plan,
            subscription_period: period,
            max_family_members: limits.maxFamily,
            max_helpers: limits.maxHelpers,
          }).eq('id', hid);
        }
      }
      break;
    }

    case 'customer.subscription.created': {
      // Subscription created - backup handler for initial creation
      const subscription = event.data.object as Stripe.Subscription;
      const hid = subscription.metadata?.household_id;

      console.log(`📦 customer.subscription.created for household: ${hid}`);

      if (hid) {
        // Only update if not already set by checkout.session.completed
        const { data: household } = await supabase
          .from('households')
          .select('subscription_status')
          .eq('id', hid)
          .single();

        if (household && household.subscription_status !== 'active') {
          await supabase.from('households').update({
            stripe_subscription_id: subscription.id,
            subscription_status: subscription.status,
            subscription_current_period_end: new Date(
              subscription.current_period_end * 1000
            ).toISOString(),
          }).eq('id', hid);
        }
      }
      break;
    }

    case 'customer.subscription.updated': {
      // Subscription updated - handles plan changes, status changes, renewals
      const subscription = event.data.object as Stripe.Subscription;
      const hid = subscription.metadata?.household_id;

      console.log(`🔄 customer.subscription.updated for household: ${hid}, status: ${subscription.status}`);

      if (hid) {
        // Determine plan from price if available
        let plan: 'free' | 'core' | 'pro' | null = null;
        const priceId = subscription.items.data[0]?.price?.id;
        
        if (priceId) {
          // Check against environment price IDs
          if (priceId === process.env.STRIPE_CORE_MONTHLY_PRICE_ID || 
              priceId === process.env.STRIPE_CORE_YEARLY_PRICE_ID) {
            plan = 'core';
          } else if (priceId === process.env.STRIPE_PRO_MONTHLY_PRICE_ID || 
                     priceId === process.env.STRIPE_PRO_YEARLY_PRICE_ID) {
            plan = 'pro';
          }
        }

        const updateData: any = {
          subscription_status: subscription.status,
          subscription_current_period_end: new Date(
            subscription.current_period_end * 1000
          ).toISOString(),
        };

        // Update plan limits if we identified the plan
        if (plan && PLAN_LIMITS[plan]) {
          updateData.subscription_plan = plan;
          updateData.max_family_members = PLAN_LIMITS[plan].maxFamily;
          updateData.max_helpers = PLAN_LIMITS[plan].maxHelpers;
        }

        // Handle subscription becoming inactive
        if (subscription.status === 'canceled' || subscription.status === 'unpaid') {
          updateData.subscription_plan = 'free';
          updateData.max_family_members = PLAN_LIMITS.free.maxFamily;
          updateData.max_helpers = PLAN_LIMITS.free.maxHelpers;
        }

        await supabase.from('households').update(updateData).eq('id', hid);
        console.log(`✅ Updated household ${hid} subscription status to ${subscription.status}`);
      }
      break;
    }

    case 'invoice.paid': {
      // Continue provisioning as payments continue
      const invoice = event.data.object as any;
      const subscriptionId = invoice.subscription;

      console.log(`💰 invoice.paid for subscription: ${subscriptionId}`);

      if (subscriptionId && typeof subscriptionId === 'string') {
        try {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          const hid = subscription.metadata?.household_id;
          
          if (hid) {
            await supabase.from('households').update({
              subscription_status: 'active',
              subscription_current_period_end: new Date(
                subscription.current_period_end * 1000
              ).toISOString(),
            }).eq('id', hid);

            console.log(`✅ Updated household ${hid} after invoice.paid`);
          }
        } catch (error) {
          console.error('Error handling invoice.paid:', error);
        }
      }
      break;
    }

    case 'invoice.payment_failed': {
      // Payment failed - subscription becomes past_due
      const invoice = event.data.object as any;
      const subscriptionId = invoice.subscription;

      console.log(`❌ invoice.payment_failed for subscription: ${subscriptionId}`);

      if (subscriptionId && typeof subscriptionId === 'string') {
        try {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          const hid = subscription.metadata?.household_id;
          
          if (hid) {
            await supabase.from('households').update({
              subscription_status: 'past_due',
            }).eq('id', hid);

            console.log(`⚠️ Marked household ${hid} as past_due`);
          }
        } catch (error) {
          console.error('Error handling invoice.payment_failed:', error);
        }
      }
      break;
    }

    case 'invoice.finalization_failed': {
      // Invoice couldn't be finalized - log for manual review
      const invoice = event.data.object as any;
      console.error(`🚨 invoice.finalization_failed: ${invoice.id}`);
      console.error('Last finalization error:', invoice.last_finalization_error);
      
      // Log to subscription_events for later review
      if (invoice.subscription) {
        const hid = await getHouseholdIdFromSubscription(invoice.subscription);
        if (hid) {
          await supabase.from('subscription_events').insert({
            household_id: hid,
            stripe_event_id: event.id,
            event_type: event.type,
            data: {
              invoice_id: invoice.id,
              error: invoice.last_finalization_error,
            },
          });
        }
      }
      break;
    }

    case 'customer.subscription.deleted': {
      // Subscription canceled - revert to free tier
      const subscription = event.data.object as Stripe.Subscription;
      const hid = subscription.metadata?.household_id;

      console.log(`🗑️ customer.subscription.deleted for household: ${hid}`);
      
      if (hid) {
        await supabase.from('households').update({
          subscription_status: 'canceled',
          subscription_plan: 'free',
          stripe_subscription_id: null,
          max_family_members: PLAN_LIMITS.free.maxFamily,
          max_helpers: PLAN_LIMITS.free.maxHelpers,
        }).eq('id', hid);

        console.log(`✅ Reverted household ${hid} to free tier`);
      }
      break;
    }

    case 'customer.subscription.trial_will_end': {
      // Trial ending soon - could be used for notifications
      const subscription = event.data.object as Stripe.Subscription;
      const hid = subscription.metadata?.household_id;

      console.log(`⏰ customer.subscription.trial_will_end for household: ${hid}`);
      
      // Log for potential email notification system
      if (hid) {
        await supabase.from('subscription_events').insert({
          household_id: hid,
          stripe_event_id: event.id,
          event_type: event.type,
          data: {
            trial_end: subscription.trial_end,
          },
        });
      }
      break;
    }

    default:
      console.log(`ℹ️ Unhandled event type: ${event.type}`);
  }

  return res.status(200).json({ received: true });
}
