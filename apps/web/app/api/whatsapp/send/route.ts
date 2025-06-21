import { NextRequest, NextResponse } from 'next/server';
import { getWhatsAppClient, WhatsAppAPIError } from '@/lib/whatsapp/client';

export async function POST(request: NextRequest) {
  console.log('WhatsApp send endpoint called');
  
  try {
    const body = await request.json();
    console.log('Request body:', body);
    
    const { to, message, type, bookingDetails, reminderDetails } = body;

    if (!to) {
      return NextResponse.json(
        { error: 'Phone number is required' },
        { status: 400 }
      );
    }

    console.log('Initializing WhatsApp client...');
    const whatsapp = getWhatsAppClient();
    let result;

    switch (type) {
      case 'text':
        if (!message) {
          return NextResponse.json(
            { error: 'Message is required for text type' },
            { status: 400 }
          );
        }
        result = await whatsapp.sendTextMessage(to, message);
        break;

      case 'booking':
        if (!bookingDetails) {
          return NextResponse.json(
            { error: 'Booking details are required for booking type' },
            { status: 400 }
          );
        }
        result = await whatsapp.sendBookingConfirmation(to, bookingDetails);
        break;

      case 'reminder':
        if (!reminderDetails) {
          return NextResponse.json(
            { error: 'Reminder details are required for reminder type' },
            { status: 400 }
          );
        }
        result = await whatsapp.sendAppointmentReminder(to, reminderDetails);
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid message type' },
          { status: 400 }
        );
    }

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
      { error: 'Failed to send WhatsApp message' },
      { status: 500 }
    );
  }
}