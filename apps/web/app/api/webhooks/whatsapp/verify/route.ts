import { NextRequest, NextResponse } from 'next/server';
import { config } from '@/lib/config';

// =============================================================================
// PREMIUM SAAS WHATSAPP WEBHOOK VERIFICATION ENDPOINT
// =============================================================================
// Production-ready webhook verification for Meta WhatsApp Business API
// EU-compliant with Frankfurt region deployment (€299.99/month tier)
// Enterprise security with token verification and audit logging
// =============================================================================

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const searchParams = request.nextUrl.searchParams;
  
  // Extract Meta's webhook verification parameters
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');
  
  // Get client info for security auditing
  const clientIp = request.headers.get('x-forwarded-for') || 
                   request.headers.get('x-real-ip') || 
                   'unknown';
  const userAgent = request.headers.get('user-agent') || 'unknown';

  console.log('🔐 WhatsApp webhook verification attempt:', {
    mode,
    token: token ? '***REDACTED***' : 'missing',
    challenge: challenge ? 'provided' : 'missing',
    clientIp: clientIp.replace(/\d+$/, '***'), // Mask last IP octet for privacy
    userAgent: userAgent.substring(0, 100), // Limit user agent length
    timestamp: new Date().toISOString(),
    region: 'eu-central-1'
  });

  // Validate required parameters
  if (!mode || !token || !challenge) {
    const missingParams = [];
    if (!mode) missingParams.push('hub.mode');
    if (!token) missingParams.push('hub.verify_token');
    if (!challenge) missingParams.push('hub.challenge');
    
    console.error('❌ WhatsApp verification failed - missing parameters:', {
      missing: missingParams,
      clientIp: clientIp.replace(/\d+$/, '***'),
      processingTime: Date.now() - startTime
    });

    return NextResponse.json(
      { 
        error: 'Missing required parameters',
        missing: missingParams,
        message: 'hub.mode, hub.verify_token, and hub.challenge are required'
      },
      { status: 400 }
    );
  }

  // Verify webhook subscription with enterprise security
  if (mode === 'subscribe' && token === config.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
    console.log('✅ WhatsApp webhook verification successful:', {
      mode,
      clientIp: clientIp.replace(/\d+$/, '***'),
      processingTime: Date.now() - startTime,
      region: 'eu-central-1',
      tier: 'premium'
    });
    
    // Return the challenge token to confirm subscription
    return new NextResponse(challenge, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Webhook-Status': 'verified',
        'X-Region': 'eu-central-1',
        'X-Tier': 'premium',
        'X-Processing-Time': `${Date.now() - startTime}ms`
      }
    });
  }

  // Security incident logging for failed attempts
  console.error('🚨 WhatsApp webhook verification FAILED:', {
    mode,
    tokenMatch: token === config.WHATSAPP_WEBHOOK_VERIFY_TOKEN,
    tokenConfigured: !!config.WHATSAPP_WEBHOOK_VERIFY_TOKEN,
    tokenLength: token?.length || 0,
    clientIp: clientIp.replace(/\d+$/, '***'),
    userAgent: userAgent.substring(0, 50),
    processingTime: Date.now() - startTime,
    timestamp: new Date().toISOString()
  });

  return NextResponse.json(
    { 
      error: 'Webhook verification failed',
      message: 'Invalid verify token or subscription mode',
      timestamp: new Date().toISOString()
    },
    { 
      status: 403,
      headers: {
        'X-Region': 'eu-central-1',
        'X-Processing-Time': `${Date.now() - startTime}ms`
      }
    }
  );
}

// Handle POST requests (should not happen on verify endpoint)
export async function POST(request: NextRequest) {
  const clientIp = request.headers.get('x-forwarded-for') || 
                   request.headers.get('x-real-ip') || 
                   'unknown';
  
  console.warn('🚨 POST request received on verification endpoint:', {
    clientIp: clientIp.replace(/\d+$/, '***'),
    userAgent: request.headers.get('user-agent')?.substring(0, 50) || 'unknown',
    timestamp: new Date().toISOString(),
    region: 'eu-central-1'
  });
  
  return NextResponse.json({
    error: 'Invalid endpoint for webhook messages',
    message: 'Use /api/webhooks/whatsapp for message handling',
    correctEndpoint: '/api/webhooks/whatsapp',
    timestamp: new Date().toISOString()
  }, { 
    status: 400,
    headers: {
      'X-Region': 'eu-central-1',
      'X-Tier': 'premium'
    }
  });
}

// Health check endpoint for webhook verification status
export async function HEAD() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'X-Webhook-Status': 'active',
      'X-Region': 'eu-central-1',
      'X-Tier': 'premium',
      'X-Service': 'whatsapp-webhook-verification'
    }
  });
}