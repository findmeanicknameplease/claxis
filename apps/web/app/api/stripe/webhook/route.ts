import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { stripe, stripeConfig, isStripeConfigured } from '@/lib/stripe/config';
import Stripe from 'stripe';

// Disable Next.js body parsing for webhooks
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  // Check if Stripe is configured
  if (!isStripeConfigured()) {
    console.error('Stripe webhook called but Stripe is not configured');
    return NextResponse.json(
      { error: 'Stripe not configured' },
      { status: 503 }
    );
  }

  const body = await request.text();
  const signature = headers().get('stripe-signature');

  if (!signature) {
    console.error('No Stripe signature found');
    return NextResponse.json(
      { error: 'No signature found' },
      { status: 400 }
    );
  }

  if (!stripeConfig.webhookSecret) {
    console.error('Stripe webhook secret not configured');
    return NextResponse.json(
      { error: 'Webhook secret not configured' },
      { status: 500 }
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      stripeConfig.webhookSecret
    );
  } catch (error) {
    console.error('Webhook signature verification failed:', error);
    return NextResponse.json(
      { error: 'Webhook signature verification failed' },
      { status: 400 }
    );
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });

  } catch (error) {
    console.error('Error processing webhook:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  console.log('Checkout session completed:', session.id);
  
  try {
    // Get the subscription
    const subscription = await stripe.subscriptions.retrieve(
      session.subscription as string
    );
    
    // Get customer details
    const customer = await stripe.customers.retrieve(
      session.customer as string
    ) as Stripe.Customer;

    // TODO: Update salon subscription in database
    // const salonData = {
    //   customerId: customer.id,
    //   subscriptionId: subscription.id,
    //   tier: session.metadata?.tier || 'professional',
    //   status: subscription.status,
    //   currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    //   email: customer.email,
    // };
    
    // await updateSalonSubscription(salonData);
    
    console.log('Subscription activated for customer:', customer.email, 'subscription:', subscription.id);

  } catch (error) {
    console.error('Error handling checkout session completed:', error);
    throw error;
  }
}

async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  console.log('Subscription created:', subscription.id);
  
  try {
    // TODO: Update salon in database with subscription details
    // const subscriptionData = {
    //   subscriptionId: subscription.id,
    //   customerId: subscription.customer as string,
    //   status: subscription.status,
    //   tier: subscription.metadata.tier || 'professional',
    //   currentPeriodStart: new Date(subscription.current_period_start * 1000),
    //   currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    // };
    
    // await createOrUpdateSalonSubscription(subscriptionData);

  } catch (error) {
    console.error('Error handling subscription created:', error);
    throw error;
  }
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  console.log('Subscription updated:', subscription.id);
  
  try {
    // TODO: Update salon subscription status in database
    // const updateData = {
    //   subscriptionId: subscription.id,
    //   status: subscription.status,
    //   currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    //   cancelAtPeriodEnd: subscription.cancel_at_period_end,
    // };
    
    // await updateSalonSubscription(updateData);

  } catch (error) {
    console.error('Error handling subscription updated:', error);
    throw error;
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  console.log('Subscription deleted:', subscription.id);
  
  try {
    // TODO: Deactivate salon subscription in database
    // await deactivateSalonSubscription(subscription.id);

    // TODO: Send cancellation email to customer
    // await sendCancellationEmail(subscription.customer as string);

  } catch (error) {
    console.error('Error handling subscription deleted:', error);
    throw error;
  }
}

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  console.log('Invoice payment succeeded:', invoice.id);
  
  try {
    // TODO: Update payment status in database
    // const paymentData = {
    //   invoiceId: invoice.id,
    //   subscriptionId: invoice.subscription as string,
    //   amountPaid: invoice.amount_paid,
    //   currency: invoice.currency,
    //   paidAt: new Date(invoice.status_transitions.paid_at! * 1000),
    // };
    
    // await recordSuccessfulPayment(paymentData);

  } catch (error) {
    console.error('Error handling invoice payment succeeded:', error);
    throw error;
  }
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  console.log('Invoice payment failed:', invoice.id);
  
  try {
    // TODO: Handle failed payment
    // - Update payment status in database
    // - Send payment failure notification
    // - Implement retry logic or dunning management

    // await recordFailedPayment(invoice.id, invoice.subscription as string);
    // await sendPaymentFailureNotification(invoice.customer as string);

  } catch (error) {
    console.error('Error handling invoice payment failed:', error);
    throw error;
  }
}

// Handle preflight requests for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, stripe-signature',
    },
  });
}