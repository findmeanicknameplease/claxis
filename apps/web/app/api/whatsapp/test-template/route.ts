import { NextRequest, NextResponse } from 'next/server';
import { getWhatsAppClient, WhatsAppAPIError } from '@/lib/whatsapp/client';

export async function POST(request: NextRequest) {
  console.log('WhatsApp test template endpoint called');
  
  try {
    const body = await request.json();
    console.log('Request body:', body);
    
    const { to } = body;

    if (!to) {
      return NextResponse.json(
        { error: 'Phone number is required' },
        { status: 400 }
      );
    }

    console.log('Sending hello_world template to:', to);
    const whatsapp = getWhatsAppClient();
    
    // Use the hello_world template which is pre-approved by WhatsApp
    const result = await whatsapp.sendTemplateMessage(
      to,
      'hello_world',
      'en_US'
    );

    console.log('WhatsApp API response:', result);
    
    return NextResponse.json({
      success: true,
      messageId: result.messages[0]?.id,
      to: result.contacts[0]?.wa_id,
    });

  } catch (error) {
    console.error('WhatsApp API error:', error);
    console.error('Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });

    if (error instanceof WhatsAppAPIError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          type: error.type,
          details: error.details
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to send WhatsApp template message' },
      { status: 500 }
    );
  }
}