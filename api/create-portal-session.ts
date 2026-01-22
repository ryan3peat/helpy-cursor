// api/create-portal-session.ts
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { logger } from './_logger';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-11-17.clover',
});

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

    const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.VITE_APP_URL || 'https://app.helpyfam.com';
    // For client-side routing, return to base URL with query parameter
    // The app will handle portal_return and navigate to profile/subscription view
    // Using both query param and hash param for SPA compatibility
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: household.stripe_customer_id,
      return_url: `${APP_URL}/?portal_return=true#portal_return=true`,
    });

    return res.status(200).json({ url: portalSession.url });
  } catch (error: any) {
    logger.error('Portal session error:', error);
    return res.status(500).json({ error: error.message });
  }
}