import { NextRequest, NextResponse } from 'next/server';
import { getTwilioVoiceClient } from '@/lib/voice/twilio-voice-client';
import { config } from '@/lib/config';
import crypto from 'crypto';

// =============================================================================
// VOICE INCOMING WEBHOOK - ENTERPRISE CALL HANDLER
// =============================================================================
// Twilio webhook for incoming voice calls to premium voice agent
// Handles spam protection, business hours, and AI conversation routing
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    console.log('Voice incoming webhook received');

    // Verify Twilio signature for security
    const signature = request.headers.get('X-Twilio-Signature');
    const isValid = await verifyTwilioSignature(request, signature);
    
    if (!isValid) {
      console.warn('Invalid Twilio signature for voice webhook');
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Parse Twilio form data
    const formData = await request.formData();
    const callSid = formData.get('CallSid') as string;
    const from = formData.get('From') as string;
    const to = formData.get('To') as string;
    const callStatus = formData.get('CallStatus') as string;
    const accountSid = formData.get('AccountSid') as string;

    // Additional optional parameters
    const callerName = formData.get('CallerName') as string || '';
    const callerCity = formData.get('CallerCity') as string || '';
    const callerState = formData.get('CallerState') as string || '';
    const callerCountry = formData.get('CallerCountry') as string || '';

    console.log(`Incoming call: ${callSid} from ${from} to ${to} (status: ${callStatus})`);

    // Get Twilio Voice client
    const twilioClient = getTwilioVoiceClient();

    // Handle the incoming call and generate TwiML response
    const twimlResponse = await twilioClient.handleIncomingCall(
      callSid,
      from,
      to,
      {
        callerName,
        callerCity,
        callerState,
        callerCountry,
        accountSid,
      }
    );

    // Return TwiML response
    return new NextResponse(twimlResponse.toString(), {
      status: 200,
      headers: {
        'Content-Type': 'application/xml',
      },
    });

  } catch (error) {
    console.error('Error handling incoming voice call:', error);
    
    // Return error TwiML response
    const errorTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice" language="de-DE">
    Es tut uns leid, es ist ein technischer Fehler aufgetreten. Bitte versuchen Sie es später erneut.
  </Say>
  <Hangup/>
</Response>`;

    return new NextResponse(errorTwiml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml',
      },
    });
  }
}

// Verify Twilio webhook signature for security
async function verifyTwilioSignature(
  request: NextRequest,
  signature: string | null
): Promise<boolean> {
  if (!signature) {
    console.warn('No Twilio signature provided');
    return false;
  }

  try {
    // Get the webhook URL
    const url = request.url;
    
    // Get the request body as form data
    const body = await request.text();

    // Use Twilio auth token as the webhook secret
    const authToken = config.WHATSAPP_APP_SECRET || process.env['TWILIO_AUTH_TOKEN'] || '';
    
    if (!authToken) {
      console.warn('No Twilio auth token configured');
      return false;
    }

    // Create the expected signature
    const expectedSignature = crypto
      .createHmac('sha1', authToken)
      .update(url + body)
      .digest('base64');

    // Compare signatures using timing-safe comparison
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );

  } catch (error) {
    console.error('Error verifying Twilio signature:', error);
    return false;
  }
}

// Handle preflight requests
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Twilio-Signature',
    },
  });
}