import { NextRequest, NextResponse } from 'next/server';
import { getGoogleCalendarClient } from '@/lib/calendar/google';
import { getOutlookCalendarClient } from '@/lib/calendar/outlook';

// =============================================================================
// CALENDAR OAUTH CALLBACK HANDLER
// =============================================================================
// Handles OAuth callbacks from Google Calendar and Outlook Calendar
// Exchanges authorization codes for access tokens and stores connections
// =============================================================================

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const provider = searchParams.get('provider') || 'google';

  // Handle OAuth errors
  if (error) {
    console.error('OAuth error:', error);
    return NextResponse.redirect(
      new URL(`/dashboard/settings/calendar?error=${error}`, request.url)
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL('/dashboard/settings/calendar?error=no_code', request.url)
    );
  }

  try {
    let tokens;
    let userInfo;

    if (provider === 'google') {
      const googleClient = getGoogleCalendarClient();
      tokens = await googleClient.exchangeCodeForTokens(code);
      
      // Get user calendar info
      googleClient.setCredentials({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
      });
      
      const calendars = await googleClient.listCalendars();
      userInfo = {
        provider: 'google',
        calendars: calendars.items,
      };
    } else if (provider === 'outlook') {
      const outlookClient = getOutlookCalendarClient();
      tokens = await outlookClient.exchangeCodeForTokens(code);
      
      // Get user calendar info
      outlookClient.setCredentials({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
      });
      
      const [profile, calendars] = await Promise.all([
        outlookClient.getUserProfile(),
        outlookClient.listCalendars(),
      ]);
      
      userInfo = {
        provider: 'outlook',
        profile,
        calendars: calendars.value,
      };
    } else {
      throw new Error(`Unknown calendar provider: ${provider}`);
    }

    // Store connection in database (would implement actual database storage)
    // const connectionData = {
    //   provider,
    //   access_token: tokens.access_token,
    //   refresh_token: tokens.refresh_token,
    //   expires_at: new Date(Date.now() + tokens.expires_in * 1000),
    //   user_info: userInfo,
    // };

    // For now, redirect with success and tokens in URL params (not secure for production)
    // In production, this should store in secure database and redirect with success flag
    const successParams = new URLSearchParams({
      success: 'true',
      provider,
      calendars_count: userInfo.calendars?.length?.toString() || '0',
    });

    return NextResponse.redirect(
      new URL(`/dashboard/settings/calendar?${successParams.toString()}`, request.url)
    );

  } catch (error) {
    console.error('Calendar OAuth callback error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.redirect(
      new URL(`/dashboard/settings/calendar?error=${encodeURIComponent(errorMessage)}`, request.url)
    );
  }
}

// Handle POST requests for manual token exchange (for testing)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { provider, code, salon_id } = body;

    if (!provider || !code || !salon_id) {
      return NextResponse.json(
        { error: 'Missing required fields: provider, code, salon_id' },
        { status: 400 }
      );
    }

    let tokens;
    let connectionInfo;

    if (provider === 'google') {
      const googleClient = getGoogleCalendarClient();
      tokens = await googleClient.exchangeCodeForTokens(code);
      
      googleClient.setCredentials({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
      });
      
      const calendars = await googleClient.listCalendars();
      connectionInfo = {
        provider: 'google',
        calendars: calendars.items,
        primary_calendar: calendars.items.find(cal => cal.primary)?.id || 'primary',
      };
    } else if (provider === 'outlook') {
      const outlookClient = getOutlookCalendarClient();
      tokens = await outlookClient.exchangeCodeForTokens(code);
      
      outlookClient.setCredentials({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
      });
      
      const [profile, calendars] = await Promise.all([
        outlookClient.getUserProfile(),
        outlookClient.listCalendars(),
      ]);
      
      connectionInfo = {
        provider: 'outlook',
        profile,
        calendars: calendars.value,
        primary_calendar: calendars.value.find(cal => cal.isDefault)?.id || 'primary',
      };
    } else {
      return NextResponse.json(
        { error: `Unsupported provider: ${provider}` },
        { status: 400 }
      );
    }

    // TODO: Store in database
    // await storeCalendarConnection(salon_id, {
    //   provider,
    //   access_token: tokens.access_token,
    //   refresh_token: tokens.refresh_token,
    //   expires_at: new Date(Date.now() + tokens.expires_in * 1000),
    //   calendar_info: connectionInfo,
    // });

    return NextResponse.json({
      success: true,
      provider,
      connection_info: connectionInfo,
      expires_in: tokens.expires_in,
    });

  } catch (error) {
    console.error('Calendar connection error:', error);
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false,
      },
      { status: 500 }
    );
  }
}