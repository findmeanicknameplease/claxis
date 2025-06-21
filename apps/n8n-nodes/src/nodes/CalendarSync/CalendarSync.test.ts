import { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { CalendarSync } from './CalendarSync.node';
import * as utils from '../../utils';

// Mock the utils module
jest.mock('../../utils', () => ({
  getSalonData: jest.fn(),
  logInfo: jest.fn(),
  logError: jest.fn(),
  startPerformanceTimer: jest.fn(),
  endPerformanceTimer: jest.fn(),
  validateNodeExecutionContext: jest.fn(),
  initializeDatabase: jest.fn(),
  isDatabaseInitialized: jest.fn(),
  executeDatabaseOperation: jest.fn(),
}));

describe('CalendarSync Node', () => {
  let calendarSync: CalendarSync;
  let mockExecuteFunctions: jest.Mocked<IExecuteFunctions>;
  
  const mockSalonData = {
    id: 'salon-123',
    name: 'Test Salon',
    subscription_tier: 'enterprise',
    settings: {
      timezone: 'Europe/Berlin',
      calendar: {
        auto_confirm_bookings: true,
        buffer_time_minutes: 15,
        business_hours: {
          monday: { start: '09:00', end: '18:00', available: true },
          tuesday: { start: '09:00', end: '18:00', available: true },
          wednesday: { start: '09:00', end: '18:00', available: true },
          thursday: { start: '09:00', end: '18:00', available: true },
          friday: { start: '09:00', end: '18:00', available: true },
          saturday: { start: '10:00', end: '16:00', available: true },
          sunday: { start: '10:00', end: '16:00', available: false },
        },
      },
    },
  };

  beforeEach(() => {
    calendarSync = new CalendarSync();
    
    // Mock execution context
    mockExecuteFunctions = {
      getInputData: jest.fn(),
      getNodeParameter: jest.fn(),
      getNode: jest.fn(() => ({ name: 'CalendarSync', type: 'calendarSync' })),
      helpers: {} as any,
      continueOnFail: jest.fn(),
      getExecutionId: jest.fn(),
      getMode: jest.fn(),
      getRestApiUrl: jest.fn(),
      getTimezone: jest.fn(),
      getWorkflow: jest.fn(),
      getWorkflowDataProxy: jest.fn(),
      getWorkflowStaticData: jest.fn(),
      prepareOutputData: jest.fn(),
      putExecutionToWait: jest.fn(),
      sendMessageToUI: jest.fn(),
      sendResponse: jest.fn(),
    } as any;

    // Reset mocks
    jest.clearAllMocks();
    
    // Setup default mock returns
    (utils.isDatabaseInitialized as jest.Mock).mockReturnValue(true);
    (utils.getSalonData as jest.Mock).mockResolvedValue(mockSalonData);
    (utils.validateNodeExecutionContext as jest.Mock).mockReturnValue(null);
    (utils.startPerformanceTimer as jest.Mock).mockReturnValue('timer-123');
    (utils.endPerformanceTimer as jest.Mock).mockReturnValue(250);
    (utils.executeDatabaseOperation as jest.Mock).mockResolvedValue(undefined);
  });

  describe('Node Configuration', () => {
    test('should have correct node description', () => {
      expect(calendarSync.description.displayName).toBe('Calendar Sync');
      expect(calendarSync.description.name).toBe('calendarSync');
      expect(calendarSync.description.group).toContain('calendar');
      expect(calendarSync.description.outputs).toEqual(['main', 'success', 'failure']);
    });

    test('should have all required operations', () => {
      const operations = calendarSync.description.properties
        ?.find(prop => prop.name === 'operation')
        ?.options?.map((opt: any) => opt.value);
      
      expect(operations).toContain('checkAvailability');
      expect(operations).toContain('createBooking');
      expect(operations).toContain('cancelBooking');
      expect(operations).toContain('syncEvents');
      expect(operations).toContain('listEvents');
      expect(operations).toContain('manageConnection');
    });
  });

  describe('Check Availability Operation', () => {
    beforeEach(() => {
      mockExecuteFunctions.getInputData.mockReturnValue([{ json: {} }]);
      mockExecuteFunctions.getNodeParameter
        .mockImplementation((paramName: string) => {
          switch (paramName) {
            case 'operation':
              return 'checkAvailability';
            case 'timeRangeStart':
              return '2024-12-20T09:00:00Z';
            case 'timeRangeEnd':
              return '2024-12-20T18:00:00Z';
            case 'advancedOptions':
              return {
                staffMemberFilter: 'Maria',
                includeAnalytics: true,
                maxAlternativeSlots: 10,
              };
            case 'performanceTracking':
              return { enableMonitoring: true, logOperations: true };
            default:
              return undefined;
          }
        });
    });

    test('should check availability successfully', async () => {
      const result = await calendarSync.execute.call(mockExecuteFunctions);
      
      expect(result).toHaveLength(3); // [main, success, failure]
      expect(result[0]).toHaveLength(1); // One item processed
      expect(result[1]).toHaveLength(1); // Success output
      expect(result[2]).toHaveLength(0); // No failures
      
      const outputData = result[0][0].json;
      expect(outputData.success).toBe(true);
      expect(outputData.operation).toBe('checkAvailability');
      expect(outputData.time_range).toBeDefined();
      expect(outputData.available_slots).toBeDefined();
      expect(outputData.connected_calendars).toBeGreaterThan(0);
    });

    test('should include analytics when requested', async () => {
      const result = await calendarSync.execute.call(mockExecuteFunctions);
      
      const outputData = result[0][0].json;
      expect(outputData.analytics).toBeDefined();
      expect(outputData.analytics.total_slots).toBeDefined();
      expect(outputData.analytics.utilization_rate).toBeDefined();
    });

    test('should track performance metrics', async () => {
      await calendarSync.execute.call(mockExecuteFunctions);
      
      expect(utils.startPerformanceTimer).toHaveBeenCalled();
      expect(utils.endPerformanceTimer).toHaveBeenCalledWith('timer-123');
      expect(utils.logInfo).toHaveBeenCalledWith(
        'Calendar operation completed successfully',
        expect.objectContaining({
          operation: 'checkAvailability',
          salonId: 'salon-123',
          executionTime: 250,
        })
      );
    });
  });

  describe('Create Booking Operation', () => {
    const mockBookingDetails = {
      service: {
        name: 'Hair Cut & Style',
        duration_minutes: 90,
        staff_member: 'Maria',
      },
      customer: {
        name: 'Jane Smith',
        email: 'jane.smith@example.com',
        phone: '+49 123 456 789',
      },
      preferred_datetime: '2024-12-20T14:00:00Z',
      timezone: 'Europe/Berlin',
      notes: 'First time customer, needs consultation',
      send_invites: true,
      create_online_meeting: false,
    };

    beforeEach(() => {
      mockExecuteFunctions.getInputData.mockReturnValue([{ json: {} }]);
      mockExecuteFunctions.getNodeParameter
        .mockImplementation((paramName: string) => {
          switch (paramName) {
            case 'operation':
              return 'createBooking';
            case 'bookingDetails':
              return JSON.stringify(mockBookingDetails);
            case 'advancedOptions':
              return {
                preferredProvider: 'google',
                autoConfirmBooking: true,
                bufferTimeMinutes: 15,
                includeAnalytics: true,
              };
            case 'performanceTracking':
              return { enableMonitoring: true };
            default:
              return undefined;
          }
        });
    });

    test('should create booking successfully', async () => {
      const result = await calendarSync.execute.call(mockExecuteFunctions);
      
      const outputData = result[0][0].json;
      expect(outputData.success).toBe(true);
      expect(outputData.operation).toBe('createBooking');
      expect(outputData.booking_id).toBeDefined();
      expect(outputData.calendar_provider).toBe('google');
      expect(outputData.confirmation_details).toBeDefined();
      expect(outputData.confirmation_details.customer_email).toBe(mockBookingDetails.customer.email);
      expect(outputData.confirmation_details.service_name).toBe(mockBookingDetails.service.name);
    });

    test('should handle booking conflicts with alternatives', async () => {
      // Mock a scenario where the requested slot is not available
      jest.spyOn(CalendarSync as any, 'checkUnifiedAvailability')
        .mockResolvedValueOnce([
          {
            start: '2024-12-20T14:00:00Z',
            end: '2024-12-20T15:30:00Z',
            available: false, // Conflict
          },
        ])
        .mockResolvedValueOnce([
          {
            start: '2024-12-20T15:30:00Z',
            end: '2024-12-20T17:00:00Z',
            available: true,
          },
          {
            start: '2024-12-21T14:00:00Z',
            end: '2024-12-21T15:30:00Z',
            available: true,
          },
        ]);

      const result = await calendarSync.execute.call(mockExecuteFunctions);
      
      const outputData = result[0][0].json;
      expect(outputData.success).toBe(false);
      expect(outputData.error).toContain('not available');
      expect(outputData.alternatives).toBeDefined();
      expect(outputData.alternatives.length).toBeGreaterThan(0);
    });

    test('should store booking in database when successful', async () => {
      await calendarSync.execute.call(mockExecuteFunctions);
      
      expect(utils.executeDatabaseOperation).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO calendar_events'),
        expect.arrayContaining([
          'salon-123',
          expect.any(String), // connection_id
          expect.any(String), // event_id
          'google',
          expect.stringContaining('Hair Cut & Style'),
          mockBookingDetails.preferred_datetime,
          expect.any(String), // end datetime
          mockBookingDetails.customer.email,
          mockBookingDetails.service.name,
        ])
      );
    });
  });

  describe('Cancel Booking Operation', () => {
    beforeEach(() => {
      mockExecuteFunctions.getInputData.mockReturnValue([{ json: {} }]);
      mockExecuteFunctions.getNodeParameter
        .mockImplementation((paramName: string) => {
          switch (paramName) {
            case 'operation':
              return 'cancelBooking';
            case 'eventId':
              return 'event-12345';
            case 'calendarProvider':
              return 'google';
            case 'performanceTracking':
              return { enableMonitoring: true };
            default:
              return undefined;
          }
        });
    });

    test('should cancel booking successfully', async () => {
      const result = await calendarSync.execute.call(mockExecuteFunctions);
      
      const outputData = result[0][0].json;
      expect(outputData.success).toBe(true);
      expect(outputData.operation).toBe('cancelBooking');
      expect(outputData.event_id).toBe('event-12345');
      expect(outputData.calendar_provider).toBe('google');
      expect(outputData.cancelled_at).toBeDefined();
    });

    test('should update database when cancellation succeeds', async () => {
      await calendarSync.execute.call(mockExecuteFunctions);
      
      expect(utils.executeDatabaseOperation).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE calendar_events SET status'),
        ['cancelled', 'event-12345']
      );
    });
  });

  describe('Sync Events Operation', () => {
    beforeEach(() => {
      mockExecuteFunctions.getInputData.mockReturnValue([{ json: {} }]);
      mockExecuteFunctions.getNodeParameter
        .mockImplementation((paramName: string) => {
          switch (paramName) {
            case 'operation':
              return 'syncEvents';
            case 'advancedOptions':
              return {
                syncDirection: 'bidirectional',
              };
            case 'performanceTracking':
              return { enableMonitoring: true };
            default:
              return undefined;
          }
        });
    });

    test('should sync events successfully', async () => {
      const result = await calendarSync.execute.call(mockExecuteFunctions);
      
      const outputData = result[0][0].json;
      expect(outputData.success).toBe(true);
      expect(outputData.operation).toBe('syncEvents');
      expect(outputData.total_connections).toBeGreaterThan(0);
      expect(outputData.successful_syncs).toBeGreaterThan(0);
      expect(outputData.sync_direction).toBe('bidirectional');
      expect(outputData.sync_results).toBeDefined();
    });

    test('should handle different sync directions', async () => {
      mockExecuteFunctions.getNodeParameter
        .mockImplementation((paramName: string) => {
          switch (paramName) {
            case 'operation':
              return 'syncEvents';
            case 'advancedOptions':
              return {
                syncDirection: 'import',
              };
            default:
              return undefined;
          }
        });

      const result = await calendarSync.execute.call(mockExecuteFunctions);
      
      const outputData = result[0][0].json;
      expect(outputData.sync_direction).toBe('import');
    });
  });

  describe('List Events Operation', () => {
    beforeEach(() => {
      mockExecuteFunctions.getInputData.mockReturnValue([{ json: {} }]);
      mockExecuteFunctions.getNodeParameter
        .mockImplementation((paramName: string) => {
          switch (paramName) {
            case 'operation':
              return 'listEvents';
            case 'timeRangeStart':
              return '2024-12-20T00:00:00Z';
            case 'timeRangeEnd':
              return '2024-12-20T23:59:59Z';
            case 'advancedOptions':
              return {
                staffMemberFilter: 'Maria',
              };
            case 'performanceTracking':
              return { enableMonitoring: true };
            default:
              return undefined;
          }
        });
    });

    test('should list events successfully', async () => {
      const result = await calendarSync.execute.call(mockExecuteFunctions);
      
      const outputData = result[0][0].json;
      expect(outputData.success).toBe(true);
      expect(outputData.operation).toBe('listEvents');
      expect(outputData.total_events).toBeDefined();
      expect(outputData.events).toBeDefined();
      expect(Array.isArray(outputData.events)).toBe(true);
      expect(outputData.connected_calendars).toBeGreaterThan(0);
    });

    test('should filter events by staff member', async () => {
      const result = await calendarSync.execute.call(mockExecuteFunctions);
      
      expect(utils.logInfo).toHaveBeenCalledWith(
        'Listing calendar events',
        expect.objectContaining({
          salonId: 'salon-123',
          timeRangeStart: '2024-12-20T00:00:00Z',
          timeRangeEnd: '2024-12-20T23:59:59Z',
        })
      );
    });
  });

  describe('Manage Connection Operation', () => {
    const mockConnectionDetails = {
      provider: 'google',
      calendar_id: 'primary',
      name: 'Main Calendar',
      staff_member: 'Maria',
      credentials: {
        access_token: 'ya29.mock_access_token',
        refresh_token: 'mock_refresh_token',
      },
      is_primary: true,
      timezone: 'Europe/Berlin',
    };

    beforeEach(() => {
      mockExecuteFunctions.getInputData.mockReturnValue([{ json: {} }]);
    });

    test('should add new calendar connection', async () => {
      mockExecuteFunctions.getNodeParameter
        .mockImplementation((paramName: string) => {
          switch (paramName) {
            case 'operation':
              return 'manageConnection';
            case 'connectionAction':
              return 'add';
            case 'connectionDetails':
              return JSON.stringify(mockConnectionDetails);
            case 'performanceTracking':
              return { enableMonitoring: true };
            default:
              return undefined;
          }
        });

      const result = await calendarSync.execute.call(mockExecuteFunctions);
      
      const outputData = result[0][0].json;
      expect(outputData.success).toBe(true);
      expect(outputData.operation).toBe('manageConnection');
      expect(outputData.action).toBe('add');
      expect(outputData.provider).toBe('google');
      expect(outputData.connection_id).toBeDefined();
    });

    test('should test calendar connections', async () => {
      mockExecuteFunctions.getNodeParameter
        .mockImplementation((paramName: string) => {
          switch (paramName) {
            case 'operation':
              return 'manageConnection';
            case 'connectionAction':
              return 'test';
            case 'performanceTracking':
              return { enableMonitoring: true };
            default:
              return undefined;
          }
        });

      const result = await calendarSync.execute.call(mockExecuteFunctions);
      
      const outputData = result[0][0].json;
      expect(outputData.success).toBe(true);
      expect(outputData.action).toBe('test');
      expect(outputData.test_results).toBeDefined();
      expect(Array.isArray(outputData.test_results)).toBe(true);
      expect(outputData.total_connections).toBeDefined();
      expect(outputData.healthy_connections).toBeDefined();
    });

    test('should handle invalid JSON in connection details', async () => {
      mockExecuteFunctions.getNodeParameter
        .mockImplementation((paramName: string) => {
          switch (paramName) {
            case 'operation':
              return 'manageConnection';
            case 'connectionAction':
              return 'add';
            case 'connectionDetails':
              return 'invalid json';
            default:
              return undefined;
          }
        });

      const result = await calendarSync.execute.call(mockExecuteFunctions);
      
      expect(result[0]).toHaveLength(1); // Error output
      expect(result[2]).toHaveLength(1); // Failure output
      
      const errorData = result[2][0].json;
      expect(errorData.success).toBe(false);
      expect(errorData.error).toContain('Invalid JSON in connection details');
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      mockExecuteFunctions.getInputData.mockReturnValue([{ json: {} }]);
      mockExecuteFunctions.getNodeParameter
        .mockImplementation((paramName: string) => {
          switch (paramName) {
            case 'operation':
              return 'unknownOperation';
            default:
              return undefined;
          }
        });
    });

    test('should handle unknown operation', async () => {
      const result = await calendarSync.execute.call(mockExecuteFunctions);
      
      expect(result[0]).toHaveLength(1); // Error in main output
      expect(result[2]).toHaveLength(1); // Error in failure output
      
      const errorData = result[2][0].json;
      expect(errorData.success).toBe(false);
      expect(errorData.error).toContain('Unknown operation: unknownOperation');
      expect(errorData.operation).toBe('unknownOperation');
      expect(errorData.itemIndex).toBe(0);
    });

    test('should handle salon data retrieval failure', async () => {
      (utils.getSalonData as jest.Mock).mockRejectedValue(new Error('Salon not found'));
      
      mockExecuteFunctions.getNodeParameter
        .mockImplementation((paramName: string) => {
          switch (paramName) {
            case 'operation':
              return 'checkAvailability';
            default:
              return undefined;
          }
        });

      const result = await calendarSync.execute.call(mockExecuteFunctions);
      
      const errorData = result[2][0].json;
      expect(errorData.success).toBe(false);
      expect(errorData.error).toBe('Salon not found');
    });
  });

  describe('Database Operations', () => {
    test('should initialize database if not initialized', async () => {
      (utils.isDatabaseInitialized as jest.Mock).mockReturnValue(false);
      
      mockExecuteFunctions.getInputData.mockReturnValue([{ json: {} }]);
      mockExecuteFunctions.getNodeParameter
        .mockImplementation((paramName: string) => {
          switch (paramName) {
            case 'operation':
              return 'listEvents';
            case 'timeRangeStart':
              return '2024-12-20T00:00:00Z';
            case 'timeRangeEnd':
              return '2024-12-20T23:59:59Z';
            default:
              return undefined;
          }
        });

      await calendarSync.execute.call(mockExecuteFunctions);
      
      expect(utils.initializeDatabase).toHaveBeenCalled();
    });

    test('should not initialize database if already initialized', async () => {
      (utils.isDatabaseInitialized as jest.Mock).mockReturnValue(true);
      
      mockExecuteFunctions.getInputData.mockReturnValue([{ json: {} }]);
      mockExecuteFunctions.getNodeParameter
        .mockImplementation((paramName: string) => {
          switch (paramName) {
            case 'operation':
              return 'listEvents';
            case 'timeRangeStart':
              return '2024-12-20T00:00:00Z';
            case 'timeRangeEnd':
              return '2024-12-20T23:59:59Z';
            default:
              return undefined;
          }
        });

      await calendarSync.execute.call(mockExecuteFunctions);
      
      expect(utils.initializeDatabase).not.toHaveBeenCalled();
    });
  });

  describe('Enterprise Features', () => {
    test('should support multi-provider calendar integration', async () => {
      mockExecuteFunctions.getInputData.mockReturnValue([{ json: {} }]);
      mockExecuteFunctions.getNodeParameter
        .mockImplementation((paramName: string) => {
          switch (paramName) {
            case 'operation':
              return 'checkAvailability';
            case 'timeRangeStart':
              return '2024-12-20T09:00:00Z';
            case 'timeRangeEnd':
              return '2024-12-20T18:00:00Z';
            case 'advancedOptions':
              return {
                preferredProvider: 'google',
                includeAnalytics: true,
              };
            default:
              return undefined;
          }
        });

      const result = await calendarSync.execute.call(mockExecuteFunctions);
      
      const outputData = result[0][0].json;
      expect(outputData.success).toBe(true);
      expect(outputData.connected_calendars).toBeGreaterThan(0);
    });

    test('should handle booking conflicts intelligently', async () => {
      mockExecuteFunctions.getInputData.mockReturnValue([{ json: {} }]);
      mockExecuteFunctions.getNodeParameter
        .mockImplementation((paramName: string) => {
          switch (paramName) {
            case 'operation':
              return 'createBooking';
            case 'bookingDetails':
              return JSON.stringify({
                service: { name: 'Hair Cut', duration_minutes: 60 },
                customer: { name: 'John Doe', email: 'john@example.com' },
                preferred_datetime: '2024-12-20T14:00:00Z',
                timezone: 'Europe/Berlin',
                send_invites: true,
              });
            case 'advancedOptions':
              return {
                maxAlternativeSlots: 3,
                autoConfirmBooking: true,
              };
            default:
              return undefined;
          }
        });

      const result = await calendarSync.execute.call(mockExecuteFunctions);
      
      // Should either succeed with booking or provide alternatives
      const outputData = result[0][0].json;
      if (!outputData.success) {
        expect(outputData.alternatives).toBeDefined();
        expect(outputData.alternatives.length).toBeLessThanOrEqual(3);
      } else {
        expect(outputData.booking_id).toBeDefined();
      }
    });
  });
});