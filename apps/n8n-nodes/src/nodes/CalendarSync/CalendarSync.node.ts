import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeOperationError,
} from 'n8n-workflow';

import {
  SalonData,
  ConversationContext,
} from '../../types';

import {
  getSalonData,
  logInfo,
  logError,
  startPerformanceTimer,
  endPerformanceTimer,
  validateNodeExecutionContext,
  initializeDatabase,
  isDatabaseInitialized,
  executeDatabaseOperation,
} from '../../utils';

// =============================================================================
// CALENDAR SYNC NODE
// =============================================================================
// Enterprise calendar synchronization and booking automation
// - Multi-provider support (Google Calendar, Outlook Calendar)
// - Real-time availability checking and conflict resolution
// - Automated booking creation with customer notifications
// - Advanced scheduling optimization and staff management
// =============================================================================

export class CalendarSync implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Calendar Sync',
    name: 'calendarSync',
    icon: 'fa:calendar-check',
    group: ['calendar'],
    version: 1,
    description: 'Enterprise calendar synchronization and booking automation for premium beauty salons',
    defaults: {
      name: 'Calendar Sync',
    },
    inputs: ['main'],
    outputs: ['main', 'success', 'failure'],
    credentials: [],
    properties: [
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        options: [
          {
            name: 'Check Availability',
            value: 'checkAvailability',
            description: 'Check availability across connected calendars',
            action: 'Check availability across multiple calendar providers',
          },
          {
            name: 'Create Booking',
            value: 'createBooking',
            description: 'Create a new booking with conflict resolution',
            action: 'Create booking with automatic conflict resolution',
          },
          {
            name: 'Cancel Booking',
            value: 'cancelBooking',
            description: 'Cancel an existing booking across all providers',
            action: 'Cancel booking and notify attendees',
          },
          {
            name: 'Sync Events',
            value: 'syncEvents',
            description: 'Synchronize events from external calendars',
            action: 'Sync events from Google Calendar and Outlook',
          },
          {
            name: 'List Events',
            value: 'listEvents',
            description: 'List events from connected calendars',
            action: 'List events from all connected calendar providers',
          },
          {
            name: 'Manage Connection',
            value: 'manageConnection',
            description: 'Add or update calendar connection',
            action: 'Manage calendar provider connections',
          },
        ],
        default: 'checkAvailability',
      },

      // Check Availability Options
      {
        displayName: 'Time Range Start',
        name: 'timeRangeStart',
        type: 'dateTime',
        displayOptions: {
          show: {
            operation: ['checkAvailability', 'listEvents'],
          },
        },
        default: '',
        required: true,
        description: 'Start of the time range to check availability',
      },
      {
        displayName: 'Time Range End',
        name: 'timeRangeEnd',
        type: 'dateTime',
        displayOptions: {
          show: {
            operation: ['checkAvailability', 'listEvents'],
          },
        },
        default: '',
        required: true,
        description: 'End of the time range to check availability',
      },

      // Create Booking Options
      {
        displayName: 'Booking Details',
        name: 'bookingDetails',
        type: 'json',
        displayOptions: {
          show: {
            operation: ['createBooking'],
          },
        },
        default: '{\n  "service": {\n    "name": "Hair Cut",\n    "duration_minutes": 60,\n    "staff_member": "Maria"\n  },\n  "customer": {\n    "name": "John Doe",\n    "email": "john@example.com",\n    "phone": "+49 123 456 789"\n  },\n  "preferred_datetime": "2024-12-20T14:00:00Z",\n  "timezone": "Europe/Berlin",\n  "notes": "First time customer",\n  "send_invites": true,\n  "create_online_meeting": false\n}',
        required: true,
        description: 'Booking request details in JSON format',
      },

      // Cancel Booking Options
      {
        displayName: 'Event ID',
        name: 'eventId',
        type: 'string',
        displayOptions: {
          show: {
            operation: ['cancelBooking'],
          },
        },
        default: '',
        required: true,
        description: 'ID of the event to cancel',
      },
      {
        displayName: 'Calendar Provider',
        name: 'calendarProvider',
        type: 'options',
        displayOptions: {
          show: {
            operation: ['cancelBooking'],
          },
        },
        options: [
          {
            name: 'Google Calendar',
            value: 'google',
          },
          {
            name: 'Outlook Calendar',
            value: 'outlook',
          },
        ],
        default: 'google',
        required: true,
        description: 'Calendar provider for the event to cancel',
      },

      // Connection Management Options
      {
        displayName: 'Connection Action',
        name: 'connectionAction',
        type: 'options',
        displayOptions: {
          show: {
            operation: ['manageConnection'],
          },
        },
        options: [
          {
            name: 'Add Connection',
            value: 'add',
          },
          {
            name: 'Update Connection',
            value: 'update',
          },
          {
            name: 'Remove Connection',
            value: 'remove',
          },
          {
            name: 'Test Connection',
            value: 'test',
          },
        ],
        default: 'add',
        required: true,
        description: 'Action to perform on calendar connection',
      },
      {
        displayName: 'Connection Details',
        name: 'connectionDetails',
        type: 'json',
        displayOptions: {
          show: {
            operation: ['manageConnection'],
            connectionAction: ['add', 'update'],
          },
        },
        default: '{\n  "provider": "google",\n  "calendar_id": "primary",\n  "name": "Main Calendar",\n  "staff_member": "Maria",\n  "credentials": {\n    "access_token": "...",\n    "refresh_token": "..."\n  },\n  "is_primary": true,\n  "timezone": "Europe/Berlin"\n}',
        required: true,
        description: 'Calendar connection configuration',
      },

      // Advanced Options
      {
        displayName: 'Advanced Options',
        name: 'advancedOptions',
        type: 'collection',
        placeholder: 'Add Option',
        default: {},
        options: [
          {
            displayName: 'Staff Member Filter',
            name: 'staffMemberFilter',
            type: 'string',
            default: '',
            description: 'Filter events/availability by specific staff member',
          },
          {
            displayName: 'Preferred Provider',
            name: 'preferredProvider',
            type: 'options',
            options: [
              {
                name: 'Google Calendar',
                value: 'google',
              },
              {
                name: 'Outlook Calendar',
                value: 'outlook',
              },
            ],
            default: 'google',
            description: 'Preferred calendar provider for operations',
          },
          {
            displayName: 'Include Analytics',
            name: 'includeAnalytics',
            type: 'boolean',
            default: false,
            description: 'Include analytics data in the response',
          },
          {
            displayName: 'Auto Confirm Booking',
            name: 'autoConfirmBooking',
            type: 'boolean',
            default: true,
            description: 'Automatically confirm booking without manual approval',
          },
          {
            displayName: 'Buffer Time (minutes)',
            name: 'bufferTimeMinutes',
            type: 'number',
            default: 15,
            description: 'Buffer time to add before and after bookings',
          },
          {
            displayName: 'Max Alternative Slots',
            name: 'maxAlternativeSlots',
            type: 'number',
            default: 5,
            description: 'Maximum number of alternative time slots to suggest',
          },
          {
            displayName: 'Sync Direction',
            name: 'syncDirection',
            type: 'options',
            displayOptions: {
              show: {
                '/operation': ['syncEvents'],
              },
            },
            options: [
              {
                name: 'Import Only',
                value: 'import',
                description: 'Import events from external calendars only',
              },
              {
                name: 'Export Only',
                value: 'export',
                description: 'Export salon bookings to external calendars only',
              },
              {
                name: 'Bidirectional',
                value: 'bidirectional',
                description: 'Sync events in both directions',
              },
            ],
            default: 'bidirectional',
            description: 'Direction of calendar synchronization',
          },
        ],
      },

      // Performance Tracking
      {
        displayName: 'Performance Tracking',
        name: 'performanceTracking',
        type: 'collection',
        placeholder: 'Add Tracking Option',
        default: {},
        options: [
          {
            displayName: 'Enable Performance Monitoring',
            name: 'enableMonitoring',
            type: 'boolean',
            default: true,
            description: 'Track execution time and performance metrics',
          },
          {
            displayName: 'Log Calendar Operations',
            name: 'logOperations',
            type: 'boolean',
            default: true,
            description: 'Log detailed calendar operation information',
          },
          {
            displayName: 'Track Utilization Metrics',
            name: 'trackUtilization',
            type: 'boolean',
            default: false,
            description: 'Calculate and store calendar utilization metrics',
          },
        ],
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    // Initialize database if needed
    if (!isDatabaseInitialized()) {
      await initializeDatabase();
    }

    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];
    const successData: INodeExecutionData[] = [];
    const failureData: INodeExecutionData[] = [];

    for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
      try {
        // Start performance tracking
        const perfTrackingOptions = this.getNodeParameter('performanceTracking', itemIndex, {}) as any;
        const performanceTimer = perfTrackingOptions.enableMonitoring 
          ? startPerformanceTimer() 
          : null;

        // Validate execution context
        const validation = validateNodeExecutionContext(this);
        if (validation) {
          throw new NodeOperationError(this.getNode(), `Invalid execution context: ${validation}`, { itemIndex });
        }

        // Get salon data
        const salonData = await getSalonData(this, itemIndex);
        if (!salonData) {
          throw new NodeOperationError(this.getNode(), 'Salon data not found', { itemIndex });
        }

        // Get operation
        const operation = this.getNodeParameter('operation', itemIndex) as string;

        // Execute operation
        let result: any;
        switch (operation) {
          case 'checkAvailability':
            result = await CalendarSync.handleCheckAvailability(this, itemIndex, salonData);
            break;
          case 'createBooking':
            result = await CalendarSync.handleCreateBooking(this, itemIndex, salonData);
            break;
          case 'cancelBooking':
            result = await CalendarSync.handleCancelBooking(this, itemIndex, salonData);
            break;
          case 'syncEvents':
            result = await CalendarSync.handleSyncEvents(this, itemIndex, salonData);
            break;
          case 'listEvents':
            result = await CalendarSync.handleListEvents(this, itemIndex, salonData);
            break;
          case 'manageConnection':
            result = await CalendarSync.handleManageConnection(this, itemIndex, salonData);
            break;
          default:
            throw new NodeOperationError(this.getNode(), `Unknown operation: ${operation}`, { itemIndex });
        }

        // Add common metadata
        result.operation = operation;
        result.salon_id = salonData.id;
        result.processed_at = new Date().toISOString();
        result.itemIndex = itemIndex;

        // Performance tracking
        if (performanceTimer && perfTrackingOptions.enableMonitoring) {
          const executionTime = endPerformanceTimer(performanceTimer);
          result.performance = {
            execution_time_ms: executionTime,
            operation: operation,
          };

          if (perfTrackingOptions.logOperations) {
            logInfo('Calendar operation completed successfully', {
              operation,
              salonId: salonData.id,
              executionTime,
              itemIndex,
            });
          }
        }

        returnData.push({ json: result });
        successData.push({ json: { ...result, success: true } });

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        logError('Calendar operation failed', {
          operation: this.getNodeParameter('operation', itemIndex, 'unknown'),
          error: errorMessage,
          itemIndex,
        });

        const errorResult = {
          success: false,
          error: errorMessage,
          operation: this.getNodeParameter('operation', itemIndex, 'unknown'),
          itemIndex,
          processed_at: new Date().toISOString(),
        };

        returnData.push({ json: errorResult });
        failureData.push({ json: errorResult });
      }
    }

    return [returnData, successData, failureData];
  }

  // =============================================================================
  // OPERATION HANDLERS
  // =============================================================================

  private static async handleCheckAvailability(
    executionContext: IExecuteFunctions,
    itemIndex: number,
    salonData: SalonData
  ): Promise<Record<string, unknown>> {
    const timeRangeStart = executionContext.getNodeParameter('timeRangeStart', itemIndex) as string;
    const timeRangeEnd = executionContext.getNodeParameter('timeRangeEnd', itemIndex) as string;
    const advancedOptions = executionContext.getNodeParameter('advancedOptions', itemIndex, {}) as any;

    logInfo('Checking calendar availability', {
      salonId: salonData.id,
      timeRangeStart,
      timeRangeEnd,
      staffMemberFilter: advancedOptions.staffMemberFilter,
    });

    // Get calendar connections for the salon
    const connections = await CalendarSync.getCalendarConnections(salonData.id);
    
    if (connections.length === 0) {
      return {
        success: false,
        error: 'No calendar connections configured for this salon',
        available_slots: [],
        total_connections: 0,
      };
    }

    // Check availability across all connections
    const availabilitySlots = await CalendarSync.checkUnifiedAvailability(
      connections,
      timeRangeStart,
      timeRangeEnd,
      advancedOptions.staffMemberFilter,
      salonData.settings?.timezone || 'Europe/Berlin'
    );

    // Filter available slots
    const availableSlots = availabilitySlots.filter(slot => slot.available);

    // Include analytics if requested
    let analytics = null;
    if (advancedOptions.includeAnalytics) {
      analytics = await CalendarSync.calculateAvailabilityAnalytics(
        salonData.id,
        timeRangeStart,
        timeRangeEnd,
        availabilitySlots
      );
    }

    return {
      success: true,
      time_range: {
        start: timeRangeStart,
        end: timeRangeEnd,
        timezone: salonData.settings?.timezone || 'Europe/Berlin',
      },
      total_slots: availabilitySlots.length,
      available_slots: availableSlots.length,
      utilization_rate: availableSlots.length > 0 
        ? (availabilitySlots.length - availableSlots.length) / availabilitySlots.length 
        : 0,
      slots: availableSlots.slice(0, advancedOptions.maxAlternativeSlots || 20),
      connected_calendars: connections.length,
      analytics,
    };
  }

  private static async handleCreateBooking(
    executionContext: IExecuteFunctions,
    itemIndex: number,
    salonData: SalonData
  ): Promise<Record<string, unknown>> {
    const bookingDetailsStr = executionContext.getNodeParameter('bookingDetails', itemIndex) as string;
    const advancedOptions = executionContext.getNodeParameter('advancedOptions', itemIndex, {}) as any;

    let bookingDetails;
    try {
      bookingDetails = JSON.parse(bookingDetailsStr);
    } catch (error) {
      throw new NodeOperationError(executionContext.getNode(), 'Invalid JSON in booking details');
    }

    logInfo('Creating calendar booking', {
      salonId: salonData.id,
      serviceName: bookingDetails.service?.name,
      customerEmail: bookingDetails.customer?.email,
      preferredDateTime: bookingDetails.preferred_datetime,
    });

    // Get calendar connections
    const connections = await CalendarSync.getCalendarConnections(salonData.id);
    
    if (connections.length === 0) {
      return {
        success: false,
        error: 'No calendar connections configured for this salon',
      };
    }

    // Select optimal calendar connection
    const selectedConnection = CalendarSync.selectOptimalConnection(
      connections,
      bookingDetails.service?.staff_member,
      advancedOptions.preferredProvider
    );

    if (!selectedConnection) {
      return {
        success: false,
        error: 'No suitable calendar connection found',
      };
    }

    // Check availability for the requested slot
    const requestedStart = new Date(bookingDetails.preferred_datetime);
    const requestedEnd = new Date(
      requestedStart.getTime() + (bookingDetails.service?.duration_minutes || 60) * 60000
    );

    const availability = await CalendarSync.checkUnifiedAvailability(
      [selectedConnection],
      requestedStart.toISOString(),
      requestedEnd.toISOString(),
      bookingDetails.service?.staff_member,
      bookingDetails.timezone || 'Europe/Berlin'
    );

    const requestedSlot = availability.find(slot => 
      new Date(slot.start).getTime() === requestedStart.getTime()
    );

    if (!requestedSlot?.available) {
      // Find alternative slots
      const allAvailability = await CalendarSync.checkUnifiedAvailability(
        connections,
        requestedStart.toISOString(),
        new Date(requestedStart.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(), // Next 7 days
        bookingDetails.service?.staff_member,
        bookingDetails.timezone || 'Europe/Berlin'
      );

      const alternatives = allAvailability
        .filter(slot => slot.available)
        .slice(0, advancedOptions.maxAlternativeSlots || 5);

      return {
        success: false,
        error: 'Requested time slot is not available',
        alternatives,
        requested_slot: {
          start: requestedStart.toISOString(),
          end: requestedEnd.toISOString(),
          available: false,
        },
      };
    }

    // Create the booking
    const bookingResult = await CalendarSync.createUnifiedBooking(
      selectedConnection,
      bookingDetails,
      advancedOptions
    );

    if (bookingResult.success) {
      // Store booking in database
      await CalendarSync.storeBookingInDatabase(
        salonData.id,
        selectedConnection.id,
        bookingResult.event,
        bookingDetails
      );

      // Track analytics if enabled
      if (advancedOptions.includeAnalytics) {
        await CalendarSync.updateBookingAnalytics(salonData.id, bookingDetails);
      }
    }

    return {
      success: bookingResult.success,
      event: bookingResult.event,
      error: bookingResult.error,
      booking_id: bookingResult.event?.id,
      calendar_provider: selectedConnection.provider,
      calendar_id: selectedConnection.calendar_id,
      confirmation_details: {
        customer_email: bookingDetails.customer?.email,
        service_name: bookingDetails.service?.name,
        date_time: bookingDetails.preferred_datetime,
        duration_minutes: bookingDetails.service?.duration_minutes,
        staff_member: bookingDetails.service?.staff_member,
      },
    };
  }

  private static async handleCancelBooking(
    executionContext: IExecuteFunctions,
    itemIndex: number,
    salonData: SalonData
  ): Promise<Record<string, unknown>> {
    const eventId = executionContext.getNodeParameter('eventId', itemIndex) as string;
    const calendarProvider = executionContext.getNodeParameter('calendarProvider', itemIndex) as string;

    logInfo('Cancelling calendar booking', {
      salonId: salonData.id,
      eventId,
      provider: calendarProvider,
    });

    // Find the calendar connection
    const connections = await CalendarSync.getCalendarConnections(salonData.id);
    const connection = connections.find(conn => conn.provider === calendarProvider);

    if (!connection) {
      return {
        success: false,
        error: `No ${calendarProvider} calendar connection found`,
      };
    }

    // Cancel the booking
    const result = await CalendarSync.cancelUnifiedBooking(connection, eventId);

    if (result.success) {
      // Update database record
      await CalendarSync.updateBookingStatusInDatabase(eventId, 'cancelled');
    }

    return {
      success: result.success,
      error: result.error,
      event_id: eventId,
      calendar_provider: calendarProvider,
      cancelled_at: new Date().toISOString(),
    };
  }

  private static async handleSyncEvents(
    executionContext: IExecuteFunctions,
    itemIndex: number,
    salonData: SalonData
  ): Promise<Record<string, unknown>> {
    const advancedOptions = executionContext.getNodeParameter('advancedOptions', itemIndex, {}) as any;
    const syncDirection = advancedOptions.syncDirection || 'bidirectional';

    logInfo('Syncing calendar events', {
      salonId: salonData.id,
      syncDirection,
    });

    const connections = await CalendarSync.getCalendarConnections(salonData.id);
    const syncResults = [];

    for (const connection of connections) {
      try {
        const result = await CalendarSync.syncConnectionEvents(
          connection,
          syncDirection,
          salonData
        );
        syncResults.push(result);
      } catch (error) {
        syncResults.push({
          connection_id: connection.id,
          provider: connection.provider,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const successfulSyncs = syncResults.filter(result => result.success).length;
    const totalConnections = connections.length;

    return {
      success: successfulSyncs > 0,
      total_connections: totalConnections,
      successful_syncs: successfulSyncs,
      failed_syncs: totalConnections - successfulSyncs,
      sync_direction: syncDirection,
      sync_results: syncResults,
      last_sync_at: new Date().toISOString(),
    };
  }

  private static async handleListEvents(
    executionContext: IExecuteFunctions,
    itemIndex: number,
    salonData: SalonData
  ): Promise<Record<string, unknown>> {
    const timeRangeStart = executionContext.getNodeParameter('timeRangeStart', itemIndex) as string;
    const timeRangeEnd = executionContext.getNodeParameter('timeRangeEnd', itemIndex) as string;
    const advancedOptions = executionContext.getNodeParameter('advancedOptions', itemIndex, {}) as any;

    logInfo('Listing calendar events', {
      salonId: salonData.id,
      timeRangeStart,
      timeRangeEnd,
    });

    const connections = await CalendarSync.getCalendarConnections(salonData.id);
    const allEvents = [];

    for (const connection of connections) {
      try {
        const events = await CalendarSync.listConnectionEvents(
          connection,
          timeRangeStart,
          timeRangeEnd,
          advancedOptions.staffMemberFilter
        );
        allEvents.push(...events);
      } catch (error) {
        logError('Error listing events from connection', {
          connectionId: connection.id,
          provider: connection.provider,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Sort events by start time
    allEvents.sort((a, b) => 
      new Date(a.start.dateTime).getTime() - new Date(b.start.dateTime).getTime()
    );

    return {
      success: true,
      time_range: {
        start: timeRangeStart,
        end: timeRangeEnd,
      },
      total_events: allEvents.length,
      events: allEvents,
      connected_calendars: connections.length,
    };
  }

  private static async handleManageConnection(
    executionContext: IExecuteFunctions,
    itemIndex: number,
    salonData: SalonData
  ): Promise<Record<string, unknown>> {
    const connectionAction = executionContext.getNodeParameter('connectionAction', itemIndex) as string;

    logInfo('Managing calendar connection', {
      salonId: salonData.id,
      action: connectionAction,
    });

    switch (connectionAction) {
      case 'add':
      case 'update':
        const connectionDetailsStr = executionContext.getNodeParameter('connectionDetails', itemIndex) as string;
        let connectionDetails;
        
        try {
          connectionDetails = JSON.parse(connectionDetailsStr);
        } catch (error) {
          throw new NodeOperationError(executionContext.getNode(), 'Invalid JSON in connection details');
        }

        const result = await CalendarSync.saveCalendarConnection(
          salonData.id,
          connectionDetails,
          connectionAction === 'update'
        );

        return {
          success: result.success,
          connection_id: result.connection_id,
          action: connectionAction,
          provider: connectionDetails.provider,
          error: result.error,
        };

      case 'test':
        const connections = await CalendarSync.getCalendarConnections(salonData.id);
        const testResults = [];

        for (const connection of connections) {
          const health = await CalendarSync.testConnectionHealth(connection);
          testResults.push({
            connection_id: connection.id,
            provider: connection.provider,
            name: connection.name,
            status: health.status,
            details: health.details,
          });
        }

        return {
          success: true,
          action: 'test',
          test_results: testResults,
          total_connections: connections.length,
          healthy_connections: testResults.filter(r => r.status === 'healthy').length,
        };

      default:
        throw new NodeOperationError(executionContext.getNode(), `Unknown connection action: ${connectionAction}`);
    }
  }

  // =============================================================================
  // HELPER METHODS (Mocked for now - would integrate with actual calendar APIs)
  // =============================================================================

  private static async getCalendarConnections(salonId: string): Promise<any[]> {
    // Mock implementation - would query database for actual connections
    return [
      {
        id: 'conn-1',
        salon_id: salonId,
        provider: 'google',
        calendar_id: 'primary',
        name: 'Main Calendar',
        staff_member: 'Maria',
        is_primary: true,
        active: true,
        timezone: 'Europe/Berlin',
      },
    ];
  }

  private static async checkUnifiedAvailability(
    connections: any[],
    timeRangeStart: string,
    timeRangeEnd: string,
    staffMemberFilter?: string,
    timezone: string = 'Europe/Berlin'
  ): Promise<any[]> {
    // Mock implementation - would check actual calendar availability
    const slots = [];
    const start = new Date(timeRangeStart);
    const end = new Date(timeRangeEnd);
    const slotDuration = 30; // minutes

    let currentTime = new Date(start);
    while (currentTime < end) {
      const slotEnd = new Date(currentTime.getTime() + slotDuration * 60000);
      
      // Simple mock: available every other slot
      const available = Math.random() > 0.3;
      
      slots.push({
        start: currentTime.toISOString(),
        end: slotEnd.toISOString(),
        available,
        provider: 'google',
        calendar_id: 'primary',
        staff_member: staffMemberFilter || 'Maria',
      });
      
      currentTime = slotEnd;
    }

    return slots;
  }

  private static selectOptimalConnection(
    connections: any[],
    staffMember?: string,
    preferredProvider?: string
  ): any | null {
    let candidates = connections.filter(conn => conn.active);

    if (staffMember) {
      const staffCandidates = candidates.filter(conn => conn.staff_member === staffMember);
      if (staffCandidates.length > 0) {
        candidates = staffCandidates;
      }
    }

    if (preferredProvider) {
      const providerCandidates = candidates.filter(conn => conn.provider === preferredProvider);
      if (providerCandidates.length > 0) {
        candidates = providerCandidates;
      }
    }

    const primaryCandidates = candidates.filter(conn => conn.is_primary);
    return primaryCandidates.length > 0 ? primaryCandidates[0] : candidates[0] || null;
  }

  private static async createUnifiedBooking(
    connection: any,
    bookingDetails: any,
    options: any
  ): Promise<{ success: boolean; event?: any; error?: string }> {
    // Mock implementation - would create actual calendar event
    return {
      success: true,
      event: {
        id: `event-${Date.now()}`,
        title: `${bookingDetails.service.name} - ${bookingDetails.customer.name}`,
        start: {
          dateTime: bookingDetails.preferred_datetime,
          timeZone: bookingDetails.timezone,
        },
        end: {
          dateTime: new Date(
            new Date(bookingDetails.preferred_datetime).getTime() + 
            bookingDetails.service.duration_minutes * 60000
          ).toISOString(),
          timeZone: bookingDetails.timezone,
        },
        attendees: bookingDetails.send_invites ? [
          {
            email: bookingDetails.customer.email,
            name: bookingDetails.customer.name,
          },
        ] : [],
        provider: connection.provider,
        calendar_id: connection.calendar_id,
      },
    };
  }

  private static async cancelUnifiedBooking(
    connection: any,
    eventId: string
  ): Promise<{ success: boolean; error?: string }> {
    // Mock implementation - would cancel actual calendar event
    return { success: true };
  }

  private static async storeBookingInDatabase(
    salonId: string,
    connectionId: string,
    event: any,
    bookingDetails: any
  ): Promise<void> {
    // Mock implementation - would store in actual database
    await executeDatabaseOperation(
      'INSERT INTO calendar_events (salon_id, connection_id, external_event_id, provider, title, start_datetime, end_datetime, customer_email, service_name) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
      [
        salonId,
        connectionId,
        event.id,
        event.provider,
        event.title,
        event.start.dateTime,
        event.end.dateTime,
        bookingDetails.customer?.email,
        bookingDetails.service?.name,
      ]
    );
  }

  private static async updateBookingStatusInDatabase(
    eventId: string,
    status: string
  ): Promise<void> {
    // Mock implementation - would update actual database
    await executeDatabaseOperation(
      'UPDATE calendar_events SET status = $1, updated_at = now() WHERE external_event_id = $2',
      [status, eventId]
    );
  }

  private static async calculateAvailabilityAnalytics(
    salonId: string,
    timeRangeStart: string,
    timeRangeEnd: string,
    slots: any[]
  ): Promise<any> {
    const totalSlots = slots.length;
    const availableSlots = slots.filter(slot => slot.available).length;
    const utilization = totalSlots > 0 ? (totalSlots - availableSlots) / totalSlots : 0;

    return {
      total_slots: totalSlots,
      available_slots: availableSlots,
      booked_slots: totalSlots - availableSlots,
      utilization_rate: utilization,
      peak_hours: [], // Would calculate from actual data
      low_demand_hours: [], // Would calculate from actual data
    };
  }

  private static async updateBookingAnalytics(
    salonId: string,
    bookingDetails: any
  ): Promise<void> {
    // Mock implementation - would update analytics in database
    const today = new Date().toISOString().split('T')[0];
    
    await executeDatabaseOperation(
      `INSERT INTO calendar_analytics (salon_id, date, booking_events, total_booking_value) 
       VALUES ($1, $2, 1, $3)
       ON CONFLICT (salon_id, date) 
       DO UPDATE SET 
         booking_events = calendar_analytics.booking_events + 1,
         total_booking_value = calendar_analytics.total_booking_value + $3,
         updated_at = now()`,
      [salonId, today, 75.00] // Mock booking value
    );
  }

  private static async syncConnectionEvents(
    connection: any,
    syncDirection: string,
    salonData: any
  ): Promise<any> {
    // Mock implementation - would sync actual calendar events
    return {
      connection_id: connection.id,
      provider: connection.provider,
      success: true,
      events_imported: 5,
      events_exported: 3,
      conflicts_resolved: 0,
      last_sync: new Date().toISOString(),
    };
  }

  private static async listConnectionEvents(
    connection: any,
    timeRangeStart: string,
    timeRangeEnd: string,
    staffMemberFilter?: string
  ): Promise<any[]> {
    // Mock implementation - would list actual calendar events
    return [
      {
        id: 'event-1',
        title: 'Hair Cut - John Doe',
        start: { dateTime: timeRangeStart, timeZone: 'Europe/Berlin' },
        end: { dateTime: new Date(new Date(timeRangeStart).getTime() + 60 * 60000).toISOString(), timeZone: 'Europe/Berlin' },
        provider: connection.provider,
        calendar_id: connection.calendar_id,
        status: 'confirmed',
      },
    ];
  }

  private static async saveCalendarConnection(
    salonId: string,
    connectionDetails: any,
    isUpdate: boolean
  ): Promise<{ success: boolean; connection_id?: string; error?: string }> {
    // Mock implementation - would save to actual database
    return {
      success: true,
      connection_id: `conn-${Date.now()}`,
    };
  }

  private static async testConnectionHealth(connection: any): Promise<{
    status: 'healthy' | 'error';
    details?: string;
  }> {
    // Mock implementation - would test actual calendar API connection
    return { status: 'healthy' };
  }
}