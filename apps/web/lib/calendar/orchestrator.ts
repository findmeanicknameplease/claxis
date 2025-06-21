import { getGoogleCalendarClient, GoogleCalendarClient, CalendarEvent, BookingRequest } from './google';
import { getOutlookCalendarClient, OutlookCalendarClient, OutlookEvent, OutlookBookingRequest } from './outlook';

// =============================================================================
// CALENDAR ORCHESTRATOR
// =============================================================================
// Unified calendar management system for salon automation
// - Multi-provider support (Google Calendar, Outlook Calendar)
// - Intelligent routing based on salon preferences
// - Unified availability checking across all calendar providers
// - Conflict resolution and booking optimization
// - Enterprise-grade calendar synchronization
// =============================================================================

export type CalendarProvider = 'google' | 'outlook';

export interface UnifiedCalendarEvent {
  id: string;
  title: string;
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
    name?: string;
    status?: string;
  }>;
  provider: CalendarProvider;
  calendar_id: string;
  location?: string;
  status: 'confirmed' | 'tentative' | 'cancelled';
}

export interface UnifiedAvailabilitySlot {
  start: string;
  end: string;
  available: boolean;
  provider: CalendarProvider;
  calendar_id: string;
  staff_member?: string;
}

export interface UnifiedBookingRequest {
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
  create_online_meeting?: boolean;
}

export interface CalendarConnection {
  provider: CalendarProvider;
  calendar_id: string;
  name: string;
  staff_member?: string;
  credentials: {
    access_token: string;
    refresh_token?: string;
  };
  is_primary: boolean;
  active: boolean;
}

export interface SalonCalendarConfig {
  salon_id: string;
  connections: CalendarConnection[];
  booking_preferences: {
    default_duration: number;
    buffer_time_minutes: number;
    business_hours: {
      [key: string]: {
        start: string;
        end: string;
        available: boolean;
      };
    };
    timezone: string;
    auto_confirm_bookings: boolean;
    send_reminders: boolean;
  };
}

class CalendarOrchestrator {
  private googleClient: GoogleCalendarClient;
  private outlookClient: OutlookCalendarClient;

  constructor() {
    this.googleClient = getGoogleCalendarClient();
    this.outlookClient = getOutlookCalendarClient();
  }

  // =============================================================================
  // UNIFIED CALENDAR OPERATIONS
  // =============================================================================

