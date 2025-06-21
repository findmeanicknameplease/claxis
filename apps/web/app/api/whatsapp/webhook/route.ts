import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

// Webhook verification endpoint (GET)
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  console.log('WhatsApp webhook verification request:', { mode, token, challenge });

  // Check if this is a valid verification request
  if (mode === 'subscribe' && token === process.env['WHATSAPP_WEBHOOK_VERIFY_TOKEN']) {
    console.log('Webhook verified successfully');
    return new NextResponse(challenge, { status: 200 });
  }

  console.log('Webhook verification failed');
  return NextResponse.json(
    { error: 'Verification failed' },
    { status: 403 }
  );
}

// Webhook event handler (POST)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('WhatsApp webhook event received:', JSON.stringify(body, null, 2));

    // Verify webhook signature
    const signature = request.headers.get('x-hub-signature-256');
    if (signature && process.env['WHATSAPP_APP_SECRET']) {
      const expectedSignature = crypto
        .createHmac('sha256', process.env['WHATSAPP_APP_SECRET'])
        .update(JSON.stringify(body))
        .digest('hex');
      
      if (signature !== `sha256=${expectedSignature}`) {
        console.error('Invalid webhook signature');
        return NextResponse.json(
          { error: 'Invalid signature' },
          { status: 401 }
        );
      }
    }

    // Process different types of webhook events
    if (body.entry && body.entry.length > 0) {
      for (const entry of body.entry) {
        const changes = entry.changes || [];
        
        for (const change of changes) {
          const value = change.value;
          
          // Handle incoming messages
          if (value.messages) {
            for (const message of value.messages) {
              console.log('Incoming message:', {
                from: message.from,
                type: message.type,
                text: message.text?.body,
                timestamp: new Date(parseInt(message.timestamp) * 1000).toISOString()
              });
              
              // TODO: Store message in database
              // TODO: Trigger automation workflows
            }
          }
          
          // Handle message status updates
          if (value.statuses) {
            for (const status of value.statuses) {
              console.log('Message status update:', {
                messageId: status.id,
                recipientId: status.recipient_id,
                status: status.status,
                timestamp: new Date(parseInt(status.timestamp) * 1000).toISOString()
              });
              
              // TODO: Update message status in database
            }
          }
        }
      }
    }

    // Always return 200 OK to acknowledge receipt
    return NextResponse.json({ received: true }, { status: 200 });

  } catch (error) {
    console.error('Webhook processing error:', error);
    // Still return 200 to prevent WhatsApp from retrying
    return NextResponse.json({ received: true }, { status: 200 });
  }
}