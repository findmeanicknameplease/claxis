import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth/config';

// Mock data for development - replace with actual Supabase queries
const mockMetrics = {
  callsThisHour: 8,
  callsToday: 47,
  callsThisWeek: 312,
  avgResponseTime: 1200,
  successRate: 98.5,
  spamBlocked: 23,
  busyHours: [
    { hour: 9, count: 12 },
    { hour: 10, count: 18 },
    { hour: 11, count: 15 },
    { hour: 14, count: 22 },
    { hour: 15, count: 19 },
    { hour: 16, count: 16 },
  ],
};

// Force deployment refresh - parameter is intentionally unused
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const salon = session.user.salon;
    if (!salon || salon.subscription_tier !== 'enterprise') {
      return NextResponse.json({ error: 'Enterprise subscription required' }, { status: 403 });
    }

    // TODO: Replace with actual Supabase query
    // const { data, error } = await supabase
    //   .from('voice_agent_analytics')
    //   .select('*')
    //   .eq('salon_id', salon.id)
    //   .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    //   .order('created_at', { ascending: false });

    // if (error) {
    //   throw error;
    // }

    return NextResponse.json(mockMetrics);
    
  } catch (error) {
    console.error('Failed to fetch voice agent metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch metrics' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const salon = session.user.salon;
    if (!salon || salon.subscription_tier !== 'enterprise') {
      return NextResponse.json({ error: 'Enterprise subscription required' }, { status: 403 });
    }

    // This endpoint would be called by the Voice Gateway Service to log metrics
    const body = await request.json();
    console.log('Voice agent metrics received:', body);

    // TODO: Replace with actual Supabase insert
    // const { data, error } = await supabase
    //   .from('voice_agent_analytics')
    //   .insert({
    //     salon_id: salon.id,
    //     call_id: callId,
    //     duration,
    //     success,
    //     language,
    //     spam_blocked: spamBlocked,
    //     created_at: new Date().toISOString(),
    //   });

    // if (error) {
    //   throw error;
    // }

    return NextResponse.json({ success: true });
    
  } catch (error) {
    console.error('Failed to record voice agent metrics:', error);
    return NextResponse.json(
      { error: 'Failed to record metrics' },
      { status: 500 }
    );
  }
}