  async createBooking(
    salonConfig: SalonCalendarConfig,
    bookingRequest: UnifiedBookingRequest,
    preferredProvider?: CalendarProvider
  ): Promise<{
    success: boolean;
    event?: UnifiedCalendarEvent;
    error?: string;
    alternatives?: UnifiedAvailabilitySlot[];
  }> {
    try {
      // 1. Find the best calendar connection for this booking
      const connection = this.selectOptimalCalendar(
        salonConfig,
        bookingRequest.service.staff_member,
        preferredProvider
      );

      if (!connection) {
        return {
          success: false,
          error: 'No available calendar connection found',
        };
      }

      // 2. Set credentials for the selected provider
      this.setProviderCredentials(connection);

      // 3. Check availability across all connected calendars
      const availability = await this.checkUnifiedAvailability(
        salonConfig,
        bookingRequest.preferred_datetime,
        new Date(
          new Date(bookingRequest.preferred_datetime).getTime() + 
          bookingRequest.service.duration_minutes * 60000
        ).toISOString(),
        bookingRequest.timezone
      );

      const requestedSlot = availability.find(slot => 
        new Date(slot.start).getTime() === new Date(bookingRequest.preferred_datetime).getTime()
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

      // 4. Create booking with the selected provider
      let result;
      
      if (connection.provider === 'google') {
        const googleRequest: BookingRequest = {
          service: bookingRequest.service,
          customer: bookingRequest.customer,
          preferred_datetime: bookingRequest.preferred_datetime,
          timezone: bookingRequest.timezone,
          notes: bookingRequest.notes,
          send_invites: bookingRequest.send_invites,
        };

        result = await this.googleClient.createBooking(connection.calendar_id, googleRequest);
        
        if (result.success && result.event) {
          return {
            success: true,
            event: this.convertGoogleEventToUnified(result.event, connection),
          };
        }
      } else if (connection.provider === 'outlook') {
        const outlookRequest: OutlookBookingRequest = {
          service: bookingRequest.service,
          customer: bookingRequest.customer,
          preferred_datetime: bookingRequest.preferred_datetime,
          timezone: bookingRequest.timezone,
          notes: bookingRequest.notes,
          send_invites: bookingRequest.send_invites,
          create_teams_meeting: bookingRequest.create_online_meeting,
        };

        result = await this.outlookClient.createBooking(connection.calendar_id, outlookRequest);
        
        if (result.success && result.event) {
          return {
            success: true,
            event: this.convertOutlookEventToUnified(result.event, connection),
          };
        }
      }

      return {
        success: false,
        error: result?.error || 'Unknown error creating booking',
        alternatives: result?.alternatives?.map(alt => ({
          start: alt.start,
          end: alt.end,
          available: alt.available,
          provider: connection.provider,
          calendar_id: alt.calendar_id || connection.calendar_id,
          staff_member: connection.staff_member,
        })),
      };

    } catch (error) {
      console.error('Error in unified booking creation:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async checkUnifiedAvailability(
    salonConfig: SalonCalendarConfig,
    timeMin: string,
    timeMax: string,
    timezone: string
  ): Promise<UnifiedAvailabilitySlot[]> {
    const allSlots: UnifiedAvailabilitySlot[] = [];

    // Check availability across all connected calendars simultaneously
    const availabilityPromises = salonConfig.connections
      .filter(conn => conn.active)
      .map(async (connection) => {
        try {
          this.setProviderCredentials(connection);

          let slots: UnifiedAvailabilitySlot[] = [];

          if (connection.provider === 'google') {
            const googleSlots = await this.googleClient.checkAvailability(
              [connection.calendar_id],
              timeMin,
              timeMax,
              timezone
            );
            
            slots = googleSlots.map(slot => ({
              start: slot.start,
              end: slot.end,
              available: slot.available,
              provider: 'google' as CalendarProvider,
              calendar_id: slot.calendar_id,
              staff_member: connection.staff_member,
            }));
          } else if (connection.provider === 'outlook') {
            const outlookSlots = await this.outlookClient.checkAvailability(
              [connection.calendar_id],
              timeMin,
              timeMax,
              timezone
            );
            
            slots = outlookSlots.map(slot => ({
              start: slot.start,
              end: slot.end,
              available: slot.available,
              provider: 'outlook' as CalendarProvider,
              calendar_id: slot.calendar_id,
              staff_member: connection.staff_member,
            }));
          }

          return slots;
        } catch (error) {
          console.error(`Error checking availability for ${connection.provider} calendar ${connection.calendar_id}:`, error);
          return [];
        }
      });

    const results = await Promise.all(availabilityPromises);
    results.forEach(slots => allSlots.push(...slots));

    // Merge overlapping slots and resolve conflicts
    return this.mergeAvailabilitySlots(allSlots);
  }

  async listUnifiedEvents(
    salonConfig: SalonCalendarConfig,
    timeMin?: string,
    timeMax?: string
  ): Promise<UnifiedCalendarEvent[]> {
    const allEvents: UnifiedCalendarEvent[] = [];

    const eventPromises = salonConfig.connections
      .filter(conn => conn.active)
      .map(async (connection) => {
        try {
          this.setProviderCredentials(connection);

          let events: UnifiedCalendarEvent[] = [];

          if (connection.provider === 'google') {
            const result = await this.googleClient.listEvents(connection.calendar_id, {
              timeMin,
              timeMax,
              singleEvents: true,
              orderBy: 'startTime',
            });
            
            events = result.items.map(event => 
              this.convertGoogleEventToUnified(event, connection)
            );
          } else if (connection.provider === 'outlook') {
            const result = await this.outlookClient.listEvents(connection.calendar_id, {
              startDateTime: timeMin,
              endDateTime: timeMax,
              orderby: 'start/dateTime',
            });
            
            events = result.value.map(event => 
              this.convertOutlookEventToUnified(event, connection)
            );
          }

          return events;
        } catch (error) {
          console.error(`Error listing events for ${connection.provider} calendar ${connection.calendar_id}:`, error);
          return [];
        }
      });

    const results = await Promise.all(eventPromises);
    results.forEach(events => allEvents.push(...events));

    // Sort events by start time
    return allEvents.sort((a, b) => 
      new Date(a.start.dateTime).getTime() - new Date(b.start.dateTime).getTime()
    );
  }

  async cancelBooking(
    connection: CalendarConnection,
    eventId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      this.setProviderCredentials(connection);

      if (connection.provider === 'google') {
        return await this.googleClient.cancelBooking(connection.calendar_id, eventId);
      } else if (connection.provider === 'outlook') {
        return await this.outlookClient.cancelBooking(eventId, connection.calendar_id);
      }

      return {
        success: false,
        error: 'Unsupported calendar provider',
      };
    } catch (error) {
      console.error('Error cancelling unified booking:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // =============================================================================
  // PROVIDER SELECTION AND OPTIMIZATION
  // =============================================================================

  private selectOptimalCalendar(
    salonConfig: SalonCalendarConfig,
    staffMember?: string,
    preferredProvider?: CalendarProvider
  ): CalendarConnection | null {
    const activeConnections = salonConfig.connections.filter(conn => conn.active);

    if (activeConnections.length === 0) {
      return null;
    }

    // 1. Filter by staff member if specified
    let candidates = staffMember
      ? activeConnections.filter(conn => conn.staff_member === staffMember)
      : activeConnections;

    if (candidates.length === 0) {
      // Fallback to any active connection if no staff-specific calendar
      candidates = activeConnections;
    }

    // 2. Filter by preferred provider if specified
    if (preferredProvider) {
      const providerCandidates = candidates.filter(conn => conn.provider === preferredProvider);
      if (providerCandidates.length > 0) {
        candidates = providerCandidates;
      }
    }

    // 3. Prefer primary calendars
    const primaryCandidates = candidates.filter(conn => conn.is_primary);
    if (primaryCandidates.length > 0) {
      return primaryCandidates[0] || null;
    }

    // 4. Return first available candidate
    return candidates[0] || null;
  }

  private mergeAvailabilitySlots(slots: UnifiedAvailabilitySlot[]): UnifiedAvailabilitySlot[] {
    // Group slots by time period
    const timeSlotMap = new Map<string, UnifiedAvailabilitySlot[]>();

    slots.forEach(slot => {
      const key = `${slot.start}-${slot.end}`;
      if (!timeSlotMap.has(key)) {
        timeSlotMap.set(key, []);
      }
      timeSlotMap.get(key)!.push(slot);
    });

    // Merge slots for same time periods
    const mergedSlots: UnifiedAvailabilitySlot[] = [];

    timeSlotMap.forEach((periodSlots) => {
      if (periodSlots.length === 0) return;
      
      const firstSlot = periodSlots[0];
      if (!firstSlot) return;
      
      // A slot is available only if ALL calendars show it as available
      const isAvailable = periodSlots.every(slot => slot.available);
      
      mergedSlots.push({
        start: firstSlot.start,
        end: firstSlot.end,
        available: isAvailable,
        provider: firstSlot.provider, // Use first provider for display
        calendar_id: firstSlot.calendar_id,
        staff_member: firstSlot.staff_member,
      });
    });

    return mergedSlots.sort((a, b) => 
      new Date(a.start).getTime() - new Date(b.start).getTime()
    );
  }

  // =============================================================================
  // EVENT CONVERSION UTILITIES
  // =============================================================================

  private convertGoogleEventToUnified(
    event: CalendarEvent,
    connection: CalendarConnection
  ): UnifiedCalendarEvent {
    return {
      id: event.id,
      title: event.summary,
      description: event.description,
      start: event.start,
      end: event.end,
      attendees: event.attendees?.map(attendee => ({
        email: attendee.email,
        name: attendee.displayName,
        status: attendee.responseStatus,
      })),
      provider: 'google',
      calendar_id: connection.calendar_id,
      location: event.location,
      status: event.status,
    };
  }

  private convertOutlookEventToUnified(
    event: OutlookEvent,
    connection: CalendarConnection
  ): UnifiedCalendarEvent {
    return {
      id: event.id,
      title: event.subject,
      description: event.body.content,
      start: event.start,
      end: event.end,
      attendees: event.attendees?.map(attendee => ({
        email: attendee.emailAddress.address,
        name: attendee.emailAddress.name,
        status: attendee.status.response,
      })),
      provider: 'outlook',
      calendar_id: connection.calendar_id,
      location: event.location?.displayName,
      status: event.showAs === 'busy' ? 'confirmed' : 'tentative',
    };
  }

  // =============================================================================
  // AUTHENTICATION MANAGEMENT
  // =============================================================================

  private setProviderCredentials(connection: CalendarConnection): void {
    if (connection.provider === 'google') {
      this.googleClient.setCredentials({
        accessToken: connection.credentials.access_token,
        refreshToken: connection.credentials.refresh_token,
      });
    } else if (connection.provider === 'outlook') {
      this.outlookClient.setCredentials({
        accessToken: connection.credentials.access_token,
        refreshToken: connection.credentials.refresh_token,
      });
    }
  }

  // =============================================================================
  // HEALTH CHECKS
  // =============================================================================

  async healthCheck(salonConfig: SalonCalendarConfig): Promise<{
    overall_status: 'healthy' | 'degraded' | 'error';
    connections: Array<{
      provider: CalendarProvider;
      calendar_id: string;
      status: 'healthy' | 'error';
      details?: string;
    }>;
  }> {
    const connectionResults = await Promise.all(
      salonConfig.connections
        .filter(conn => conn.active)
        .map(async (connection) => {
          try {
            this.setProviderCredentials(connection);

            let health;
            if (connection.provider === 'google') {
              health = await this.googleClient.healthCheck();
            } else if (connection.provider === 'outlook') {
              health = await this.outlookClient.healthCheck();
            } else {
              health = { status: 'error' as const, details: 'Unknown provider' };
            }

            return {
              provider: connection.provider,
              calendar_id: connection.calendar_id,
              status: health.status,
              details: health.details,
            };
          } catch (error) {
            return {
              provider: connection.provider,
              calendar_id: connection.calendar_id,
              status: 'error' as const,
              details: error instanceof Error ? error.message : 'Unknown error',
            };
          }
        })
    );

    const healthyCount = connectionResults.filter(result => result.status === 'healthy').length;
    const totalCount = connectionResults.length;

    let overallStatus: 'healthy' | 'degraded' | 'error';
    if (healthyCount === totalCount) {
      overallStatus = 'healthy';
    } else if (healthyCount > 0) {
      overallStatus = 'degraded';
    } else {
      overallStatus = 'error';
    }

    return {
      overall_status: overallStatus,
      connections: connectionResults,
    };
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

let calendarOrchestrator: CalendarOrchestrator | null = null;

export function getCalendarOrchestrator(): CalendarOrchestrator {
  if (!calendarOrchestrator) {
    calendarOrchestrator = new CalendarOrchestrator();
  }
  return calendarOrchestrator;
}

export { CalendarOrchestrator };
export default CalendarOrchestrator;