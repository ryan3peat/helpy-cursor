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

// Helper to safely convert Unix timestamp (seconds) to ISO string without throwing
function timestampToISO(rawTimestamp: unknown): string | null {
  try {
    const MAX_JS_DATE_MS = 8.64e15; // JS Date limit (+/- 100,000,000 days)

    // Accept numbers or numeric strings, everything else is ignored
    const timestamp =
      typeof rawTimestamp === 'number' || typeof rawTimestamp === 'string'
        ? Number(rawTimestamp)
        : null;

    if (timestamp === null || !Number.isFinite(timestamp) || timestamp <= 0) {
      if (rawTimestamp !== null && rawTimestamp !== undefined) {
        console.warn('timestampToISO received invalid timestamp', { rawTimestamp });
      }
      return null;
    }

    // Stripe sends seconds; multiply to milliseconds using Number to avoid bigint surprises
    const milliseconds = Number(timestamp * 1000);

    if (
      !Number.isFinite(milliseconds) ||
      milliseconds <= 0 ||
      Math.abs(milliseconds) > MAX_JS_DATE_MS
    ) {
      console.warn('timestampToISO received non-finite milliseconds', {
        rawTimestamp,
        milliseconds,
      });
      return null;
    }

    const date = new Date(milliseconds);
    const timeValue = date.getTime();

    if (!Number.isFinite(timeValue)) {
      console.warn('timestampToISO produced invalid Date', { rawTimestamp, milliseconds });
      return null;
    }

    try {
      return date.toISOString();
    } catch (isoError) {
      console.error('timestampToISO toISOString failed', {
        rawTimestamp,
        milliseconds,
        timeValue,
        isoError,
      });
      return null;
    }
  } catch (error) {
    console.error('timestampToISO threw unexpectedly', { rawTimestamp, error });
    return null;
  }
}

// Helper to sanitize Stripe objects before storing in database
// Converts all timestamp fields to ISO strings or null to prevent Date serialization errors
function sanitizeStripeObject(obj: any): any {
  try {
    if (obj === null || obj === undefined) {
      return obj;
    }

    // Handle Date objects - must check this before typeof check
    if (obj instanceof Date) {
      try {
        const timeValue = obj.getTime();
        if (!Number.isFinite(timeValue)) {
          console.warn('sanitizeStripeObject: Date has invalid time value', { timeValue });
          return null;
        }
        // Double-check before calling toISOString
        const testDate = new Date(timeValue);
        if (isNaN(testDate.getTime())) {
          console.warn('sanitizeStripeObject: Cannot create valid Date from timeValue', { timeValue });
          return null;
        }
        return testDate.toISOString();
      } catch (error) {
        console.warn('sanitizeStripeObject: Error converting Date to ISO string', { error });
        return null;
      }
    }

    // Handle arrays
    if (Array.isArray(obj)) {
      return obj.map(item => sanitizeStripeObject(item));
    }

    // Handle objects (but not Date, which we already handled)
    if (typeof obj === 'object') {
      const sanitized: any = {};
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          try {
            const value = obj[key];
            
            // Convert known timestamp fields (numbers that look like timestamps)
            if (typeof value === 'number' && (
              key.includes('_end') || 
              key.includes('_at') || 
              key.includes('_start') ||
              key === 'created' ||
              key === 'updated' ||
              key === 'trial_end'
            )) {
              sanitized[key] = timestampToISO(value);
            } else {
              // Recursively sanitize nested objects
              sanitized[key] = sanitizeStripeObject(value);
            }
          } catch (error) {
            console.warn('sanitizeStripeObject: Error processing key', { key, error });
            // Skip this key if it causes an error
            sanitized[key] = null;
          }
        }
      }
      return sanitized;
    }

    // Return primitives as-is
    return obj;
  } catch (error) {
    console.error('sanitizeStripeObject: Unexpected error', { error, objType: typeof obj });
    // Return null for any object that causes issues to prevent serialization errors
    return null;
  }
}

