import Stripe from 'stripe';

// Stripe instance - lazy loaded
let stripeInstance: Stripe | null = null;

// Check if Stripe is configured
export const isStripeConfigured = (): boolean => {
  return !!(process.env['STRIPE_SECRET_KEY'] && process.env['NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY']);
};

// Get Stripe instance (lazy initialization)
export const getStripe = (): Stripe => {
  if (!isStripeConfigured()) {
    throw new Error('Stripe is not configured. Please set STRIPE_SECRET_KEY and NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY environment variables.');
  }
  
  if (!stripeInstance) {
    stripeInstance = new Stripe(process.env['STRIPE_SECRET_KEY']!, {
      apiVersion: '2024-04-10', // Use stable API version
      typescript: true,
    });
  }
  
  return stripeInstance;
};

// Legacy export for backward compatibility (lazy loaded)
export const stripe = new Proxy({} as Stripe, {
  get(target, prop) {
    return getStripe()[prop as keyof Stripe];
  }
});

export const stripeConfig = {
  publishableKey: process.env['NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY'] || '',
  secretKey: process.env['STRIPE_SECRET_KEY'] || '',
  webhookSecret: process.env['STRIPE_WEBHOOK_SECRET'] || '',
  currency: 'eur',
  
  // Product pricing for EU market
  prices: {
    professional: {
      monthly: 'price_professional_monthly_eur', // Replace with actual Stripe price ID
      amount: 9999, // €99.99 in cents
    },
    enterprise: {
      monthly: 'price_enterprise_monthly_eur', // Replace with actual Stripe price ID  
      amount: 29999, // €299.99 in cents
    },
  },
  
  // EU-specific features
  features: {
    sepaDirectDebit: true,
    euVatCompliance: true,
    gdprCompliant: true,
  },
};

// Helper function to format amount for display
export const formatAmount = (amount: number): string => {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount / 100);
};

// Helper function to get price for tier
export const getPriceForTier = (tier: 'professional' | 'enterprise'): string => {
  if (!isStripeConfigured()) {
    throw new Error('Stripe is not configured. Cannot get price for tier.');
  }
  return stripeConfig.prices[tier].monthly;
};

// Helper function to get amount for tier
export const getAmountForTier = (tier: 'professional' | 'enterprise'): number => {
  return stripeConfig.prices[tier].amount;
};

// Helper function to safely check if payments are available
export const isPaymentsAvailable = (): boolean => {
  return isStripeConfigured();
};