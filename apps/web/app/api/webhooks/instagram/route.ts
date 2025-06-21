import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import crypto from 'crypto';
import { config } from '@/lib/config';
import { getInstagramClient } from '@/lib/instagram/client';

// =============================================================================
// INSTAGRAM GRAPH API WEBHOOK HANDLER
// =============================================================================

interface InstagramWebhook {
  object: string;
  entry: Array<{
    id: string;
    time: number;
    changes?: Array<{
      value: {
        item: 'comment' | 'story';
        comment_id?: string;
        media_id?: string;
        text?: string;
        from?: {
          id: string;
          username: string;
        };
        parent_id?: string;
        created_time?: number;
      };
      field: string;
    }>;
    messaging?: Array<{
      sender: {
        id: string;
      };
      recipient: {
        id: string;
      };
      timestamp: number;
      message: {
        mid: string;
        text?: string;
        attachments?: Array<{
          type: 'image' | 'video';
          payload: {
            url: string;
          };
        }>;
      };
    }>;
  }>;
}

interface ProcessedInstagramEvent {
  type: 'comment' | 'dm' | 'mention';
  userId: string;
  username?: string;
  content: string;
  mediaId?: string;
  commentId?: string;
  threadId?: string;
  timestamp: number;
  platform: 'instagram';
}

