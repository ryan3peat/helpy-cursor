// api/stripe-webhook.ts
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { buffer } from 'micro';
import { logger } from './_logger';

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
  pro: { maxFamily: 8, maxHelpers: 4 }, // Pro helpers capped at 4
  test: { maxFamily: 4, maxHelpers: 1 }, // Test plan for Stripe testing
};

// Helper to extract household_id from various event objects
async function getHouseholdIdFromSubscription(subscriptionId: string): Promise<string | null> {
  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    return subscription.metadata?.household_id || null;
  } catch (error) {
    logger.error('Error retrieving subscription:', error);
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
        logger.warn('timestampToISO received invalid timestamp', { rawTimestamp });
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
      logger.warn('timestampToISO received non-finite milliseconds', {
        rawTimestamp,
        milliseconds,
      });
      return null;
    }

    const date = new Date(milliseconds);
    const timeValue = date.getTime();

    if (!Number.isFinite(timeValue)) {
      logger.warn('timestampToISO produced invalid Date', { rawTimestamp, milliseconds });
      return null;
    }

    try {
      return date.toISOString();
    } catch (isoError) {
      logger.error('timestampToISO toISOString failed', {
        rawTimestamp,
        milliseconds,
        timeValue,
        isoError,
      });
      return null;
    }
  } catch (error) {
    logger.error('timestampToISO threw unexpectedly', { rawTimestamp, error });
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
          logger.warn('sanitizeStripeObject: Date has invalid time value', { timeValue });
          return null;
        }
        // Double-check before calling toISOString
        const testDate = new Date(timeValue);
        if (isNaN(testDate.getTime())) {
          logger.warn('sanitizeStripeObject: Cannot create valid Date from timeValue', { timeValue });
          return null;
        }
        return testDate.toISOString();
      } catch (error) {
        logger.warn('sanitizeStripeObject: Error converting Date to ISO string', { error });
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
            logger.warn('sanitizeStripeObject: Error processing key', { key, error });
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
    logger.error('sanitizeStripeObject: Unexpected error', { error, objType: typeof obj });
    // Return null for any object that causes issues to prevent serialization errors
    return null;
  }
}

export default async function handler(req: any, res: any) {
  // Log at the absolute top level to catch ALL requests
  logger.log('🚀 ===== STRIPE WEBHOOK HANDLER CALLED =====');
  logger.log('🚀 Handler invoked at:', new Date().toISOString());
  logger.log('🚀 Request method:', req.method);
  logger.log('🚀 Request URL:', req.url);
  
  // Top-level error handler to catch any Date serialization errors
  try {
    const result = await handleWebhookRequest(req, res);
    logger.log('✅ Handler completed successfully');
    return result;
  } catch (error: any) {
    logger.error('❌ ===== TOP LEVEL ERROR IN WEBHOOK HANDLER =====');
    logger.error('❌ Error type:', error?.constructor?.name);
    logger.error('❌ Error message:', error?.message);
    logger.error('❌ Error stack:', error?.stack);
    
    // Specifically catch RangeError from Date.toISOString
    if (error instanceof RangeError && error.message.includes('Invalid time value')) {
      logger.error('❌ RangeError caught in webhook handler (Date serialization issue):', error);
      logger.error('Stack trace:', error.stack);
      // Return 200 to Stripe so it doesn't retry
      return res.status(200).json({ received: true, error: 'Date serialization error handled' });
    }
    // Re-throw other errors
    throw error;
  }
}

