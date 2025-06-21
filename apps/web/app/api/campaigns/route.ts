import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth/config';

// Mock data for development - replace with actual Supabase queries
const mockCampaigns = [
  {
    id: 'camp_001',
    name: 'Post-Service Review Collection',
    type: 'review-requests',
    status: 'running',
    progress: 65,
    totalTargets: 150,
    completed: 98,
    failed: 5,
    successRate: 95.1,
    estimatedCompletion: new Date(Date.now() + 2 * 60 * 60 * 1000),
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    startedAt: new Date(Date.now() - 22 * 60 * 60 * 1000),
    completedAt: null,
  },
  {
    id: 'camp_002', 
    name: 'Holiday Special Promotion',
    type: 'promotional',
    status: 'paused',
    progress: 25,
    totalTargets: 300,
    completed: 75,
    failed: 12,
    successRate: 86.2,
    estimatedCompletion: new Date(Date.now() + 6 * 60 * 60 * 1000),
    createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
    startedAt: new Date(Date.now() - 46 * 60 * 60 * 1000),
    completedAt: null,
  },
  {
    id: 'camp_003',
    name: 'Customer Reactivation - Q4',
    type: 'reactivation', 
    status: 'completed',
    progress: 100,
    totalTargets: 80,
    completed: 72,
    failed: 8,
    successRate: 90.0,
    estimatedCompletion: null,
    createdAt: new Date(Date.now() - 72 * 60 * 60 * 1000),
    startedAt: new Date(Date.now() - 70 * 60 * 60 * 1000),
    completedAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
  },
];

const mockMetrics = {
  activeCampaigns: 2,
  completedToday: 1,
  totalCalls: 407,
  averageSuccessRate: 90.4,
  topPerformingType: 'review-requests',
  recentActivity: [
    {
      campaignId: 'camp_001',
      name: 'Post-Service Review Collection',
      action: 'Campaign progressed to 65%',
      timestamp: new Date(Date.now() - 15 * 60 * 1000),
    },
    {
      campaignId: 'camp_002',
      name: 'Holiday Special Promotion', 
      action: 'Campaign paused by user',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
    },
    {
      campaignId: 'camp_003',
      name: 'Customer Reactivation - Q4',
      action: 'Campaign completed successfully',
      timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000),
    },
  ],
};

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const salon = session.user.salon;
    if (!salon) {
      return NextResponse.json({ error: 'No salon associated' }, { status: 403 });
    }

    // TODO: Replace with actual Supabase queries
    // const { data: campaigns, error: campaignError } = await supabase
    //   .from('voice_agent_campaigns')
    //   .select('*')
    //   .eq('salon_id', salon.id)
    //   .order('created_at', { ascending: false });

    // if (campaignError) {
    //   throw campaignError;
    // }

    // const { data: metricsData, error: metricsError } = await supabase
    //   .from('campaign_analytics')
    //   .select('*')
    //   .eq('salon_id', salon.id)
    //   .single();

    // if (metricsError && metricsError.code !== 'PGRST116') {
    //   throw metricsError;
    // }

    return NextResponse.json({
      campaigns: mockCampaigns,
      metrics: mockMetrics,
    });
    
  } catch (error) {
    console.error('Failed to fetch campaigns:', error);
    return NextResponse.json(
      { error: 'Failed to fetch campaigns' },
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
    if (!salon) {
      return NextResponse.json({ error: 'No salon associated' }, { status: 403 });
    }

    const body = await request.json();
    const { name, type, targets, scheduleAt } = body;

    if (!name || !type || !targets || !Array.isArray(targets) || targets.length === 0) {
      return NextResponse.json({ 
        error: 'Missing required fields: name, type, targets' 
      }, { status: 400 });
    }

    const validTypes = ['review-requests', 'reactivation', 'follow-up', 'promotional', 'missed-call-callback'];
    if (!validTypes.includes(type)) {
      return NextResponse.json({ 
        error: 'Invalid campaign type',
        validTypes 
      }, { status: 400 });
    }

    // Create new campaign
    const newCampaign = {
      id: `camp_${Date.now()}`,
      name,
      type,
      status: scheduleAt ? 'pending' : 'running',
      progress: 0,
      totalTargets: targets.length,
      completed: 0,
      failed: 0,
      successRate: 0,
      estimatedCompletion: scheduleAt ? new Date(scheduleAt) : new Date(Date.now() + targets.length * 60 * 1000),
      createdAt: new Date(),
      startedAt: scheduleAt ? null : new Date(),
      completedAt: null,
    };

    // TODO: Replace with actual Supabase insert and campaign queue creation
    // const { data, error } = await supabase
    //   .from('voice_agent_campaigns')
    //   .insert({
    //     salon_id: salon.id,
    //     name,
    //     type,
    //     targets,
    //     template,
    //     schedule_at: scheduleAt,
    //     created_by: session.user.id,
    //   })
    //   .select()
    //   .single();

    // if (error) {
    //   throw error;
    // }

    // TODO: Add to campaign queue (BullMQ)
    // await campaignQueue.add(`campaign-${type}`, {
    //   campaignId: data.id,
    //   salonId: salon.id,
    //   targets,
    //   template,
    // }, {
    //   delay: scheduleAt ? new Date(scheduleAt).getTime() - Date.now() : 0,
    // });

    console.log(`Campaign created: ${name} (${type}) for salon ${salon.id}`);

    return NextResponse.json(newCampaign, { status: 201 });
    
  } catch (error) {
    console.error('Failed to create campaign:', error);
    return NextResponse.json(
      { error: 'Failed to create campaign' },
      { status: 500 }
    );
  }
}