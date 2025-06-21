import { config } from '@/lib/config';

// =============================================================================
// MICROSOFT OUTLOOK CALENDAR API CLIENT
// =============================================================================
// Production Microsoft Graph API integration for salon booking automation
// - OAuth 2.0 authentication with Microsoft Graph
// - Outlook Calendar event creation and management
// - Exchange Online integration for business accounts
// - Microsoft 365 integration for Enterprise customers
// - European data center compliance
// =============================================================================

export interface OutlookEvent {
  id: string;
  subject: string;
  body: {
    contentType: 'text' | 'html';
    content: string;
  };
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  attendees?: Array<{
    emailAddress: {
      address: string;
      name?: string;
    };
    status: {
      response: 'none' | 'organizer' | 'tentativelyAccepted' | 'accepted' | 'declined' | 'notResponded';
      time: string;
    };
  }>;
  location?: {
    displayName: string;
    address?: {
      street?: string;
      city?: string;
      postalCode?: string;
      countryOrRegion?: string;
    };
  };
  showAs: 'free' | 'tentative' | 'busy' | 'oof' | 'workingElsewhere' | 'unknown';
  isOnlineMeeting?: boolean;
  onlineMeeting?: {
    joinUrl: string;
  };
}

export interface OutlookAvailabilitySlot {
  start: string;
  end: string;
  available: boolean;
  calendar_owner?: string;
  calendar_id: string;
}

export interface OutlookBookingRequest {
  service: {
    name: string;
    duration_minutes: number;
    staff_member?: string;
  };
  customer: {
    name: string;
    email: string;
    phone?: string;
  };
  preferred_datetime: string;
  timezone: string;
  notes?: string;
  send_invites: boolean;
  create_teams_meeting?: boolean;
}

class OutlookCalendarClient {
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;
  private accessToken?: string;
  private refreshToken?: string;
  private baseURL = 'https://graph.microsoft.com/v1.0';

  constructor(credentials?: {
    clientId?: string;
    clientSecret?: string;
    redirectUri?: string;
    accessToken?: string;
    refreshToken?: string;
  }) {
    this.clientId = credentials?.clientId ?? config.MICROSOFT_CLIENT_ID ?? '';
    this.clientSecret = credentials?.clientSecret ?? config.MICROSOFT_CLIENT_SECRET ?? '';
    this.redirectUri = credentials?.redirectUri ?? config.MICROSOFT_REDIRECT_URI ?? '';
    this.accessToken = credentials?.accessToken;
    this.refreshToken = credentials?.refreshToken;

    if (!this.clientId || !this.clientSecret) {
      console.warn('Microsoft Graph credentials not fully configured - some features may not work');
    }
  }

  // =============================================================================
  // OAUTH AUTHENTICATION
  // =============================================================================

