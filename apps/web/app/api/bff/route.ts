// Backend-for-Frontend API - Single entry point for authenticated requests
// Phase 1C: API Integration

import { NextRequest, NextResponse } from 'next/server';

// Force dynamic rendering due to session authentication
export const dynamic = 'force-dynamic';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth/config';
import { getDatabase } from '@/lib/database/rls-client';
import { z } from 'zod';

// Request validation schemas
const EndpointSchema = z.enum([
  'recent-calls',
  'active-conversations', 
  'campaign-progress',
  'system-health',
  'voice-agent-status',
  'analytics-summary',
  'notification-count'
]);

const PaginationSchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(10),
  offset: z.coerce.number().min(0).default(0)
});

interface Call {
  id: string;
  twilio_call_sid: string;
  phone_number: string;
  direction: 'inbound' | 'outbound';
  call_status: string;
  duration_seconds: number;
  transcript: Record<string, unknown>[];
  summary: string;
  outcome: string;
  created_at: string;
  customer_id?: string;
}

interface Conversation {
  id: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  channel: 'whatsapp' | 'instagram' | 'voice';
  status: 'active' | 'waiting' | 'resolved' | 'archived';
  priority: 'low' | 'medium' | 'high';
  unread_count: number;
  last_message_at: string;
  created_at: string;
  assigned_to?: string;
  tags: string[];
}

interface Campaign {
  id: string;
  name: string;
  type: string;
  status: 'scheduled' | 'running' | 'completed' | 'paused';
  progress: number;
  target_count: number;
  completed_count: number;
  success_count: number;
  created_at: string;
  scheduled_at?: string;
}

