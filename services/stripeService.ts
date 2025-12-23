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
];

export async function createCheckoutSession(
  householdId: string,
  plan: 'core' | 'pro' | 'test',
  period: 'monthly' | 'yearly',
  userEmail: string,
  promoCode?: string,
  referralCode?: string,
  requesterId?: string
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
        requesterId,
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

export async function downgradeToFree(householdId: string, requesterId?: string): Promise<void> {
  try {
    const response = await fetch('/api/cancel-subscription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ householdId, requesterId }),
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

/**
 * Change subscription between paid plans (Core <-> Pro)
 * This updates the existing subscription rather than creating a new one
 */
export async function changeSubscription(
  householdId: string,
  newPlan: 'core' | 'pro',
  newPeriod: 'monthly' | 'yearly',
  requesterId?: string
): Promise<{ success: boolean; plan?: string; status?: string; message?: string; error?: string }> {
  try {
    const response = await fetch('/api/change-subscription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ householdId, newPlan, newPeriod, requesterId }),
    });

    if (!response.ok) {
      let errorMessage = 'Failed to change subscription';
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
      } catch {
        errorMessage = `Server error: ${response.status} ${response.statusText}`;
      }
      return { success: false, error: errorMessage };
    }

    const data = await response.json();
    return { success: true, plan: data.plan, status: data.status, message: data.message };
  } catch (error) {
    console.error('Change subscription error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error changing subscription' 
    };
  }
}

/**
 * Sync subscription status from Stripe to database
 * This is a backup mechanism when webhooks don't fire properly
 */
export async function syncSubscription(
  householdId: string, 
  sessionId?: string
): Promise<{ success: boolean; plan?: string; status?: string; error?: string }> {
  try {
    const response = await fetch('/api/sync-subscription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ householdId, sessionId }),
    });

    if (!response.ok) {
      let errorMessage = 'Failed to sync subscription';
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
      } catch {
        errorMessage = `Server error: ${response.status} ${response.statusText}`;
      }
      return { success: false, error: errorMessage };
    }

    const data = await response.json();
    return { success: true, plan: data.plan, status: data.status };
  } catch (error) {
    console.error('Sync subscription error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error syncing subscription' 
    };
  }
}