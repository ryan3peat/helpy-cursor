// api/create-portal-session.ts
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

  try {
    const { householdId } = req.body;

    const { data: household } = await supabase
      .from('households')
      .select('stripe_customer_id')
      .eq('id', householdId)
      .single();

    if (!household?.stripe_customer_id) {
      return res.status(400).json({ error: 'No subscription found' });
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: household.stripe_customer_id,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/profile`,
    });

    return res.status(200).json({ url: portalSession.url });
  } catch (error: any) {
    console.error('Portal session error:', error);
    return res.status(500).json({ error: error.message });
  }
}