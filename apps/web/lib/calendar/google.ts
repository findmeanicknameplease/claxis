import { config } from '@/lib/config';

// =============================================================================
// GOOGLE CALENDAR API CLIENT
// =============================================================================
// Production Google Calendar integration for salon booking automation
// - OAuth 2.0 authentication with refresh token management
// - Calendar event creation and management
// - Availability checking and conflict resolution
// - Multi-calendar support for different staff members
// - Timezone handling for European salons
// =============================================================================

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  attendees?: Array<{
    email: string;
    displayName?: string;
    responseStatus?: 'needsAction' | 'declined' | 'tentative' | 'accepted';
  }>;
  location?: string;
  status: 'tentative' | 'confirmed' | 'cancelled';
  conferenceData?: {
    createRequest?: {
      requestId: string;
      conferenceSolutionKey: {
        type: 'hangoutsMeet';
      };
    };
  };
}

export interface AvailabilitySlot {
  start: string;
  end: string;
  available: boolean;
  staff_member?: string;
  calendar_id: string;
}

export interface BookingRequest {
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
}

export interface CalendarConfig {
  calendar_id: string;
  name: string;
  staff_member?: string;
  color?: string;
  timezone: string;
  business_hours: {
    [key: string]: {
      start: string;
      end: string;
      available: boolean;
    };
  };
}

class GoogleCalendarClient {
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;
  private accessToken?: string;
  private refreshToken?: string;
  private baseURL = 'https://www.googleapis.com/calendar/v3';

  constructor(credentials?: {
    clientId?: string;
    clientSecret?: string;
    redirectUri?: string;
    accessToken?: string;
    refreshToken?: string;
  }) {
    this.clientId = credentials?.clientId ?? config.GOOGLE_CLIENT_ID ?? '';
    this.clientSecret = credentials?.clientSecret ?? config.GOOGLE_CLIENT_SECRET ?? '';
    this.redirectUri = credentials?.redirectUri ?? config.GOOGLE_REDIRECT_URI ?? '';
    this.accessToken = credentials?.accessToken;
    this.refreshToken = credentials?.refreshToken;

    if (!this.clientId || !this.clientSecret) {
      console.warn('Google Calendar credentials not fully configured - some features may not work');
    }
  }

  // =============================================================================
  // OAUTH AUTHENTICATION
  // =============================================================================

