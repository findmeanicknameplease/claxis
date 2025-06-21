import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth/config';

const supportedLanguages = ['de', 'en', 'fr', 'nl', 'es', 'it'];

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
    const { language } = body;

    if (!language || !supportedLanguages.includes(language)) {
      return NextResponse.json({ 
        error: 'Invalid language', 
        supportedLanguages 
      }, { status: 400 });
    }

    // TODO: Replace with actual voice agent service call
    // const response = await fetch(`${process.env.VOICE_GATEWAY_URL}/language`, {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //     'Authorization': `Bearer ${process.env.VOICE_GATEWAY_API_KEY}`,
    //   },
    //   body: JSON.stringify({
    //     salon_id: salon.id,
    //     language,
    //   }),
    // });

    // if (!response.ok) {
    //   throw new Error('Failed to change voice agent language');
    // }

    // TODO: Update salon settings in Supabase
    // const { error } = await supabase
    //   .from('salons')
    //   .update({ voice_agent_language: language })
    //   .eq('id', salon.id);

    // if (error) {
    //   throw error;
    // }

    console.log(`Voice agent language changed to ${language} for salon ${salon.id}`);

    return NextResponse.json({ 
      success: true, 
      language,
      message: `Voice agent language changed to ${language}` 
    });
    
  } catch (error) {
    console.error('Failed to change voice agent language:', error);
    return NextResponse.json(
      { error: 'Failed to change language' },
      { status: 500 }
    );
  }
}