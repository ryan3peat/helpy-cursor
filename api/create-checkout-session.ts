// api/create-checkout-session.ts
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
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

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { householdId, priceKey, userEmail } = req.body;
    // priceKey: 'core_monthly' | 'core_yearly' | 'pro_monthly' | 'pro_yearly'

    if (!householdId || !priceKey || !PRICE_IDS[priceKey]) {
      return res.status(400).json({ error: 'Invalid parameters' });
    }

    // Get or create Stripe customer
    const { data: household } = await supabase
      .from('households')
      .select('stripe_customer_id, name')
      .eq('id', householdId)
      .single();

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

    // Create Checkout Session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: PRICE_IDS[priceKey], quantity: 1 }],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/profile?session_id={CHECKOUT_SESSION_ID}&success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/profile?canceled=true`,
      metadata: {
        household_id: householdId,
        plan: priceKey.split('_')[0], // 'core' or 'pro'
        period: priceKey.split('_')[1], // 'monthly' or 'yearly'
      },
      subscription_data: {
        metadata: {
          household_id: householdId,
        },
      },
    });

    return res.status(200).json({ url: session.url });
  } catch (error: any) {
    console.error('Checkout error:', error);
    return res.status(500).json({ error: error.message });
  }
}