import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import crypto from 'crypto';
import { config } from '@/lib/config';

// =============================================================================
// WHATSAPP MESSAGE STATUS WEBHOOK HANDLER  
// =============================================================================

interface WhatsAppStatusUpdate {
  object: string;
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product: string;
        metadata: {
          display_phone_number: string;
          phone_number_id: string;
        };
        statuses: Array<{
          id: string; // message_id
          status: 'sent' | 'delivered' | 'read' | 'failed';
          timestamp: string;
          recipient_id: string;
          conversation?: {
            id: string;
            origin: {
              type: string;
            };
          };
          pricing?: {
            billable: boolean;
            pricing_model: string;
            category: string;
          };
          errors?: Array<{
            code: number;
            title: string;
            message: string;
            error_data?: {
              details: string;
            };
          }>;
        }>;
      };
      field: string;
    }>;
  }>;
}

/**
 * Handle WhatsApp message status updates
 * These include delivery confirmations, read receipts, and failure notifications
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Verify webhook signature
    const signature = headers().get('x-hub-signature-256');
    const body = await request.text();
    
    if (!verifyWhatsAppSignature(body, signature)) {
      console.error('Invalid WhatsApp status webhook signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // 2. Parse status update
    const statusUpdate: WhatsAppStatusUpdate = JSON.parse(body);
    
    console.log('WhatsApp status webhook received:', {
      object: statusUpdate.object,
      entries: statusUpdate.entry?.length || 0,
      timestamp: new Date().toISOString()
    });

    // 3. Process each status update
    const statusUpdatePromises = [];
    
    for (const entry of statusUpdate.entry || []) {
      for (const change of entry.changes || []) {
        if (change.field === 'messages' && change.value.statuses) {
          for (const status of change.value.statuses) {
            statusUpdatePromises.push(
              processMessageStatus(status, change.value.metadata)
            );
          }
        }
      }
    }

    // Process all status updates concurrently
    await Promise.allSettled(statusUpdatePromises);

    return NextResponse.json({ status: 'success' });
    
  } catch (error) {
    console.error('WhatsApp status webhook error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// =============================================================================
// STATUS PROCESSING FUNCTIONS
// =============================================================================

async function processMessageStatus(
  status: any,
  metadata: any
): Promise<void> {
  console.log('Processing WhatsApp message status:', {
    message_id: status.id,
    status: status.status,
    recipient: status.recipient_id,
    timestamp: status.timestamp,
    phone_number_id: metadata.phone_number_id
  });

  try {
    // Update message tracking in database
    updateMessageTrackingStatus(status.id, {
      status: status.status,
      timestamp: status.timestamp,
      recipient_id: status.recipient_id,
      conversation_id: status.conversation?.id,
      pricing: status.pricing,
      errors: status.errors,
      phone_number_id: metadata.phone_number_id
    });

    // Handle specific status types
    switch (status.status) {
      case 'delivered':
        await handleMessageDelivered(status);
        break;
      case 'read':
        await handleMessageRead(status);
        break;
      case 'failed':
        await handleMessageFailed(status);
        break;
      case 'sent':
        handleMessageSent(status);
        break;
    }

  } catch (error) {
    console.error(`Error processing WhatsApp status ${status.status}:`, error);
  }
}

async function handleMessageDelivered(status: any): Promise<void> {
  console.log(`Message ${status.id} delivered to ${status.recipient_id}`);
  
  // Trigger n8n workflow for delivery tracking
  await triggerN8nWorkflow('message-delivered', {
    message_id: status.id,
    recipient_id: status.recipient_id,
    timestamp: status.timestamp
  });
}

async function handleMessageRead(status: any): Promise<void> {
  console.log(`Message ${status.id} read by ${status.recipient_id}`);
  
  // Trigger read receipt processing workflow
  await triggerN8nWorkflow('message-read-receipt', {
    message_id: status.id,
    recipient_id: status.recipient_id,
    timestamp: status.timestamp,
    conversation_id: status.conversation?.id
  });

  // Update booking confirmation status if applicable
  checkAndUpdateBookingConfirmation(status.id);
}

async function handleMessageFailed(status: any): Promise<void> {
  console.error(`Message ${status.id} failed:`, status.errors);
  
  // Trigger failure handling workflow
  await triggerN8nWorkflow('message-delivery-failed', {
    message_id: status.id,
    recipient_id: status.recipient_id,
    errors: status.errors,
    timestamp: status.timestamp
  });

  // Log failure for analytics
  logMessageFailure(status);
}

function handleMessageSent(status: any): void {
  console.log(`Message ${status.id} sent to ${status.recipient_id}`);
  
  // Update send timestamp in tracking
  updateMessageSentTimestamp(status.id);
}

// =============================================================================
// DATABASE OPERATIONS
// =============================================================================

function updateMessageTrackingStatus(
  messageId: string, 
  statusData: any
): void {
  // TODO: Integrate with Supabase database
  console.log('Updating message tracking:', { messageId, statusData });
  
  // Example implementation:
  // const supabase = createClient();
  // 
  // const updateData: any = {
  //   updated_at: new Date().toISOString()
  // };
  //
  // switch (statusData.status) {
  //   case 'delivered':
  //     updateData.status = 'delivered';
  //     updateData.delivered_at = new Date(parseInt(statusData.timestamp) * 1000);
  //     break;
  //   case 'read':
  //     updateData.status = 'read';
  //     updateData.read_at = new Date(parseInt(statusData.timestamp) * 1000);
  //     break;
  //   case 'failed':
  //     updateData.status = 'failed';
  //     updateData.error_details = statusData.errors;
  //     break;
  //   case 'sent':
  //     updateData.status = 'sent';
  //     updateData.sent_at = new Date(parseInt(statusData.timestamp) * 1000);
  //     break;
  // }
  //
  // await supabase
  //   .from('whatsapp_message_tracking')
  //   .update(updateData)
  //   .eq('message_id', messageId);
}

function checkAndUpdateBookingConfirmation(messageId: string): void {
  // TODO: Check if this message is a booking confirmation and update booking status
  console.log('Checking booking confirmation for message:', messageId);
  
  // Example implementation:
  // const supabase = createClient();
  // 
  // const { data: messageTracking } = await supabase
  //   .from('whatsapp_message_tracking')
  //   .select('booking_id, message_type')
  //   .eq('message_id', messageId)
  //   .eq('message_type', 'booking_confirmation')
  //   .single();
  //
  // if (messageTracking?.booking_id) {
  //   await supabase
  //     .from('bookings')
  //     .update({
  //       confirmation_read: true,
  //       last_engagement_at: new Date(),
  //       no_show_risk_score: Math.max(0, booking.no_show_risk_score - 20) // Lower risk when confirmation is read
  //     })
  //     .eq('id', messageTracking.booking_id);
  // }
}

function updateMessageSentTimestamp(messageId: string): void {
  console.log('Updating sent timestamp for message:', messageId);
  
  // TODO: Update database with sent timestamp
}

function logMessageFailure(status: any): void {
  console.log('Logging message failure:', status);
  
  // TODO: Store failure analytics
  // Track failure reasons, recipient patterns, etc.
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function verifyWhatsAppSignature(payload: string, signature: string | null): boolean {
  if (!signature || !config.WHATSAPP_APP_SECRET) {
    console.warn('Missing signature or app secret for verification');
    return false;
  }

  const expectedSignature = `sha256=${crypto
    .createHmac('sha256', config.WHATSAPP_APP_SECRET)
    .update(payload)
    .digest('hex')}`;

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

async function triggerN8nWorkflow(workflowName: string, data: any): Promise<void> {
  if (!config.N8N_WEBHOOK_URL) {
    console.warn('N8N_WEBHOOK_URL not configured, skipping workflow trigger');
    return;
  }

  try {
    const response = await fetch(`${config.N8N_WEBHOOK_URL}/${workflowName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.N8N_API_KEY || ''}`
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    console.log(`✅ n8n workflow ${workflowName} triggered successfully`);

  } catch (error) {
    console.error(`❌ Error triggering n8n workflow ${workflowName}:`, error);
  }
}

// GET method not allowed for status updates
export function GET() {
  return NextResponse.json({
    error: 'Method not allowed',
    message: 'Status updates must use POST method'
  }, { status: 405 });
}