import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth/config';
import { stripe, getPriceForTier, isStripeConfigured } from '@/lib/stripe/config';
import { findOrCreateStripeCustomer } from '@/lib/stripe/customer-utils';
import { z } from 'zod';

const createCheckoutSessionSchema = z.object({
  tier: z.enum(['professional', 'enterprise']),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
  salonData: z.object({
    businessName: z.string(),
    ownerName: z.string(), 
    email: z.string().email(),
    phone: z.string(),
    location: z.string().optional(),
  }).optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Check if Stripe is configured
    if (!isStripeConfigured()) {
      return NextResponse.json(
        { error: 'Payments are not currently available. Please contact support.' },
        { status: 503 }
      );
    }

    const session = await getServerSession(authOptions);
    
    // For now, allow non-authenticated users to create checkout sessions
    // In production, you might want to require authentication
    
    const body = await request.json();
    const validatedData = createCheckoutSessionSchema.parse(body);
    
    const { tier, successUrl, cancelUrl, salonData } = validatedData;
    
    // Get customer email
    const customerEmail = session?.user?.email || salonData?.email;
    
    if (!customerEmail) {
      return NextResponse.json(
        { error: 'Customer email is required' },
        { status: 400 }
      );
    }

    // Create or retrieve customer using centralized utility
    const customer = await findOrCreateStripeCustomer(customerEmail, {
      businessName: salonData?.businessName || '',
      phone: salonData?.phone || '',
      location: salonData?.location || '',
      tier: tier,
      source: 'claxis_onboarding',
    });

    // Create checkout session
    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customer.id,
      payment_method_types: ['card', 'sepa_debit'], // EU payment methods
      line_items: [
        {
          price: getPriceForTier(tier),
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      subscription_data: {
        metadata: {
          tier: tier,
          businessName: salonData?.businessName || '',
          salonId: session?.user?.salon?.id || '',
        },
      },
      customer_update: {
        address: 'auto',
        name: 'auto',
      },
      tax_id_collection: {
        enabled: true, // EU VAT compliance
      },
      automatic_tax: {
        enabled: true, // Automatic EU VAT calculation
      },
      billing_address_collection: 'required',
      locale: 'auto', // Localize for EU markets
      metadata: {
        tier: tier,
        businessName: salonData?.businessName || '',
        source: 'claxis_onboarding',
      },
    });

    return NextResponse.json({
      sessionId: checkoutSession.id,
      url: checkoutSession.url,
    });

  } catch (error) {
    console.error('Error creating checkout session:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Handle preflight requests for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}