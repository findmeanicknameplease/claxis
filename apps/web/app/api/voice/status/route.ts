import { NextRequest, NextResponse } from 'next/server';
import { getTwilioVoiceClient } from '@/lib/voice/twilio-voice-client';
import { getUpstashClient } from '@/lib/redis/upstash-client';
import crypto from 'crypto';
import { config } from '@/lib/config';

// =============================================================================
// VOICE CALL STATUS WEBHOOK - ENTERPRISE CALL TRACKING
// =============================================================================
// Handles Twilio call status updates for premium voice agent
// Tracks call lifecycle, costs, and analytics for business intelligence
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    console.log('Voice status webhook received');

    // Verify Twilio signature
    const signature = request.headers.get('X-Twilio-Signature');
    const isValid = await verifyTwilioSignature(request, signature);
    
    if (!isValid) {
      console.warn('Invalid Twilio signature for voice status webhook');
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Parse status update data
    const formData = await request.formData();
    const callSid = formData.get('CallSid') as string;
    const callStatus = formData.get('CallStatus') as string;
    const callDuration = formData.get('CallDuration') as string;
    const from = formData.get('From') as string;
    const to = formData.get('To') as string;
    const direction = formData.get('Direction') as string;
    
    // Additional cost and quality metrics
    const price = formData.get('Price') as string;
    const priceUnit = formData.get('PriceUnit') as string;
    const callbackReason = formData.get('CallbackReason') as string;
    
    // Call quality metrics (if available)
    const mosScore = formData.get('MOS') as string;
    const jitter = formData.get('Jitter') as string;
    const rtt = formData.get('RTT') as string;

    console.log(`Call ${callSid} status update: ${callStatus} (duration: ${callDuration}s)`);

    // Get Twilio client and update call status
    const twilioClient = getTwilioVoiceClient();
    
    await twilioClient.handleCallStatusUpdate(
      callSid,
      callStatus,
      callDuration,
      {
        from,
        to,
        direction,
        price,
        priceUnit,
        callbackReason,
        mosScore,
        jitter,
        rtt,
      }
    );

    // Track detailed call analytics
    await trackCallAnalytics(callSid, {
      status: callStatus,
      duration: callDuration ? parseInt(callDuration) : 0,
      from,
      to,
      direction,
      price: price ? parseFloat(price) : 0,
      priceUnit,
      quality: {
        mosScore: mosScore ? parseFloat(mosScore) : null,
        jitter: jitter ? parseFloat(jitter) : null,
        rtt: rtt ? parseFloat(rtt) : null,
      },
      timestamp: new Date().toISOString(),
    });

    return new NextResponse('OK', { status: 200 });

  } catch (error) {
    console.error('Error handling voice status update:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

async function trackCallAnalytics(callSid: string, analytics: any) {
  try {
    const redis = getUpstashClient();
    
    // Store call analytics
    await redis.set(
      `voice:analytics:${callSid}`,
      JSON.stringify(analytics),
      { ex: 86400 } // 24 hours
    );

    // Update daily aggregates
    const today = new Date().toISOString().split('T')[0];
    
    // Total calls
    await redis.incr(`voice:stats:${today}:total_calls`);
    
    // Status-specific counters
    await redis.incr(`voice:stats:${today}:status:${analytics.status}`);
    
    // Direction-specific counters
    await redis.incr(`voice:stats:${today}:direction:${analytics.direction}`);
    
    // Duration aggregation
    if (analytics.duration > 0) {
      await redis.lpush(`voice:stats:${today}:durations`, analytics.duration.toString());
      await redis.ltrim(`voice:stats:${today}:durations`, 0, 999); // Keep last 1000
    }
    
    // Cost aggregation
    if (analytics.price > 0) {
      await redis.incrbyfloat(`voice:stats:${today}:total_cost`, analytics.price);
    }
    
    // Quality metrics
    if (analytics.quality.mosScore) {
      await redis.lpush(`voice:stats:${today}:mos_scores`, analytics.quality.mosScore.toString());
      await redis.ltrim(`voice:stats:${today}:mos_scores`, 0, 999);
    }

    console.log(`Call analytics tracked for ${callSid}: ${analytics.status}`);

  } catch (error) {
    console.error('Error tracking call analytics:', error);
  }
}

async function verifyTwilioSignature(
  request: NextRequest,
  signature: string | null
): Promise<boolean> {
  if (!signature) return false;

  try {
    const url = request.url;
    const body = await request.text();
    const authToken = config.WHATSAPP_APP_SECRET || process.env['TWILIO_AUTH_TOKEN'] || '';
    
    if (!authToken) return false;

    const expectedSignature = crypto
      .createHmac('sha1', authToken)
      .update(url + body)
      .digest('base64');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );

  } catch (error) {
    console.error('Error verifying Twilio signature:', error);
    return false;
  }
}

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