  getAuthUrl(state?: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      redirect_uri: this.redirectUri,
      response_mode: 'query',
      scope: [
        'https://graph.microsoft.com/Calendars.ReadWrite',
        'https://graph.microsoft.com/User.Read',
        'offline_access',
      ].join(' '),
      ...(state && { state }),
    });

    return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`;
  }

  async exchangeCodeForTokens(code: string): Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: string;
  }> {
    const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: this.redirectUri,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`OAuth token exchange failed: ${errorData.error_description || response.statusText}`);
    }

    const tokens = await response.json();
    
    // Store tokens for future use
    this.accessToken = tokens.access_token;
    this.refreshToken = tokens.refresh_token;

    return tokens;
  }

  async refreshAccessToken(): Promise<string> {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: this.refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Token refresh failed: ${errorData.error_description || response.statusText}`);
    }

    const tokens = await response.json();
    this.accessToken = tokens.access_token;

    return tokens.access_token;
  }

  // =============================================================================
  // CALENDAR EVENT MANAGEMENT
  // =============================================================================

  async createEvent(calendarId: string = 'primary', eventData: Omit<OutlookEvent, 'id'>): Promise<OutlookEvent> {
    const endpoint = calendarId === 'primary' 
      ? '/me/events'
      : `/me/calendars/${calendarId}/events`;

    return await this.makeAuthenticatedRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify(eventData),
    });
  }

  async updateEvent(
    eventId: string,
    eventData: Partial<OutlookEvent>,
    calendarId: string = 'primary'
  ): Promise<OutlookEvent> {
    const endpoint = calendarId === 'primary'
      ? `/me/events/${eventId}`
      : `/me/calendars/${calendarId}/events/${eventId}`;

    return await this.makeAuthenticatedRequest(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(eventData),
    });
  }

  async deleteEvent(eventId: string, calendarId: string = 'primary'): Promise<void> {
    const endpoint = calendarId === 'primary'
      ? `/me/events/${eventId}`
      : `/me/calendars/${calendarId}/events/${eventId}`;

    await this.makeAuthenticatedRequest(endpoint, {
      method: 'DELETE',
    });
  }

  async getEvent(eventId: string, calendarId: string = 'primary'): Promise<OutlookEvent> {
    const endpoint = calendarId === 'primary'
      ? `/me/events/${eventId}`
      : `/me/calendars/${calendarId}/events/${eventId}`;

    return await this.makeAuthenticatedRequest(endpoint);
  }

  async listEvents(
    calendarId: string = 'primary',
    options: {
      startDateTime?: string;
      endDateTime?: string;
      top?: number;
      filter?: string;
      orderby?: string;
    } = {}
  ): Promise<{ value: OutlookEvent[] }> {
    const params = new URLSearchParams();
    
    if (options.startDateTime) {
      params.append('$filter', `start/dateTime ge '${options.startDateTime}'`);
    }
    if (options.endDateTime) {
      const endFilter = `end/dateTime le '${options.endDateTime}'`;
      const existingFilter = params.get('$filter');
      params.set('$filter', existingFilter ? `${existingFilter} and ${endFilter}` : endFilter);
    }
    if (options.top) params.append('$top', options.top.toString());
    if (options.orderby) params.append('$orderby', options.orderby);

    const endpoint = calendarId === 'primary' 
      ? '/me/events'
      : `/me/calendars/${calendarId}/events`;
    
    const url = `${endpoint}${params.toString() ? '?' + params.toString() : ''}`;
    
    return await this.makeAuthenticatedRequest(url);
  }

  // =============================================================================
  // AVAILABILITY CHECKING
  // =============================================================================

  async checkAvailability(
    calendarIds: string[],
    timeMin: string,
    timeMax: string,
    timezone: string = 'Europe/Berlin'
  ): Promise<OutlookAvailabilitySlot[]> {
    const slots: OutlookAvailabilitySlot[] = [];
    
    for (const calendarId of calendarIds) {
      try {
        const events = await this.listEvents(calendarId, {
          startDateTime: timeMin,
          endDateTime: timeMax,
          orderby: 'start/dateTime',
        });

        // Generate availability slots based on business hours and existing events
        const daySlots = this.generateTimeSlots(timeMin, timeMax, timezone);
        const availableSlots = this.filterAvailableSlots(daySlots, events.value);

        slots.push(...availableSlots.map(slot => ({
          ...slot,
          calendar_id: calendarId,
        })));
      } catch (error) {
        console.error(`Error checking availability for calendar ${calendarId}:`, error);
      }
    }

    return slots;
  }

  private generateTimeSlots(
    timeMin: string, 
    timeMax: string, 
    _timezone: string,
    slotDuration: number = 30 // minutes
  ): OutlookAvailabilitySlot[] {
    const slots: OutlookAvailabilitySlot[] = [];
    const start = new Date(timeMin);
    const end = new Date(timeMax);
    
    let currentTime = new Date(start);
    
    while (currentTime < end) {
      const slotEnd = new Date(currentTime.getTime() + slotDuration * 60000);
      
      slots.push({
        start: currentTime.toISOString(),
        end: slotEnd.toISOString(),
        available: true,
        calendar_id: '',
      });
      
      currentTime = slotEnd;
    }
    
    return slots;
  }

  private filterAvailableSlots(
    timeSlots: OutlookAvailabilitySlot[], 
    existingEvents: OutlookEvent[]
  ): OutlookAvailabilitySlot[] {
    return timeSlots.map(slot => {
      const slotStart = new Date(slot.start);
      const slotEnd = new Date(slot.end);
      
      // Check if slot conflicts with any existing event
      const hasConflict = existingEvents.some(event => {
        const eventStart = new Date(event.start.dateTime);
        const eventEnd = new Date(event.end.dateTime);
        
        // Only consider busy events as conflicts
        if (event.showAs === 'free') return false;
        
        return (
          (slotStart >= eventStart && slotStart < eventEnd) ||
          (slotEnd > eventStart && slotEnd <= eventEnd) ||
          (slotStart <= eventStart && slotEnd >= eventEnd)
        );
      });
      
      return {
        ...slot,
        available: !hasConflict,
      };
    });
  }

  // =============================================================================
  // BOOKING AUTOMATION
  // =============================================================================

  async createBooking(
    calendarId: string = 'primary',
    bookingRequest: OutlookBookingRequest
  ): Promise<{
    success: boolean;
    event?: OutlookEvent;
    error?: string;
    alternatives?: OutlookAvailabilitySlot[];
  }> {
    try {
      // 1. Check if requested slot is available
      const requestedStart = new Date(bookingRequest.preferred_datetime);
      const requestedEnd = new Date(
        requestedStart.getTime() + bookingRequest.service.duration_minutes * 60000
      );

      const availability = await this.checkAvailability(
        [calendarId],
        requestedStart.toISOString(),
        requestedEnd.toISOString(),
        bookingRequest.timezone
      );

      const requestedSlot = availability.find(slot => 
        new Date(slot.start).getTime() === requestedStart.getTime()
      );

      if (!requestedSlot?.available) {
        // Find alternative slots
        const alternatives = availability.filter(slot => slot.available).slice(0, 5);
        
        return {
          success: false,
          error: 'Requested time slot is not available',
          alternatives,
        };
      }

      // 2. Create the calendar event
      const eventData: Omit<OutlookEvent, 'id'> = {
        subject: `${bookingRequest.service.name} - ${bookingRequest.customer.name}`,
        body: {
          contentType: 'text',
          content: `
Service: ${bookingRequest.service.name}
Customer: ${bookingRequest.customer.name}
Phone: ${bookingRequest.customer.phone || 'Not provided'}
Duration: ${bookingRequest.service.duration_minutes} minutes
${bookingRequest.notes ? `\nNotes: ${bookingRequest.notes}` : ''}
          `.trim(),
        },
        start: {
          dateTime: requestedStart.toISOString(),
          timeZone: bookingRequest.timezone,
        },
        end: {
          dateTime: requestedEnd.toISOString(),
          timeZone: bookingRequest.timezone,
        },
        showAs: 'busy',
        attendees: bookingRequest.send_invites ? [
          {
            emailAddress: {
              address: bookingRequest.customer.email,
              name: bookingRequest.customer.name,
            },
            status: {
              response: 'none',
              time: new Date().toISOString(),
            },
          },
        ] : undefined,
        isOnlineMeeting: bookingRequest.create_teams_meeting,
      };

      const event = await this.createEvent(calendarId, eventData);

      return {
        success: true,
        event,
      };

    } catch (error) {
      console.error('Error creating booking:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async cancelBooking(eventId: string, calendarId: string = 'primary'): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      await this.deleteEvent(eventId, calendarId);
      return { success: true };
    } catch (error) {
      console.error('Error cancelling booking:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // =============================================================================
  // CALENDAR MANAGEMENT
  // =============================================================================

  async listCalendars(): Promise<{ value: Array<{ id: string; name: string; color: string; isDefault: boolean }> }> {
    return await this.makeAuthenticatedRequest('/me/calendars');
  }

  async createCalendar(calendarData: {
    name: string;
    color?: string;
  }): Promise<{ id: string; name: string; color: string }> {
    return await this.makeAuthenticatedRequest('/me/calendars', {
      method: 'POST',
      body: JSON.stringify(calendarData),
    });
  }

  async getUserProfile(): Promise<{
    id: string;
    displayName: string;
    mail: string;
    userPrincipalName: string;
  }> {
    return await this.makeAuthenticatedRequest('/me');
  }

  // =============================================================================
  // UTILITY METHODS
  // =============================================================================

  private async makeAuthenticatedRequest(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<any> {
    if (!this.accessToken) {
      throw new Error('No access token available. Please authenticate first.');
    }

    let token = this.accessToken;

    // Try the request with current token
    let response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    // If unauthorized, try to refresh token
    if (response.status === 401 && this.refreshToken) {
      try {
        token = await this.refreshAccessToken();
        
        response = await fetch(`${this.baseURL}${endpoint}`, {
          ...options,
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            ...options.headers,
          },
        });
      } catch (refreshError) {
        throw new Error('Authentication failed and token refresh failed');
      }
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Microsoft Graph API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    // Handle empty responses (e.g., DELETE requests)
    if (response.status === 204) {
      return null;
    }

    return await response.json();
  }

  setCredentials(credentials: {
    accessToken?: string;
    refreshToken?: string;
  }): void {
    if (credentials.accessToken) {
      this.accessToken = credentials.accessToken;
    }
    if (credentials.refreshToken) {
      this.refreshToken = credentials.refreshToken;
    }
  }

  // =============================================================================
  // HEALTH CHECK
  // =============================================================================

  async healthCheck(): Promise<{ status: 'healthy' | 'error'; details?: string }> {
    try {
      const profile = await this.getUserProfile();
      
      if (profile && profile.id) {
        return { status: 'healthy' };
      } else {
        return { status: 'error', details: 'Invalid response from Microsoft Graph API' };
      }
    } catch (error) {
      return {
        status: 'error',
        details: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

let outlookCalendarClient: OutlookCalendarClient | null = null;

export function getOutlookCalendarClient(credentials?: {
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  accessToken?: string;
  refreshToken?: string;
}): OutlookCalendarClient {
  if (!outlookCalendarClient || credentials) {
    outlookCalendarClient = new OutlookCalendarClient(credentials);
  }
  return outlookCalendarClient;
}

export { OutlookCalendarClient };
export default OutlookCalendarClient;