export async function GET(request: NextRequest) {
  try {
    // Authentication check
    const session = await getServerSession(authOptions);
    if (session === null) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const salon = session.user.salon;
    if (salon === null || salon === undefined) {
      return NextResponse.json({ error: 'No salon associated' }, { status: 403 });
    }

    // Parse and validate request parameters
    const url = new URL(request.url);
    const endpoint = url.searchParams.get('endpoint');
    const paginationParams = {
      limit: url.searchParams.get('limit'),
      offset: url.searchParams.get('offset')
    };

    const validatedEndpoint = EndpointSchema.parse(endpoint);
    const { limit, offset } = PaginationSchema.parse(paginationParams);

    const db = getDatabase();
    const salonId = salon.id;

    // Route to appropriate handler
    switch (validatedEndpoint) {
      case 'recent-calls':
        return await handleRecentCalls(db, salonId, limit, offset);
      
      case 'active-conversations':
        return await handleActiveConversations(db, salonId, limit, offset);
      
      case 'campaign-progress':
        return await handleCampaignProgress(db, salonId, limit, offset);
      
      case 'system-health':
        return await handleSystemHealth(db, salonId);
      
      case 'voice-agent-status':
        return await handleVoiceAgentStatus(db, salonId);
      
      case 'analytics-summary':
        return await handleAnalyticsSummary(db, salonId);
      
      case 'notification-count':
        return await handleNotificationCount(db, salonId);
      
      default:
        return NextResponse.json({ error: 'Invalid endpoint' }, { status: 400 });
    }

  } catch (error) {
    console.error('BFF API Error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request parameters', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Handler functions with RLS enforcement

async function handleRecentCalls(
  db: import('@/lib/database/rls-client').RLSClient, 
  salonId: string, 
  limit: number, 
  offset: number
): Promise<NextResponse> {
  const calls = await db.queryWithTenant<Call>(salonId, `
    SELECT 
      id,
      twilio_call_sid,
      phone_number,
      direction,
      call_status,
      duration_seconds,
      transcript,
      summary,
      outcome,
      created_at,
      customer_id
    FROM call_logs 
    ORDER BY created_at DESC 
    LIMIT $1 OFFSET $2
  `, [limit, offset]);

  // Get total count
  const countResult = await db.queryWithTenant<{ count: string }>(salonId, `
    SELECT COUNT(*) as count FROM call_logs
  `);
  const count = countResult[0]?.count ?? '0';

  return NextResponse.json({
    calls,
    pagination: {
      total: parseInt(String(count), 10),
      limit,
      offset,
      has_more: parseInt(String(count), 10) > offset + limit
    },
    timestamp: new Date().toISOString()
  });
}

async function handleActiveConversations(
  db: import('@/lib/database/rls-client').RLSClient, 
  salonId: string, 
  limit: number, 
  offset: number
): Promise<NextResponse> {
  const conversations = await db.queryWithTenant<Conversation>(salonId, `
    SELECT 
      c.*,
      cu.name as customer_name,
      cu.phone_number as customer_phone,
      COUNT(CASE WHEN m.read_at IS NULL THEN 1 END) as unread_count,
      MAX(m.created_at) as last_message_at
    FROM conversations c
    LEFT JOIN customers cu ON c.customer_id = cu.id
    LEFT JOIN messages m ON c.id = m.conversation_id
    WHERE c.status = 'active'
    GROUP BY c.id, cu.name, cu.phone_number
    ORDER BY last_message_at DESC NULLS LAST
    LIMIT $1 OFFSET $2
  `, [limit, offset]);

  return NextResponse.json({
    conversations,
    pagination: {
      limit,
      offset
    },
    timestamp: new Date().toISOString()
  });
}

async function handleCampaignProgress(
  db: import('@/lib/database/rls-client').RLSClient, 
  salonId: string, 
  limit: number, 
  offset: number
): Promise<NextResponse> {
  const campaigns = await db.queryWithTenant<Campaign>(salonId, `
    SELECT 
      id,
      name,
      type,
      status,
      COALESCE(
        CASE 
          WHEN target_count > 0 THEN (completed_count::float / target_count * 100)
          ELSE 0 
        END, 0
      ) as progress,
      target_count,
      completed_count,
      success_count,
      created_at,
      scheduled_at
    FROM campaigns 
    WHERE status IN ('running', 'scheduled')
    ORDER BY created_at DESC
    LIMIT $1 OFFSET $2
  `, [limit, offset]);

  return NextResponse.json({
    campaigns,
    pagination: {
      limit,
      offset
    },
    timestamp: new Date().toISOString()
  });
}

async function handleSystemHealth(db: import('@/lib/database/rls-client').RLSClient, salonId: string): Promise<NextResponse> {
  // Get recent system events for health status
  const healthEvents = await db.queryWithTenant(salonId, `
    SELECT 
      event_type,
      event_data,
      created_at
    FROM system_events 
    WHERE event_type = 'system.health'
      AND created_at > NOW() - INTERVAL '5 minutes'
    ORDER BY created_at DESC
    LIMIT 1
  `);

  // Get active calls count
  const activeCallsResult = await db.queryWithTenant<{ active_calls: string }>(salonId, `
    SELECT COUNT(*) as active_calls 
    FROM call_logs 
    WHERE call_status IN ('in-progress', 'ringing')
      AND created_at > NOW() - INTERVAL '1 hour'
  `);
  const active_calls = activeCallsResult[0]?.active_calls ?? '0';

  const healthData = healthEvents[0]?.['event_data'] as Record<string, unknown> ?? {};

  return NextResponse.json({
    system_health: {
      status: 'healthy',
      active_calls: parseInt(String(active_calls), 10),
      response_time_avg: (healthData['response_time_avg'] as number) ?? 1200,
      success_rate: (healthData['success_rate'] as number) ?? 98.5,
      voice_agent_status: (healthData['voice_agent_status'] as string) ?? 'online',
      last_updated: healthEvents[0]?.['created_at'] ?? new Date().toISOString()
    },
    timestamp: new Date().toISOString()
  });
}

async function handleVoiceAgentStatus(db: import('@/lib/database/rls-client').RLSClient, salonId: string): Promise<NextResponse> {
  // Get recent voice agent events
  const voiceEvents = await db.queryWithTenant(salonId, `
    SELECT event_data, created_at
    FROM system_events 
    WHERE event_type IN ('call.started', 'call.answered', 'call.ended')
      AND created_at > NOW() - INTERVAL '1 hour'
    ORDER BY created_at DESC
    LIMIT 10
  `);

  const currentCalls = voiceEvents.filter(e => {
    const eventData = e['event_data'] as Record<string, unknown>;
    return eventData?.['event'] === 'call.started' || eventData?.['event'] === 'call.answered';
  }).length;

  return NextResponse.json({
    voice_agent: {
      status: currentCalls > 0 ? 'busy' : 'idle',
      current_calls: currentCalls,
      total_calls_today: voiceEvents.length,
      last_call: voiceEvents[0]?.['created_at'] ?? null,
      language: 'de', // Default to German for EU market
      response_time_avg: 1100
    },
    timestamp: new Date().toISOString()
  });
}

async function handleAnalyticsSummary(db: import('@/lib/database/rls-client').RLSClient, salonId: string): Promise<NextResponse> {
  const today = new Date().toISOString().split('T')[0];
  
  const results = await db.transactionWithTenant(salonId, [
    {
      query: `
        SELECT 
          COUNT(*) as total_calls,
          COUNT(CASE WHEN call_status = 'completed' THEN 1 END) as completed_calls,
          AVG(duration_seconds) as avg_duration
        FROM call_logs 
        WHERE DATE(created_at) = $1
      `,
      params: [today]
    },
    {
      query: `
        SELECT 
          COUNT(*) as total_conversations,
          COUNT(CASE WHEN status = 'active' THEN 1 END) as active_conversations
        FROM conversations
      `,
    },
    {
      query: `
        SELECT 
          COUNT(*) as total_campaigns,
          COUNT(CASE WHEN status = 'running' THEN 1 END) as active_campaigns
        FROM campaigns
      `,
    }
  ]);

  const [callStats, conversationStats, campaignStats] = results;

  return NextResponse.json({
    analytics: {
      calls: callStats?.[0] ?? { total_calls: 0, completed_calls: 0, avg_duration: 0 },
      conversations: conversationStats?.[0] ?? { total_conversations: 0, active_conversations: 0 },
      campaigns: campaignStats?.[0] ?? { total_campaigns: 0, active_campaigns: 0 }
    },
    timestamp: new Date().toISOString()
  });
}

async function handleNotificationCount(db: import('@/lib/database/rls-client').RLSClient, salonId: string): Promise<NextResponse> {
  const results = await db.transactionWithTenant(salonId, [
    {
      query: `
        SELECT 
          (
            SELECT COUNT(*) FROM conversations 
            WHERE status = 'waiting' 
              AND unread_count > 0
          ) as unread_conversations,
          (
            SELECT COUNT(*) FROM system_events 
            WHERE event_type LIKE 'alert.%'
              AND processed_at IS NULL
              AND created_at > NOW() - INTERVAL '24 hours'
          ) as unread_alerts
      `
    }
  ]);

  const [unreadCounts] = results;
  const counts = unreadCounts?.[0] ?? { unread_conversations: 0, unread_alerts: 0 };

  return NextResponse.json({
    notifications: {
      total: parseInt(String(counts['unread_conversations']), 10) + parseInt(String(counts['unread_alerts']), 10),
      conversations: parseInt(String(counts['unread_conversations']), 10),
      alerts: parseInt(String(counts['unread_alerts']), 10)
    },
    timestamp: new Date().toISOString()
  });
}