// Webhook verification for GET requests
export function GET(request: NextRequest) {
  const url = new URL(request.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');

  console.log('Instagram webhook verification:', { mode, token, challenge });

  if (mode === 'subscribe' && token === config.INSTAGRAM_WEBHOOK_VERIFY_TOKEN) {
    console.log('Instagram webhook verified successfully');
    return new Response(challenge, { status: 200 });
  }

  console.error('Instagram webhook verification failed');
  return new Response('Forbidden', { status: 403 });
}

// Event processing for POST requests
export async function POST(request: NextRequest) {
  try {
    // 1. Verify webhook signature
    const signature = headers().get('x-hub-signature-256');
    const body = await request.text();
    
    if (!verifyInstagramSignature(body, signature)) {
      console.error('Invalid Instagram webhook signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // 2. Parse webhook payload
    const webhookData = JSON.parse(body) as InstagramWebhook;
    
    console.log('Instagram webhook received:', {
      object: webhookData.object,
      entryCount: webhookData.entry?.length || 0
    });

    // 3. Process each entry
    for (const entry of webhookData.entry || []) {
      await processInstagramEntry(entry);
    }

    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error('Error processing Instagram webhook:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// =============================================================================
// INSTAGRAM SIGNATURE VERIFICATION
// =============================================================================

function verifyInstagramSignature(payload: string, signature: string | null): boolean {
  if (!signature || !config.INSTAGRAM_APP_SECRET) {
    console.warn('Missing Instagram signature or app secret');
    return false;
  }

  try {
    const expectedSignature = crypto
      .createHmac('sha256', config.INSTAGRAM_APP_SECRET)
      .update(payload, 'utf8')
      .digest('hex');

    const receivedSignature = signature.replace('sha256=', '');
    
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(receivedSignature, 'hex')
    );
  } catch (error) {
    console.error('Error verifying Instagram signature:', error);
    return false;
  }
}

// =============================================================================
// INSTAGRAM EVENT PROCESSING
// =============================================================================

async function processInstagramEntry(entry: InstagramWebhook['entry'][0]) {
  try {
    // Process comment changes
    if (entry.changes) {
      for (const change of entry.changes) {
        if (change.field === 'comments' && change.value.item === 'comment') {
          await processCommentEvent(change.value);
        }
      }
    }

    // Process direct messages
    if (entry.messaging) {
      for (const message of entry.messaging) {
        await processDirectMessage(message);
      }
    }
  } catch (error) {
    console.error('Error processing Instagram entry:', error);
  }
}

async function processCommentEvent(commentData: any) {
  try {
    const instagramClient = getInstagramClient();
    
    const processedEvent: ProcessedInstagramEvent = {
      type: 'comment',
      userId: commentData.from?.id || 'unknown',
      username: commentData.from?.username,
      content: commentData.text || '',
      mediaId: commentData.media_id,
      commentId: commentData.comment_id,
      timestamp: commentData.created_time || Date.now(),
      platform: 'instagram'
    };

    console.log('Processing Instagram comment:', processedEvent);

    // Analyze comment for booking intent
    const analysis = await instagramClient.analyzeCommentForBookingIntent({
      id: processedEvent.commentId || '',
      text: processedEvent.content,
      username: processedEvent.username || '',
      timestamp: new Date(processedEvent.timestamp).toISOString(),
      media_id: processedEvent.mediaId || '',
      user_id: processedEvent.userId,
      like_count: 0,
      hidden: false
    });

    // If booking intent detected, respond appropriately
    if (analysis.hasBookingIntent && analysis.confidence > 0.6) {
      await instagramClient.replyToComment(
        processedEvent.commentId || '',
        analysis.suggestedResponse
      );

      // Trigger n8n workflow for Instagram booking intent
      await triggerN8nWorkflow('instagram-booking-intent', {
        ...processedEvent,
        analysis
      });
    }

    // Store event in database for analytics
    storeInstagramEvent(processedEvent, analysis);
  } catch (error) {
    console.error('Error processing comment event:', error);
  }
}

async function processDirectMessage(messageData: any) {
  try {
    const processedEvent: ProcessedInstagramEvent = {
      type: 'dm',
      userId: messageData.sender.id,
      content: messageData.message.text || '',
      threadId: `${messageData.sender.id}_${messageData.recipient.id}`,
      timestamp: messageData.timestamp * 1000, // Convert to milliseconds
      platform: 'instagram'
    };

    console.log('Processing Instagram DM:', processedEvent);

    // Trigger n8n workflow for DM processing
    await triggerN8nWorkflow('instagram-dm-received', processedEvent);

    // Store in database
    storeInstagramEvent(processedEvent);
  } catch (error) {
    console.error('Error processing direct message:', error);
  }
}

// =============================================================================
// N8N WORKFLOW INTEGRATION
// =============================================================================

async function triggerN8nWorkflow(workflowName: string, data: any) {
  try {
    const webhookUrl = `${config.N8N_WEBHOOK_URL}/webhook/${workflowName}`;
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'GeminiSalonAI-Instagram/1.0'
      },
      body: JSON.stringify({
        timestamp: Date.now(),
        platform: 'instagram',
        data
      })
    });

    if (!response.ok) {
      throw new Error(`n8n webhook failed: ${response.status} ${response.statusText}`);
    }

    console.log(`n8n workflow '${workflowName}' triggered successfully`);
  } catch (error) {
    console.error(`Error triggering n8n workflow '${workflowName}':`, error);
  }
}

// =============================================================================
// DATABASE INTEGRATION
// =============================================================================

function storeInstagramEvent(
  event: ProcessedInstagramEvent,
  analysis?: any
) {
  try {
    // This would integrate with Supabase to store Instagram events
    // Following the same pattern as WhatsApp message storage
    
    const eventData = {
      platform: 'instagram',
      event_type: event.type,
      user_id: event.userId,
      username: event.username,
      content: event.content,
      media_id: event.mediaId,
      comment_id: event.commentId,
      thread_id: event.threadId,
      timestamp: new Date(event.timestamp),
      analysis: analysis ? JSON.stringify(analysis) : null,
      processed_at: new Date()
    };

    // TODO: Insert into instagram_events table
    console.log('Storing Instagram event:', eventData);
  } catch (error) {
    console.error('Error storing Instagram event:', error);
  }
}

// =============================================================================
// HEALTH CHECK ENDPOINT
// =============================================================================

export async function HEAD() {
  try {
    const instagramClient = getInstagramClient();
    const healthCheck = await instagramClient.healthCheck();
    
    if (healthCheck.status === 'healthy') {
      return new Response(null, { status: 200 });
    } else {
      return new Response(null, { status: 503 });
    }
  } catch {
    return new Response(null, { status: 503 });
  }
}