async function handleWebhookRequest(req: any, res: any) {
  // Log ALL requests immediately (even before method check)
  logger.log('🔔 ===== WEBHOOK ENDPOINT HIT =====');
  logger.log('📥 Raw request received:', {
    method: req.method,
    url: req.url,
    path: req.url?.split('?')[0],
    timestamp: new Date().toISOString(),
    headers: {
      host: req.headers?.host,
      'user-agent': req.headers?.['user-agent'],
      'stripe-signature': req.headers?.['stripe-signature'] ? 'present' : 'missing',
      'content-type': req.headers?.['content-type'],
      'content-length': req.headers?.['content-length'],
    },
  });

  // Allow GET requests for testing/health checks
  if (req.method === 'GET') {
    logger.log('✅ GET request received - webhook endpoint is accessible');
    return res.status(200).json({ 
      status: 'ok', 
      message: 'Stripe webhook endpoint is accessible',
      endpoint: '/api/stripe-webhook',
      timestamp: new Date().toISOString(),
    });
  }

  if (req.method !== 'POST') {
    logger.log(`⚠️ Unsupported method: ${req.method}`);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get raw body for Stripe signature verification using micro's buffer helper
  let buf: Buffer;
  try {
    buf = await buffer(req);
    logger.log('✅ Body buffer created, size:', buf.length);
  } catch (error) {
    logger.error('❌ Error reading request body:', error);
    return res.status(400).send('Error reading request body');
  }

  const sig = req.headers?.['stripe-signature'] || req.headers?.get?.('stripe-signature');

  if (!sig) {
    logger.log('⚠️ Missing stripe-signature header');
    logger.log('⚠️ This might be a test request or webhook not configured correctly');
    return res.status(400).json({ error: 'Missing stripe-signature header' });
  }

  // Check if webhook secret is configured
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    logger.error('❌ STRIPE_WEBHOOK_SECRET environment variable is not set!');
    logger.error('❌ Webhook signature verification cannot proceed');
    return res.status(500).json({ error: 'Webhook secret not configured' });
  }

  logger.log('🔐 Webhook secret is configured (length:', webhookSecret.length, 'chars)');

  let event: Stripe.Event;

  try {
    logger.log('🔍 Attempting to verify webhook signature...');
    event = stripe.webhooks.constructEvent(
      buf,
      sig,
      webhookSecret
    );
    logger.log('✅ Webhook signature verified successfully');
  } catch (err: any) {
    logger.error(`❌ Webhook signature verification failed: ${err.message}`);
    logger.error('❌ Signature verification error details:', {
      message: err.message,
      type: err.type,
      code: err.code,
    });
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  // Log all events for audit
  const dataObject = event.data.object as any;
  const householdId = dataObject.metadata?.household_id;
  
  logger.log(`📋 Event object metadata:`, {
    has_metadata: !!dataObject.metadata,
    household_id: householdId,
    metadata_keys: dataObject.metadata ? Object.keys(dataObject.metadata) : [],
  });
  
  if (householdId) {
    try {
      // Sanitize data object to prevent Date serialization issues
      // Convert any timestamp fields to ISO strings or null
      let sanitizedData: any;
      try {
        sanitizedData = sanitizeStripeObject(dataObject);
      } catch (sanitizeError) {
        logger.error('❌ Error sanitizing event data:', sanitizeError);
        // Fallback: use a minimal safe object
        sanitizedData = {
          id: dataObject.id,
          object: dataObject.object,
          metadata: dataObject.metadata,
        };
      }
      
      const { error: logError } = await supabase.from('subscription_events').insert({
        household_id: householdId,
        stripe_event_id: event.id,
        event_type: event.type,
        data: sanitizedData,
      });
      
      if (logError) {
        logger.error('❌ Error logging event to subscription_events:', logError);
        logger.error('❌ Log error details:', {
          code: logError.code,
          message: logError.message,
          details: logError.details,
          hint: logError.hint,
        });
      } else {
        logger.log(`✅ Event logged to subscription_events table`);
      }
    } catch (error) {
      logger.error('❌ Exception logging event:', error);
      // Don't throw - continue processing the webhook
    }
  } else {
    logger.warn(`⚠️ Event ${event.type} has no household_id in metadata - skipping event logging`);
  }

  logger.log(`📥 Received webhook event: ${event.type}`);
  logger.log(`📋 Event details:`, {
    id: event.id,
    type: event.type,
    livemode: event.livemode,
    created: event.created,
    api_version: event.api_version,
  });

  // Wrap entire event handling in try-catch to ensure we always return 200
  try {
    // Handle events per Stripe's best practices
    switch (event.type) {
    case 'checkout.session.completed': {
      // Payment successful, subscription created
      const session = event.data.object as Stripe.Checkout.Session;
      const plan = session.metadata?.plan as 'core' | 'pro' | 'test';
      const period = session.metadata?.period;
      const hid = session.metadata?.household_id;

      logger.log(`✅ checkout.session.completed event received`);
      logger.log(`📋 Session details:`, {
        session_id: session.id,
        customer: session.customer,
        subscription: session.subscription,
        metadata: session.metadata,
        household_id: hid,
        plan: plan,
        period: period,
      });

      // Handle referral code tracking
      const referralCode = session.metadata?.referral_code;
      const agencyId = session.metadata?.agency_id;
      const referralCodeId = session.metadata?.referral_code_id;

      // Validate required fields before proceeding
      if (!hid) {
        logger.error(`❌ checkout.session.completed: Missing household_id in metadata`, {
          metadata: session.metadata,
        });
        break;
      }

      if (!plan) {
        logger.error(`❌ checkout.session.completed: Missing plan in metadata`, {
          metadata: session.metadata,
        });
        break;
      }

      if (!session.subscription) {
        logger.error(`❌ checkout.session.completed: Missing subscription in session`, {
          session_id: session.id,
        });
        break;
      }

      if (!PLAN_LIMITS[plan]) {
        logger.error(`❌ checkout.session.completed: Invalid plan "${plan}" - not in PLAN_LIMITS`, {
          plan: plan,
          available_plans: Object.keys(PLAN_LIMITS),
        });
        break;
      }

      logger.log(`✅ checkout.session.completed: All validations passed, updating household ${hid} to ${plan}`);

      if (hid && plan && session.subscription && PLAN_LIMITS[plan]) {
        const limits = PLAN_LIMITS[plan];

        // Retrieve subscription to get period end date
        try {
          const subscriptionId = typeof session.subscription === 'string'
            ? session.subscription
            : session.subscription.id;

          const subscription = await stripe.subscriptions.retrieve(subscriptionId);

          // Safely convert period end to ISO string, validating it's a valid timestamp
          const periodEnd = timestampToISO(subscription.current_period_end);

          const { data: updateData, error: updateError } = await supabase.from('households').update({
            stripe_customer_id: session.customer as string,
            stripe_subscription_id: subscriptionId,
            subscription_status: 'active',
            subscription_plan: plan,
            subscription_period: period,
            ...(periodEnd && { subscription_current_period_end: periodEnd }),
            max_family_members: limits.maxFamily,
            max_helpers: limits.maxHelpers,
          }).eq('id', hid).select();

          if (updateError) {
            logger.error(`❌ Error updating household ${hid} subscription:`, updateError);
            logger.error(`❌ Update error details:`, {
              code: updateError.code,
              message: updateError.message,
              details: updateError.details,
              hint: updateError.hint,
            });
          } else {
            logger.log(`✅ Successfully updated household ${hid} subscription to ${plan}`);
            logger.log(`📊 Updated data:`, updateData);
          }
        } catch (error) {
          logger.error('❌ Error retrieving subscription in checkout.session.completed:', error);
          logger.error('❌ Error details:', {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          });
          
          // Fallback: update without period_end, it will be set by invoice.paid event
          const subscriptionId = typeof session.subscription === 'string'
            ? session.subscription
            : session.subscription.id;
          
          logger.log(`🔄 Attempting fallback update for household ${hid} with subscription ${subscriptionId}`);
          
          const { data: fallbackData, error: fallbackError } = await supabase.from('households').update({
            stripe_customer_id: session.customer as string,
            stripe_subscription_id: subscriptionId,
            subscription_status: 'active',
            subscription_plan: plan,
            subscription_period: period,
            max_family_members: limits.maxFamily,
            max_helpers: limits.maxHelpers,
          }).eq('id', hid).select();

          if (fallbackError) {
            logger.error(`❌ Fallback update also failed for household ${hid}:`, fallbackError);
            logger.error(`❌ Fallback error details:`, {
              code: fallbackError.code,
              message: fallbackError.message,
              details: fallbackError.details,
              hint: fallbackError.hint,
            });
          } else {
            logger.log(`✅ Fallback update succeeded for household ${hid}`);
            logger.log(`📊 Fallback updated data:`, fallbackData);
          }
        }
      }

      // Handle referral code tracking
      if (referralCode && hid) {
        // Calculate trial end date
        const trialEnd = session.subscription && typeof session.subscription === 'object' && session.subscription.trial_end
          ? new Date((session.subscription.trial_end as number) * 1000).toISOString()
          : null;

        // Update household with referral info
        await supabase.from('households').update({
          is_trial: !!trialEnd,
          trial_ends_at: trialEnd,
          referral_code_used: referralCode,
          referred_by_agency_id: agencyId || null,
        }).eq('id', hid);

        // Record referral usage
        await supabase.from('referral_usage').insert({
          referral_code_id: referralCodeId,
          agency_id: agencyId,
          household_id: hid,
          code_used: referralCode,
          trial_started_at: new Date().toISOString(),
          trial_ends_at: trialEnd,
          subscription_plan: plan,
        });

        // Increment usage count on referral code
        if (referralCodeId) {
          await supabase.rpc('increment_referral_usage', { code_id: referralCodeId });
        }
      }
      break;
    }

    case 'customer.subscription.created': {
      // Subscription created - backup handler for initial creation
      const subscription = event.data.object as Stripe.Subscription;
      const hid = subscription.metadata?.household_id;

      logger.log(`📦 customer.subscription.created for household: ${hid}`);

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

      // Check if trial just ended (status changed from trialing to active)
      if (subscription.status === 'active' && hid) {
        const { data: household } = await supabase
          .from('households')
          .select('is_trial')
          .eq('id', hid)
          .single();

        if (household?.is_trial) {
          // Trial converted to paid - update tracking
          await supabase.from('households').update({
            is_trial: false,
            subscription_status: 'active',
          }).eq('id', hid);

          // Update referral_usage with conversion date
          await supabase.from('referral_usage').update({
            converted_to_paid_at: new Date().toISOString(),
          }).eq('household_id', hid);
        }
      }

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
      
      logger.log('🔍 subscription.updated raw timestamps', {
        hid,
        current_period_end: safeCurrentPeriodEnd,
        cancel_at: safeCancelAt,
        cancel_at_period_end: subscription.cancel_at_period_end,
      });
      
      logger.log(`🔄 customer.subscription.updated for household: ${hid}, status: ${subscription.status}, cancel_at_period_end: ${isScheduledToCancel}`);

      if (hid) {
        try {
          // Determine plan from price if available
          let plan: 'free' | 'core' | 'pro' | 'test' | null = null;
          const priceId = subscription.items?.data?.[0]?.price?.id;
          
          if (priceId) {
            // Check against environment price IDs
            if (priceId === process.env.STRIPE_CORE_MONTHLY_PRICE_ID || 
                priceId === process.env.STRIPE_CORE_YEARLY_PRICE_ID) {
              plan = 'core';
            } else if (priceId === process.env.STRIPE_PRO_MONTHLY_PRICE_ID || 
                       priceId === process.env.STRIPE_PRO_YEARLY_PRICE_ID) {
              plan = 'pro';
            } else if (priceId === process.env.STRIPE_TEST_PRICE_ID) {
              plan = 'test';
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

          // Always update cancel_at_period_end to reflect current state
          updateData.cancel_at_period_end = isScheduledToCancel;
          
          // Handle subscription cancellation scenarios
          if (subscription.status === 'canceled' || subscription.status === 'unpaid') {
            // Subscription is immediately canceled or unpaid - revert to free tier
            updateData.subscription_plan = 'free';
            updateData.max_family_members = PLAN_LIMITS.free.maxFamily;
            updateData.max_helpers = PLAN_LIMITS.free.maxHelpers;
            // Clear subscription ID for consistency with deleted handler
            updateData.stripe_subscription_id = null;
            updateData.cancel_at_period_end = false; // No longer pending, it's done
            logger.log(`⚠️ Subscription canceled immediately for household ${hid}`);
          } else if (isScheduledToCancel) {
            // Subscription is scheduled to cancel at period end - still active but will cancel
            // Keep status as active/trialing so user can still use features until period ends
            // The cancel_at_period_end flag will show "Cancelled" button in UI
            logger.log(`⏰ Subscription scheduled to cancel at period end for household ${hid} (${cancelAt || 'end of period'})`);
            // Keep current plan and limits until period ends
            // The subscription will be handled by customer.subscription.deleted when it actually ends
          } else if (subscription.status === 'active' && !isScheduledToCancel) {
            // Subscription is active and NOT scheduled to cancel (e.g., user resubscribed or cancellation was reversed)
            updateData.subscription_status = 'active';
            updateData.cancel_at_period_end = false;
          }

          const { error } = await supabase.from('households').update(updateData).eq('id', hid);

          if (error) {
            logger.error(`❌ Error updating household ${hid} subscription:`, error);
            // Don't throw - webhook should still return 200 to Stripe
          } else {
            logger.log(`✅ Updated household ${hid} subscription status to ${subscription.status}`);
          }
        } catch (error) {
          logger.error(`❌ Exception updating household ${hid} subscription:`, error);
          // Don't throw - webhook should still return 200 to Stripe
        }
      } else {
        logger.warn(`⚠️ customer.subscription.updated event missing household_id in metadata`);
      }
      break;
    }

    case 'invoice.paid': {
      // Continue provisioning as payments continue
      const invoice = event.data.object as Stripe.Invoice;
      
      logger.log(`💰 invoice.paid event received`);
      logger.log(`📋 Invoice details:`, {
        invoice_id: invoice.id,
        subscription: invoice.subscription,
        subscription_type: typeof invoice.subscription,
        customer: invoice.customer,
        amount_paid: invoice.amount_paid,
        currency: invoice.currency,
      });

      // Handle subscription ID - can be string, object (expanded), or null
      let subscriptionId: string | null = null;
      
      if (invoice.subscription) {
        if (typeof invoice.subscription === 'string') {
          subscriptionId = invoice.subscription;
        } else if (typeof invoice.subscription === 'object' && invoice.subscription.id) {
          // Expanded subscription object
          subscriptionId = invoice.subscription.id;
        }
      }

      if (!subscriptionId) {
        logger.log(`ℹ️ invoice.paid: Invoice ${invoice.id} is not associated with a subscription (likely one-time payment)`);
        break;
      }

      logger.log(`🔍 invoice.paid: Processing subscription ${subscriptionId}`);

      try {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const hid = subscription.metadata?.household_id;
        
        if (!hid) {
          logger.warn(`⚠️ invoice.paid: Subscription ${subscriptionId} has no household_id in metadata`);
          break;
        }
        
        // Safely convert period end to ISO string, validating it's a valid timestamp
        const periodEnd = timestampToISO(subscription.current_period_end);
        
        const { data: updateData, error: updateError } = await supabase.from('households').update({
          subscription_status: 'active',
          ...(periodEnd && { subscription_current_period_end: periodEnd }),
        }).eq('id', hid).select();

        if (updateError) {
          logger.error(`❌ Error updating household ${hid} after invoice.paid:`, updateError);
          logger.error(`❌ Update error details:`, {
            code: updateError.code,
            message: updateError.message,
            details: updateError.details,
            hint: updateError.hint,
          });
        } else {
          logger.log(`✅ Updated household ${hid} after invoice.paid`);
          logger.log(`📊 Updated data:`, updateData);
        }
      } catch (error) {
        logger.error('❌ Error handling invoice.paid:', error);
        logger.error('❌ Error details:', {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
      }
      break;
    }

    case 'invoice.payment_failed': {
      // Payment failed - subscription becomes past_due
      const invoice = event.data.object as any;
      const subscriptionId = invoice.subscription;

      logger.log(`❌ invoice.payment_failed for subscription: ${subscriptionId}`);

      if (subscriptionId && typeof subscriptionId === 'string') {
        try {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          const hid = subscription.metadata?.household_id;
          
          if (hid) {
            await supabase.from('households').update({
              subscription_status: 'past_due',
            }).eq('id', hid);

            logger.log(`⚠️ Marked household ${hid} as past_due`);
          }
        } catch (error) {
          logger.error('Error handling invoice.payment_failed:', error);
        }
      }
      break;
    }

    case 'invoice.finalization_failed': {
      // Invoice couldn't be finalized - log for manual review
      const invoice = event.data.object as any;
      logger.error(`🚨 invoice.finalization_failed: ${invoice.id}`);
      logger.error('Last finalization error:', invoice.last_finalization_error);
      
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

      logger.log(`🗑️ customer.subscription.deleted for household: ${hid}`);
      
      if (hid) {
        try {
          const { error } = await supabase.from('households').update({
            subscription_status: 'canceled',
            subscription_plan: 'free',
            stripe_subscription_id: null,
            max_family_members: PLAN_LIMITS.free.maxFamily,
            max_helpers: PLAN_LIMITS.free.maxHelpers,
            cancel_at_period_end: false, // Subscription is now fully canceled
            is_trial: false,
            trial_ends_at: null,
          }).eq('id', hid);

          if (error) {
            logger.error(`❌ Error updating household ${hid} after subscription deletion:`, error);
            // Don't throw - webhook should still return 200 to Stripe
          } else {
            logger.log(`✅ Reverted household ${hid} to free tier`);
          }
        } catch (error) {
          logger.error(`❌ Exception updating household ${hid} after subscription deletion:`, error);
          // Don't throw - webhook should still return 200 to Stripe
        }
      } else {
        logger.warn(`⚠️ customer.subscription.deleted event missing household_id in metadata`);
      }
      break;
    }

    case 'customer.subscription.trial_will_end': {
      // Trial ending soon - could be used for notifications
      const subscription = event.data.object as Stripe.Subscription;
      const hid = subscription.metadata?.household_id;

      logger.log(`⏰ customer.subscription.trial_will_end for household: ${hid}`);
      
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
      logger.log(`ℹ️ Unhandled event type: ${event.type}`);
      logger.log(`📋 Unhandled event details:`, {
        id: event.id,
        type: event.type,
        object_type: (event.data.object as any)?.object,
      });
    }
  } catch (error: any) {
    // Log unexpected errors but still return 200 to Stripe
    logger.error(`❌ Unexpected error handling webhook event ${event.type}:`, error);
    logger.error('Error details:', {
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