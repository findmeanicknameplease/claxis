'use client';

import { loadStripe, Stripe } from '@stripe/stripe-js';

let stripePromise: Promise<Stripe | null>;

// Check if Stripe is configured on client side
const isStripeClientConfigured = (): boolean => {
  return !!process.env['NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY'];
};

// Initialize Stripe with publishable key (lazy loading)
const getStripe = () => {
  if (!stripePromise) {
    const publishableKey = process.env['NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY'];
    
    if (!publishableKey) {
      console.warn('Stripe is not configured on client side');
      stripePromise = Promise.resolve(null);
      return stripePromise;
    }
    
    stripePromise = loadStripe(publishableKey, {
      locale: 'auto', // Automatically detect user's locale for EU markets
    });
  }
  return stripePromise;
};

// Interface for checkout session data
export interface CheckoutSessionData {
  tier: 'professional' | 'enterprise';
  successUrl: string;
  cancelUrl: string;
  salonData?: {
    businessName: string;
    ownerName: string;
    email: string;
    phone: string;
    location?: string;
  };
}

// Create checkout session and redirect to Stripe
export async function createCheckoutSession(data: CheckoutSessionData): Promise<void> {
  if (!isStripeClientConfigured()) {
    throw new Error('Payments are not currently available. Please contact support.');
  }
  
  try {
    const response = await fetch('/api/stripe/create-checkout-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to create checkout session');
    }

    const { sessionId, url } = await response.json();

    if (url) {
      // Redirect directly to Stripe Checkout
      window.location.href = url;
    } else if (sessionId) {
      // Use Stripe.js to redirect (alternative method)
      const stripe = await getStripe();
      if (!stripe) {
        throw new Error('Stripe failed to load');
      }

      const { error } = await stripe.redirectToCheckout({
        sessionId,
      });

      if (error) {
        throw new Error(error.message);
      }
    } else {
      throw new Error('No session ID or URL returned from checkout session creation');
    }

  } catch (error) {
    console.error('Error creating checkout session:', error);
    throw error;
  }
}

// Create billing portal session for existing customers
export async function createBillingPortalSession(returnUrl: string): Promise<void> {
  if (!isStripeClientConfigured()) {
    throw new Error('Billing portal is not currently available. Please contact support.');
  }
  
  try {
    const response = await fetch('/api/stripe/billing-portal', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ returnUrl }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to create billing portal session');
    }

    const { url } = await response.json();
    
    if (url) {
      window.location.href = url;
    } else {
      throw new Error('No billing portal URL returned');
    }

  } catch (error) {
    console.error('Error creating billing portal session:', error);
    throw error;
  }
}

// Utility function to format currency for EU markets
export function formatEuroAmount(amount: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount / 100);
}

// Get tier display information
export function getTierInfo(tier: 'professional' | 'enterprise') {
  const tierData = {
    professional: {
      name: 'Professional',
      price: 9999, // €99.99 in cents
      description: 'Perfect for growing salons',
      features: [
        'Unlimited WhatsApp conversations',
        'Instagram automation',
        'Marketing campaigns',
        'Customer analytics',
      ],
    },
    enterprise: {
      name: 'Enterprise', 
      price: 29999, // €299.99 in cents
      description: 'For large salons and chains',
      features: [
        'Everything in Professional',
        '24/7 Voice AI receptionist',
        'Business verification',
        'Custom voice cloning',
      ],
    },
  };

  return tierData[tier];
}

export default getStripe;