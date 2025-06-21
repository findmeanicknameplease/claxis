import { NextRequest, NextResponse } from 'next/server';

// Force dynamic rendering due to session authentication
export const dynamic = 'force-dynamic';

import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth/config';

// Mock conversations data - replace with actual Supabase queries
const mockConversations = [
  {
    id: 'conv_001',
    customerId: 'cust_001',
    customerName: 'Sarah Mueller',
    customerPhone: '+49 30 12345678',
    channel: 'whatsapp',
    status: 'active',
    priority: 'medium',
    assignedTo: 'Maria',
    tags: ['regular-customer', 'facial-treatments'],
    lastMessage: {
      id: 'msg_001',
      conversationId: 'conv_001',
      content: 'Hi, I would like to book a premium facial treatment for next week. Do you have availability on Tuesday afternoon?',
      type: 'text',
      direction: 'inbound',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
      status: 'delivered',
      channel: 'whatsapp',
      metadata: {
        sentiment: 'positive',
        aiConfidence: 0.85,
      }
    },
    unreadCount: 1,
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    sentiment: 'positive',
    bookingIntent: {
      confidence: 0.92,
      serviceType: 'Premium Facial',
      preferredDateTime: new Date('2024-12-28T14:00:00'),
      extractedInfo: {
        service: 'premium facial treatment',
        timeframe: 'next week',
        preference: 'Tuesday afternoon'
      }
    }
  },
  {
    id: 'conv_002',
    customerId: 'cust_002', 
    customerName: 'Anna Kowalski',
    customerPhone: '+49 30 87654321',
    channel: 'instagram',
    status: 'waiting',
    priority: 'high',
    tags: ['new-customer', 'hair-services'],
    lastMessage: {
      id: 'msg_002',
      conversationId: 'conv_002',
      content: 'Could you please tell me more about your hair coloring services and prices?',
      type: 'text',
      direction: 'inbound',
      timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000),
      status: 'delivered',
      channel: 'instagram',
      metadata: {
        sentiment: 'neutral',
        aiConfidence: 0.78,
      }
    },
    unreadCount: 2,
    createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
    sentiment: 'neutral',
    bookingIntent: {
      confidence: 0.65,
      serviceType: 'Hair Coloring',
      extractedInfo: {
        service: 'hair coloring services',
        inquiry: 'prices and information'
      }
    }
  },
  {
    id: 'conv_003',
    customerId: 'cust_003',
    customerName: 'Emma Fischer',
    customerPhone: '+49 30 11223344',
    channel: 'voice',
    status: 'resolved',
    priority: 'low',
    assignedTo: 'Julia',
    tags: ['vip-customer', 'manicure'],
    lastMessage: {
      id: 'msg_003',
      conversationId: 'conv_003',
      content: 'Thank you for confirming my appointment. See you on Friday!',
      type: 'text',
      direction: 'outbound',
      timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
      status: 'read',
      channel: 'voice',
      metadata: {
        sentiment: 'positive',
        aiConfidence: 0.95,
      }
    },
    unreadCount: 0,
    createdAt: new Date(Date.now() - 72 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    sentiment: 'positive'
  },
];

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const salon = session.user.salon;
    if (!salon) {
      return NextResponse.json({ error: 'No salon associated' }, { status: 403 });
    }

    const url = new URL(request.url);
    const channel = url.searchParams.get('channel');
    const status = url.searchParams.get('status');
    const priority = url.searchParams.get('priority');
    const assignedTo = url.searchParams.get('assignedTo');
    const hasUnread = url.searchParams.get('hasUnread') === 'true';
    const search = url.searchParams.get('search');

    // Apply filters
    let filteredConversations = [...mockConversations];

    if (channel && channel !== 'all') {
      filteredConversations = filteredConversations.filter(c => c.channel === channel);
    }

    if (status && status !== 'all') {
      filteredConversations = filteredConversations.filter(c => c.status === status);
    }

    if (priority && priority !== 'all') {
      filteredConversations = filteredConversations.filter(c => c.priority === priority);
    }

    if (assignedTo && assignedTo !== 'all') {
      if (assignedTo === 'unassigned') {
        filteredConversations = filteredConversations.filter(c => !c.assignedTo);
      } else {
        filteredConversations = filteredConversations.filter(c => c.assignedTo === assignedTo);
      }
    }

    if (hasUnread) {
      filteredConversations = filteredConversations.filter(c => c.unreadCount > 0);
    }

    if (search) {
      const searchLower = search.toLowerCase();
      filteredConversations = filteredConversations.filter(c =>
        c.customerName.toLowerCase().includes(searchLower) ||
        c.lastMessage.content.toLowerCase().includes(searchLower)
      );
    }

    // Sort by last update (most recent first)
    filteredConversations.sort((a, b) => 
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );

    // TODO: Replace with actual Supabase query
    // const { data, error } = await supabase
    //   .from('conversations')
    //   .select(`
    //     *,
    //     customer:customers(*),
    //     last_message:messages(*)
    //   `)
    //   .eq('salon_id', salon.id)
    //   .order('updated_at', { ascending: false });

    return NextResponse.json({
      conversations: filteredConversations,
      total: filteredConversations.length,
    });
    
  } catch (error) {
    console.error('Failed to fetch conversations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch conversations' },
      { status: 500 }
    );
  }
}