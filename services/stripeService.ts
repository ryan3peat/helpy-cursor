// services/stripeService.ts

export interface SubscriptionPlan {
  id: 'free' | 'core' | 'pro' | 'test';
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
    features: [
      'Up to 3 family members (incl. admin)',
      '1 Helper',
      'Manual expense entry only (no scan)',
      'No Helper Management',
    ],
    maxFamily: 3,
    maxHelpers: 1,
  },
  {
    id: 'core',
    name: 'Core',
    monthlyPrice: 88,
    yearlyPrice: 845,
    features: [
      'Up to 4 family members (incl. admin)',
      '1 Helper',
      'All Expense Functions',
      'Helper Management',
    ],
    maxFamily: 4,
    maxHelpers: 1,
  },
  {
    id: 'pro',
    name: 'Pro',
    monthlyPrice: 118,
    yearlyPrice: 1133,
    features: [
      'Up to 8 family members (incl. admin)',
      'Up to 4 Helpers',
      'All Expense Functions',
      'Helper Management',
    ],
    maxFamily: 8,
    maxHelpers: 4,
  },
  {
    id: 'test',
    name: 'Test',
    monthlyPrice: 5,
    yearlyPrice: 5,
    features: ['Test plan for Stripe payment testing'],
    maxFamily: 4,
    maxHelpers: 1,
  },
];

export async function createCheckoutSession(
  householdId: string,
  plan: 'core' | 'pro' | 'test',
  period: 'monthly' | 'yearly',
  userEmail: string,
  promoCode?: string,
  referralCode?: string
): Promise<string> {
  try {
    const response = await fetch('/api/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        householdId,
        priceKey: `${plan}_${period}`,
        userEmail,
        promoCode: promoCode?.trim() || undefined,
        referralCode: referralCode?.trim().toUpperCase() || undefined,
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

export async function downgradeToFree(householdId: string): Promise<void> {
  try {
    const response = await fetch('/api/cancel-subscription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ householdId }),
    });

    if (!response.ok) {
      let errorMessage = 'Failed to downgrade subscription';
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
      } catch {
        errorMessage = `Server error: ${response.status} ${response.statusText}`;
      }
      throw new Error(errorMessage);
    }
  } catch (error) {
    console.error('Downgrade to free error:', error);
    throw error instanceof Error ? error : new Error('Unknown error downgrading subscription');
  }
}