export default async function handler(req: any, res: any) {
  // Top-level error handler to catch any Date serialization errors
  try {
    return await handleWebhookRequest(req, res);
  } catch (error: any) {
    // Specifically catch RangeError from Date.toISOString
    if (error instanceof RangeError && error.message.includes('Invalid time value')) {
      console.error('❌ RangeError caught in webhook handler (Date serialization issue):', error);
      console.error('Stack trace:', error.stack);
      // Return 200 to Stripe so it doesn't retry
      return res.status(200).json({ received: true, error: 'Date serialization error handled' });
    }
    // Re-throw other errors
    throw error;
  }
}

async function handleWebhookRequest(req: any, res: any) {
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
      // Sanitize data object to prevent Date serialization issues
      // Convert any timestamp fields to ISO strings or null
      let sanitizedData: any;
      try {
        sanitizedData = sanitizeStripeObject(dataObject);
      } catch (sanitizeError) {
        console.error('Error sanitizing event data:', sanitizeError);
        // Fallback: use a minimal safe object
        sanitizedData = {
          id: dataObject.id,
          object: dataObject.object,
          metadata: dataObject.metadata,
        };
      }
      
      await supabase.from('subscription_events').insert({
        household_id: householdId,
        stripe_event_id: event.id,
        event_type: event.type,
        data: sanitizedData,
      });
    } catch (error) {
      console.error('Error logging event:', error);
      // Don't throw - continue processing the webhook
    }
  }

  console.log(`📥 Received webhook event: ${event.type}`);

  // Wrap entire event handling in try-catch to ensure we always return 200
  try {
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
          
          // Safely convert period end to ISO string, validating it's a valid timestamp
          const periodEnd = timestampToISO(subscription.current_period_end);
          
          await supabase.from('households').update({
            stripe_customer_id: session.customer as string,
            stripe_subscription_id: subscriptionId,
            subscription_status: 'active',
            subscription_plan: plan,
            subscription_period: period,
            ...(periodEnd && { subscription_current_period_end: periodEnd }),
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
          // Safely convert period end to ISO string, validating it's a valid timestamp
          const periodEnd = timestampToISO(subscription.current_period_end);
          
          await supabase.from('households').update({
            stripe_subscription_id: subscription.id,
            subscription_status: subscription.status,
            ...(periodEnd && { subscription_current_period_end: periodEnd }),
          }).eq('id', hid);
        }
      }
      break;
    }

    case 'customer.subscription.updated': {
      // Subscription updated - handles plan changes, status changes, renewals, cancellations
      const subscription = event.data.object as Stripe.Subscription;
      const hid = subscription.metadata?.household_id;

      // Log cancellation details for debugging
      const isScheduledToCancel = subscription.cancel_at_period_end === true;
      const cancelAt = timestampToISO(subscription.cancel_at);
      
      // Safely log timestamps - convert to primitives to avoid Date serialization issues
      const safeCurrentPeriodEnd = typeof subscription.current_period_end === 'number' 
        ? subscription.current_period_end 
        : (subscription.current_period_end instanceof Date 
          ? subscription.current_period_end.getTime() / 1000 
          : subscription.current_period_end);
      const safeCancelAt = typeof subscription.cancel_at === 'number' 
        ? subscription.cancel_at 
        : (subscription.cancel_at instanceof Date 
          ? subscription.cancel_at.getTime() / 1000 
          : subscription.cancel_at);
      
      console.log('🔍 subscription.updated raw timestamps', {
        hid,
        current_period_end: safeCurrentPeriodEnd,
        cancel_at: safeCancelAt,
        cancel_at_period_end: subscription.cancel_at_period_end,
      });
      
      console.log(`🔄 customer.subscription.updated for household: ${hid}, status: ${subscription.status}, cancel_at_period_end: ${isScheduledToCancel}`);

      if (hid) {
        try {
          // Determine plan from price if available
          let plan: 'free' | 'core' | 'pro' | null = null;
          const priceId = subscription.items?.data?.[0]?.price?.id;
          
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
          };

          // Only update period_end if it exists and is a valid timestamp
          const periodEnd = timestampToISO(subscription.current_period_end);
          if (periodEnd) {
            updateData.subscription_current_period_end = periodEnd;
          }

          // Update plan limits if we identified the plan
          if (plan && PLAN_LIMITS[plan]) {
            updateData.subscription_plan = plan;
            updateData.max_family_members = PLAN_LIMITS[plan].maxFamily;
            updateData.max_helpers = PLAN_LIMITS[plan].maxHelpers;
          }

          // Handle subscription cancellation scenarios
          if (subscription.status === 'canceled' || subscription.status === 'unpaid') {
            // Subscription is immediately canceled or unpaid - revert to free tier
            updateData.subscription_plan = 'free';
            updateData.max_family_members = PLAN_LIMITS.free.maxFamily;
            updateData.max_helpers = PLAN_LIMITS.free.maxHelpers;
            // Clear subscription ID for consistency with deleted handler
            updateData.stripe_subscription_id = null;
            console.log(`⚠️ Subscription canceled immediately for household ${hid}`);
          } else if (isScheduledToCancel) {
            // Subscription is scheduled to cancel at period end - still active but will cancel
            // Keep current plan and limits until period ends, but log the cancellation
            console.log(`⏰ Subscription scheduled to cancel at period end for household ${hid} (${cancelAt || 'end of period'})`);
            // Status remains 'active' but we know it's scheduled to cancel
            // The subscription will be handled by customer.subscription.deleted when it actually ends
          }

          const { error } = await supabase.from('households').update(updateData).eq('id', hid);

          if (error) {
            console.error(`❌ Error updating household ${hid} subscription:`, error);
            // Don't throw - webhook should still return 200 to Stripe
          } else {
            console.log(`✅ Updated household ${hid} subscription status to ${subscription.status}`);
          }
        } catch (error) {
          console.error(`❌ Exception updating household ${hid} subscription:`, error);
          // Don't throw - webhook should still return 200 to Stripe
        }
      } else {
        console.warn(`⚠️ customer.subscription.updated event missing household_id in metadata`);
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
            // Safely convert period end to ISO string, validating it's a valid timestamp
            const periodEnd = timestampToISO(subscription.current_period_end);
            
            await supabase.from('households').update({
              subscription_status: 'active',
              ...(periodEnd && { subscription_current_period_end: periodEnd }),
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
        try {
          const { error } = await supabase.from('households').update({
            subscription_status: 'canceled',
            subscription_plan: 'free',
            stripe_subscription_id: null,
            max_family_members: PLAN_LIMITS.free.maxFamily,
            max_helpers: PLAN_LIMITS.free.maxHelpers,
          }).eq('id', hid);

          if (error) {
            console.error(`❌ Error updating household ${hid} after subscription deletion:`, error);
            // Don't throw - webhook should still return 200 to Stripe
          } else {
            console.log(`✅ Reverted household ${hid} to free tier`);
          }
        } catch (error) {
          console.error(`❌ Exception updating household ${hid} after subscription deletion:`, error);
          // Don't throw - webhook should still return 200 to Stripe
        }
      } else {
        console.warn(`⚠️ customer.subscription.deleted event missing household_id in metadata`);
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
        // Safely convert trial_end timestamp
        const trialEnd = timestampToISO(subscription.trial_end);
        
        await supabase.from('subscription_events').insert({
          household_id: hid,
          stripe_event_id: event.id,
          event_type: event.type,
          data: {
            trial_end: trialEnd,
          },
        });
      }
      break;
    }

    default:
      console.log(`ℹ️ Unhandled event type: ${event.type}`);
    }
  } catch (error: any) {
    // Log unexpected errors but still return 200 to Stripe
    console.error(`❌ Unexpected error handling webhook event ${event.type}:`, error);
    console.error('Error details:', {
      message: error?.message,
      stack: error?.stack,
      eventType: event.type,
      eventId: event.id,
    });
  }

  return res.status(200).json({ received: true });
}

// Required for Stripe webhook signature verification
// Vercel's default body parser must be disabled to access raw body
export const config = {
  api: {
    bodyParser: false,
  },
};