// services/stripeService.ts

export interface SubscriptionPlan {
  id: 'free' | 'core' | 'pro';
  name: string;
  monthlyPrice: number;
  yearlyPrice: number;
  features: string[];
  maxFamily: number;
  maxHelpers: number | 'unlimited';
}

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'free',
    name: 'Free',
    monthlyPrice: 0,
    yearlyPrice: 0,
    features: ['Up to 4 family members', 'Basic features'],
    maxFamily: 4,
    maxHelpers: 0,
  },
  {
    id: 'core',
    name: 'Core',
    monthlyPrice: 88,
    yearlyPrice: 850,
    features: [
      'Up to 6 family members',
      '2 helpers',
      'Receipt scanning',
      'Priority support',
    ],
    maxFamily: 6,
    maxHelpers: 2,
  },
  {
    id: 'pro',
    name: 'Pro',
    monthlyPrice: 118,
    yearlyPrice: 1080,
    features: [
      'Up to 10 family members',
      'Unlimited helpers',
      'Advanced AI features',
      'Data export',
      'Premium support',
    ],
    maxFamily: 10,
    maxHelpers: 'unlimited',
  },
];

export async function createCheckoutSession(
  householdId: string,
  plan: 'core' | 'pro',
  period: 'monthly' | 'yearly',
  userEmail: string
): Promise<string> {
  try {
    const response = await fetch('/api/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        householdId,
        priceKey: `${plan}_${period}`,
        userEmail,
      }),
    });

    // Handle non-200 responses
    if (!response.ok) {
      let errorMessage = 'Failed to create checkout session';
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
      } catch {
        // If response isn't JSON, use status text
        errorMessage = `Server error: ${response.status} ${response.statusText}`;
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    
    if (!data.url) {
      throw new Error('No checkout URL returned from server');
    }

    return data.url;
  } catch (error) {
    console.error('Checkout session error:', error);
    throw error instanceof Error ? error : new Error('Unknown error creating checkout session');
  }
}

export async function createPortalSession(householdId: string): Promise<string> {
  try {
    const response = await fetch('/api/create-portal-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ householdId }),
    });

    if (!response.ok) {
      let errorMessage = 'Failed to create portal session';
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
      } catch {
        errorMessage = `Server error: ${response.status} ${response.statusText}`;
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    
    if (!data.url) {
      throw new Error('No portal URL returned from server');
    }

    return data.url;
  } catch (error) {
    console.error('Portal session error:', error);
    throw error instanceof Error ? error : new Error('Unknown error creating portal session');
  }
}