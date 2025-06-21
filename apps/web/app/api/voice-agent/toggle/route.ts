import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth/config';

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

    const body = await request.json();
    const { enabled } = body;

    if (typeof enabled !== 'boolean') {
      return NextResponse.json({ error: 'Invalid enabled value' }, { status: 400 });
    }

    // TODO: Replace with actual voice agent service call
    // const response = await fetch(`${process.env.VOICE_GATEWAY_URL}/toggle`, {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //     'Authorization': `Bearer ${process.env.VOICE_GATEWAY_API_KEY}`,
    //   },
    //   body: JSON.stringify({
    //     salon_id: salon.id,
    //     enabled,
    //   }),
    // });

    // if (!response.ok) {
    //   throw new Error('Failed to toggle voice agent');
    // }

    // TODO: Update salon settings in Supabase
    // const { error } = await supabase
    //   .from('salons')
    //   .update({ voice_agent_enabled: enabled })
    //   .eq('id', salon.id);

    // if (error) {
    //   throw error;
    // }

    console.log(`Voice agent ${enabled ? 'enabled' : 'disabled'} for salon ${salon.id}`);

    return NextResponse.json({ 
      success: true, 
      enabled,
      message: `Voice agent ${enabled ? 'enabled' : 'disabled'} successfully` 
    });
    
  } catch (error) {
    console.error('Failed to toggle voice agent:', error);
    return NextResponse.json(
      { error: 'Failed to toggle voice agent' },
      { status: 500 }
    );
  }
}