  getAuthUrl(state?: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/calendar.events',
      ].join(' '),
      access_type: 'offline',
      prompt: 'consent',
      ...(state && { state }),
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async exchangeCodeForTokens(code: string): Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: string;
  }> {
    const response = await fetch('https://oauth2.googleapis.com/token', {
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
      throw new Error(`OAuth token exchange failed: ${response.status} ${response.statusText}`);
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

    const response = await fetch('https://oauth2.googleapis.com/token', {
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
      throw new Error(`Token refresh failed: ${response.status} ${response.statusText}`);
    }

    const tokens = await response.json();
    this.accessToken = tokens.access_token;

    return tokens.access_token;
  }

  // =============================================================================
  // CALENDAR EVENT MANAGEMENT
  // =============================================================================

  async createEvent(calendarId: string, eventData: Omit<CalendarEvent, 'id'>): Promise<CalendarEvent> {
    const response = await this.makeAuthenticatedRequest(
      `/calendars/${encodeURIComponent(calendarId)}/events`,
      {
        method: 'POST',
        body: JSON.stringify(eventData),
      }
    );

    return response;
  }

  async updateEvent(
    calendarId: string, 
    eventId: string, 
    eventData: Partial<CalendarEvent>
  ): Promise<CalendarEvent> {
    const response = await this.makeAuthenticatedRequest(
      `/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(eventData),
      }
    );

    return response;
  }

  async deleteEvent(calendarId: string, eventId: string): Promise<void> {
    await this.makeAuthenticatedRequest(
      `/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
      {
        method: 'DELETE',
      }
    );
  }

  async getEvent(calendarId: string, eventId: string): Promise<CalendarEvent> {
    return await this.makeAuthenticatedRequest(
      `/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`
    );
  }

  async listEvents(
    calendarId: string,
    options: {
      timeMin?: string;
      timeMax?: string;
      maxResults?: number;
      singleEvents?: boolean;
      orderBy?: 'startTime' | 'updated';
    } = {}
  ): Promise<{ items: CalendarEvent[] }> {
    const params = new URLSearchParams();
    
    if (options.timeMin) params.append('timeMin', options.timeMin);
    if (options.timeMax) params.append('timeMax', options.timeMax);
    if (options.maxResults) params.append('maxResults', options.maxResults.toString());
    if (options.singleEvents) params.append('singleEvents', 'true');
    if (options.orderBy) params.append('orderBy', options.orderBy);

    const url = `/calendars/${encodeURIComponent(calendarId)}/events${params.toString() ? '?' + params.toString() : ''}`;
    
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
  ): Promise<AvailabilitySlot[]> {
    const slots: AvailabilitySlot[] = [];
    
    for (const calendarId of calendarIds) {
      try {
        const events = await this.listEvents(calendarId, {
          timeMin,
          timeMax,
          singleEvents: true,
          orderBy: 'startTime',
        });

        // Generate availability slots based on business hours and existing events
        const daySlots = this.generateTimeSlots(timeMin, timeMax, timezone);
        const availableSlots = this.filterAvailableSlots(daySlots, events.items);

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
  ): AvailabilitySlot[] {
    const slots: AvailabilitySlot[] = [];
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
    timeSlots: AvailabilitySlot[], 
    existingEvents: CalendarEvent[]
  ): AvailabilitySlot[] {
    return timeSlots.map(slot => {
      const slotStart = new Date(slot.start);
      const slotEnd = new Date(slot.end);
      
      // Check if slot conflicts with any existing event
      const hasConflict = existingEvents.some(event => {
        const eventStart = new Date(event.start.dateTime);
        const eventEnd = new Date(event.end.dateTime);
        
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
    calendarId: string,
    bookingRequest: BookingRequest
  ): Promise<{
    success: boolean;
    event?: CalendarEvent;
    error?: string;
    alternatives?: AvailabilitySlot[];
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
      const eventData: Omit<CalendarEvent, 'id'> = {
        summary: `${bookingRequest.service.name} - ${bookingRequest.customer.name}`,
        description: `
Service: ${bookingRequest.service.name}
Customer: ${bookingRequest.customer.name}
Phone: ${bookingRequest.customer.phone || 'Not provided'}
Duration: ${bookingRequest.service.duration_minutes} minutes
${bookingRequest.notes ? `\nNotes: ${bookingRequest.notes}` : ''}
        `.trim(),
        start: {
          dateTime: requestedStart.toISOString(),
          timeZone: bookingRequest.timezone,
        },
        end: {
          dateTime: requestedEnd.toISOString(),
          timeZone: bookingRequest.timezone,
        },
        status: 'confirmed',
        attendees: bookingRequest.send_invites ? [
          {
            email: bookingRequest.customer.email,
            displayName: bookingRequest.customer.name,
            responseStatus: 'needsAction',
          },
        ] : undefined,
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

  async cancelBooking(calendarId: string, eventId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      await this.deleteEvent(calendarId, eventId);
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

  async listCalendars(): Promise<{ items: Array<{ id: string; summary: string; timeZone: string; primary?: boolean }> }> {
    return await this.makeAuthenticatedRequest('/users/me/calendarList');
  }

  async createCalendar(calendarData: {
    summary: string;
    description?: string;
    timeZone: string;
  }): Promise<{ id: string; summary: string; timeZone: string }> {
    return await this.makeAuthenticatedRequest('/calendars', {
      method: 'POST',
      body: JSON.stringify(calendarData),
    });
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
      throw new Error(`Google Calendar API error: ${response.status} ${response.statusText} - ${errorText}`);
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
      const calendars = await this.listCalendars();
      
      if (calendars && calendars.items) {
        return { status: 'healthy' };
      } else {
        return { status: 'error', details: 'Invalid response from Google Calendar API' };
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

let googleCalendarClient: GoogleCalendarClient | null = null;

export function getGoogleCalendarClient(credentials?: {
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  accessToken?: string;
  refreshToken?: string;
}): GoogleCalendarClient {
  if (!googleCalendarClient || credentials) {
    googleCalendarClient = new GoogleCalendarClient(credentials);
  }
  return googleCalendarClient;
}

export { GoogleCalendarClient };
export default GoogleCalendarClient;