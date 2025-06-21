import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth/config';
import { stripe, isStripeConfigured } from '@/lib/stripe/config';
import { getValidatedStripeCustomer, CustomerNotFoundError } from '@/lib/stripe/customer-utils';
import { z } from 'zod';

const billingPortalSchema = z.object({
  returnUrl: z.string().url(),
});

export async function POST(request: NextRequest) {
  try {
    // Check if Stripe is configured
    if (!isStripeConfigured()) {
      return NextResponse.json(
        { error: 'Billing portal is not currently available. Please contact support.' },
        { status: 503 }
      );
    }

    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { returnUrl } = billingPortalSchema.parse(body);

    // Find customer using centralized utility
    const customer = await getValidatedStripeCustomer(session.user.email);

    // Create billing portal session
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customer.id,
      return_url: returnUrl,
      locale: 'auto', // Auto-detect locale for EU markets
    });

    return NextResponse.json({
      url: portalSession.url,
    });

  } catch (error) {
    console.error('Error creating billing portal session:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }
    
    if (error instanceof CustomerNotFoundError) {
      return NextResponse.json(
        { error: 'No subscription found for this account' },
        { status: 404 }
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