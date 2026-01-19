// api/create-checkout-session.ts
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
  test_monthly: process.env.STRIPE_TEST_PRICE_ID!,
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { householdId, priceKey, userEmail, promoCode, referralCode, requesterId } = req.body;
    // priceKey: 'core_monthly' | 'core_yearly' | 'pro_monthly' | 'pro_yearly' | 'test_monthly'

    if (!householdId || !priceKey || !PRICE_IDS[priceKey]) {
      return res.status(400).json({ error: 'Invalid parameters' });
    }

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
        return res.status(403).json({ error: 'Only admins can create subscriptions' });
      }
    }

    // Get or create Stripe customer
    const { data: household } = await supabase
      .from('households')
      .select('stripe_customer_id, stripe_subscription_id, subscription_status, subscription_plan, name, referral_code_used')
      .eq('id', householdId)
      .single();

    // Check for referral code
    let trialDays = 0;
    let agencyId: string | null = null;
    let referralCodeId: string | null = null;

    if (referralCode && typeof referralCode === 'string') {
      const trimmedCode = referralCode.trim().toUpperCase();

      if (trimmedCode) {
        // Validate referral code
        const { data: codeData, error: codeError } = await supabase
          .from('referral_codes')
          .select(`
            id,
            agency_id,
            trial_days,
            discount_percent,
            is_active,
            usage_count,
            max_uses,
            valid_from,
            valid_until
          `)
          .eq('code', trimmedCode)
          .eq('is_active', true)
          .single();

        if (codeError || !codeData) {
          return res.status(400).json({ error: 'Invalid or expired referral code' });
        }

        // Check if code has reached max uses
        if (codeData.max_uses && codeData.usage_count >= codeData.max_uses) {
          return res.status(400).json({ error: 'This referral code has reached its maximum uses' });
        }

        // Check validity dates
        const now = new Date();
        if (codeData.valid_from && new Date(codeData.valid_from) > now) {
          return res.status(400).json({ error: 'This referral code is not yet active' });
        }
        if (codeData.valid_until && new Date(codeData.valid_until) < now) {
          return res.status(400).json({ error: 'This referral code has expired' });
        }

        // Check if household already used a referral code
        if (household?.referral_code_used) {
          return res.status(400).json({ error: 'A referral code has already been applied to this account' });
        }

        trialDays = codeData.trial_days || 30;
        agencyId = codeData.agency_id;
        referralCodeId = codeData.id;
      }
    }

    // Prevent duplicate subscriptions - check if there's already an active PAID subscription
    // Free users should always be able to upgrade, even if subscription_status shows 'active' from stale data
    const isPaidPlan = household?.subscription_plan && household.subscription_plan !== 'free';
    
    if (household?.stripe_subscription_id && household?.subscription_status === 'active' && isPaidPlan) {
      // Check if the subscription still exists in Stripe
      try {
        const existingSubscription = await stripe.subscriptions.retrieve(
          household.stripe_subscription_id
        );
        
        // If subscription exists and is active or trialing, prevent creating a new one
        if (existingSubscription.status === 'active' || existingSubscription.status === 'trialing') {
          return res.status(400).json({ 
            error: 'You already have an active subscription. Please manage your existing subscription instead.' 
          });
        }
      } catch (error: any) {
        // If subscription doesn't exist in Stripe, it's safe to create a new one
        if (error.code !== 'resource_missing') {
          console.error('Error checking existing subscription:', error);
        }
      }
    }

    let customerId = household?.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: userEmail,
        metadata: { household_id: householdId },
      });
      customerId = customer.id;

      await supabase
        .from('households')
        .update({ stripe_customer_id: customerId })
        .eq('id', householdId);
    }

    // Use environment variable with fallback
    const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.helpyfam.com';

    let promotionCodeId: string | undefined;

    if (promoCode && typeof promoCode === 'string') {
      const trimmed = promoCode.trim();
      if (trimmed) {
        const promotionCodes = await stripe.promotionCodes.list({
          code: trimmed,
          active: true,
          limit: 1,
        });

        if (!promotionCodes.data.length) {
          return res.status(400).json({ error: 'Invalid or inactive promo code' });
        }

        promotionCodeId = promotionCodes.data[0].id;
      }
    }

    // Create Checkout Session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: PRICE_IDS[priceKey], quantity: 1 }],
      success_url: `${APP_URL}/?session_id={CHECKOUT_SESSION_ID}&success=true`,
      cancel_url: `${APP_URL}/?canceled=true`,
      allow_promotion_codes: !referralCode, // Disable promo codes if using referral code
      metadata: {
        household_id: householdId,
        plan: priceKey.split('_')[0], // 'core' or 'pro'
        period: priceKey.split('_')[1], // 'monthly' or 'yearly'
        promo_code: promoCode || '',
        referral_code: referralCode || '',
        agency_id: agencyId || '',
        referral_code_id: referralCodeId || '',
      },
      subscription_data: {
        trial_period_days: trialDays > 0 ? trialDays : undefined,
        metadata: {
          household_id: householdId,
          referral_code: referralCode || '',
          agency_id: agencyId || '',
        },
      },
      discounts: promotionCodeId ? [{ promotion_code: promotionCodeId }] : undefined,
    });

    return res.status(200).json({ url: session.url });
  } catch (error: any) {
    console.error('Checkout error:', error);
    return res.status(500).json({ error: error.message });
  }
}