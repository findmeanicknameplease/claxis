import { IExecuteFunctions } from 'n8n-workflow';
import { BookingEngine } from './BookingEngine.node';
import { SalonData } from '../../types';
import * as utils from '../../utils';

// Mock the utils module
jest.mock('../../utils', () => ({
  getSalonData: jest.fn(),
  executeDatabaseOperation: jest.fn(),
  logInfo: jest.fn(),
  logError: jest.fn(),
  startPerformanceTimer: jest.fn().mockReturnValue('timer-123'),
  endPerformanceTimer: jest.fn(),
  logBookingCreated: jest.fn(),
  validateNodeExecutionContext: jest.fn().mockReturnValue({ valid: true, errors: [], warnings: [] }),
  validateBookingRequest: jest.fn().mockReturnValue({ valid: true, errors: [], warnings: [] }),
  validateBookingTimeSlot: jest.fn().mockReturnValue({ valid: true, errors: [], warnings: [] }),
  initializeDatabase: jest.fn(),
  isDatabaseInitialized: jest.fn().mockReturnValue(true),
}));

describe('BookingEngine Node', () => {
  let bookingEngineNode: BookingEngine;
  let mockExecuteFunctions: jest.Mocked<IExecuteFunctions>;
  let mockSalonData: SalonData;

  beforeEach(() => {
    bookingEngineNode = new BookingEngine();
    
    mockSalonData = {
      id: '12345678-1234-1234-1234-123456789012',
      business_name: 'Test Salon',
      owner_name: 'John Doe',
      email: 'john@testsalon.com',
      phone: '+1234567890',
      whatsapp_number: '+1234567890',
      instagram_handle: 'testsalon',
      address: {
        street: '123 Test Street',
        city: 'Test City',
        state: 'Test State',
        postal_code: '12345',
        country: 'DE',
      },
      timezone: 'Europe/Berlin',
      subscription_tier: 'professional',
      subscription_status: 'active',
      settings: {
        business_hours: {
          monday: { is_open: true, open_time: '09:00', close_time: '17:00' },
          tuesday: { is_open: true, open_time: '09:00', close_time: '17:00' },
          wednesday: { is_open: true, open_time: '09:00', close_time: '17:00' },
          thursday: { is_open: true, open_time: '09:00', close_time: '17:00' },
          friday: { is_open: true, open_time: '09:00', close_time: '17:00' },
          saturday: { is_open: true, open_time: '10:00', close_time: '16:00' },
          sunday: { is_open: false },
        },
        booking_preferences: {
          advance_booking_days: 30,
          minimum_notice_minutes: 120,
          cancellation_policy_hours: 24,
          auto_confirm_bookings: true,
          require_deposit: false,
          deposit_percentage: 0,
        },
        whatsapp_settings: {
          enabled: true,
          phone_number_id: 'test_phone_id',
          access_token: 'test_access_token',
          webhook_verify_token: 'test_verify_token',
          business_account_id: 'test_business_id',
          message_templates: {},
          service_window_settings: {
            enabled: true,
            cost_threshold_euros: 0.10,
            template_cost_euros: 0.05,
            free_window_hours: 24,
            max_optimization_percentage: 80,
          },
        },
        ai_settings: {
          gemini_enabled: true,
          deepseek_enabled: true,
          elevenlabs_enabled: false,
          preferred_language: 'de',
          fallback_language: 'en',
          confidence_threshold: 0.8,
          cost_budget_monthly_euros: 100,
        },
        notification_preferences: {
          email_notifications: true,
          sms_notifications: false,
          notification_types: ['booking_created', 'booking_cancelled'],
        },
      },
      metadata: {},
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    };

    mockExecuteFunctions = {
      getInputData: jest.fn().mockReturnValue([{ json: {} }]),
      getNodeParameter: jest.fn(),
      getExecutionId: jest.fn().mockReturnValue('exec-123'),
      getMode: jest.fn().mockReturnValue('manual'),
      getNode: jest.fn().mockReturnValue({ 
        id: 'booking-engine-node',
        name: 'Booking Engine',
        type: 'bookingEngine',
      }),
    } as unknown as jest.Mocked<IExecuteFunctions>;

    (utils.getSalonData as jest.Mock).mockResolvedValue(mockSalonData);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createBooking operation', () => {
    beforeEach(() => {
      mockExecuteFunctions.getNodeParameter
        .mockReturnValueOnce('createBooking') // operation
        .mockReturnValueOnce('12345678-1234-1234-1234-123456789012') // salonId
        .mockReturnValueOnce('customer-123') // customerId
        .mockReturnValueOnce('service-456') // serviceId
        .mockReturnValueOnce('2024-06-17T14:00:00Z') // preferredDate
        .mockReturnValueOnce('14:00') // preferredTime
        .mockReturnValueOnce('staff-789') // staffMemberId
        .mockReturnValueOnce('Regular haircut please') // bookingNotes
        .mockReturnValueOnce('whatsapp') // sourceChannel
        .mockReturnValueOnce(true); // autoConfirm

      // Mock service data
      (utils.executeDatabaseOperation as jest.Mock)
        .mockResolvedValueOnce({
          success: true,
          data: {
            id: 'service-456',
            name: 'Haircut',
            duration_minutes: 60,
            price: 45.00,
          },
        })
        .mockResolvedValueOnce({
          success: true,
          data: [], // No conflicting bookings
        })
        .mockResolvedValueOnce({
          success: true,
          data: {
            id: 'staff-789',
            name: 'Alice Smith',
          },
        })
        .mockResolvedValueOnce({
          success: true,
          affected_rows: 1,
        });
    });

    it('should create booking successfully when no conflicts', async () => {
      const result = await bookingEngineNode.execute.call(mockExecuteFunctions);

      // Should return four arrays for the four outputs
      expect(result).toHaveLength(4);
      const [defaultOutput, successOutput, conflictOutput, errorOutput] = result;

      // Booking should be routed to success output (index 1)
      expect(successOutput).toHaveLength(1);
      expect(conflictOutput).toHaveLength(0);
      expect(errorOutput).toHaveLength(0);

      const bookingResult = successOutput[0].json;
      expect(bookingResult).toMatchObject({
        success: true,
        booking_id: expect.any(String),
        scheduled_time: expect.stringContaining('2024-06-17T14:00'),
        confirmation_message: expect.stringContaining('Booking Confirmed'),
      });

      expect(utils.logBookingCreated).toHaveBeenCalled();
    });

    it('should handle service not found', async () => {
      // Reset the mock from beforeEach and set up our own
      (utils.executeDatabaseOperation as jest.Mock).mockReset();
      (utils.executeDatabaseOperation as jest.Mock)
        .mockResolvedValueOnce({
          success: true,
          data: [], // Service not found
        });

      const result = await bookingEngineNode.execute.call(mockExecuteFunctions);
      const [defaultOutput, successOutput, conflictOutput, errorOutput] = result;

      expect(conflictOutput).toHaveLength(1);
      const bookingResult = conflictOutput[0].json;
      expect(bookingResult).toMatchObject({
        success: false,
        conflict_reason: expect.stringContaining('Service not found'),
      });
    });
  });

  describe('checkAvailability operation', () => {
    beforeEach(() => {
      mockExecuteFunctions.getNodeParameter
        .mockReturnValueOnce('checkAvailability') // operation
        .mockReturnValueOnce('12345678-1234-1234-1234-123456789012') // salonId
        .mockReturnValueOnce('customer-123') // customerId
        .mockReturnValueOnce('service-456') // serviceId
        .mockReturnValueOnce('2024-06-17T14:00:00Z') // preferredDate
        .mockReturnValueOnce('14:00') // preferredTime
        .mockReturnValueOnce('staff-789'); // staffMemberId

      (utils.executeDatabaseOperation as jest.Mock)
        .mockResolvedValueOnce({
          success: true,
          data: {
            id: 'service-456',
            name: 'Haircut',
            duration_minutes: 60,
            price: 45.00,
          },
        })
        .mockResolvedValueOnce({
          success: true,
          data: [], // No existing bookings - slot is available
        });
    });

    it('should check availability correctly', async () => {
      const result = await bookingEngineNode.execute.call(mockExecuteFunctions);

      expect(result[0]).toHaveLength(1);
      const availability = result[0][0].json;

      expect(availability).toMatchObject({
        availability_checked: true,
        service_details: expect.objectContaining({
          name: 'Haircut',
          duration_minutes: 60,
          price: 45.00,
        }),
      });
    });
  });

  describe('confirmBooking operation', () => {
    beforeEach(() => {
      mockExecuteFunctions.getNodeParameter
        .mockReturnValueOnce('confirmBooking') // operation
        .mockReturnValueOnce('12345678-1234-1234-1234-123456789012') // salonId
        .mockReturnValueOnce('booking-123'); // bookingId

      (utils.executeDatabaseOperation as jest.Mock)
        .mockResolvedValueOnce({
          success: true,
          data: {
            id: 'booking-123',
            status: 'pending',
            customer_id: 'customer-123',
            service_id: 'service-456',
          },
        })
        .mockResolvedValueOnce({
          success: true,
          affected_rows: 1,
        });
    });

    it('should confirm booking successfully', async () => {
      const result = await bookingEngineNode.execute.call(mockExecuteFunctions);
      const [defaultOutput, successOutput, conflictOutput, errorOutput] = result;

      expect(successOutput).toHaveLength(1);
      const confirmation = successOutput[0].json;

      expect(confirmation).toMatchObject({
        booking_confirmed: true,
        booking_id: 'booking-123',
        confirmation_time: expect.any(String),
      });
    });
  });

  describe('cancelBooking operation', () => {
    beforeEach(() => {
      mockExecuteFunctions.getNodeParameter
        .mockReturnValueOnce('cancelBooking') // operation
        .mockReturnValueOnce('12345678-1234-1234-1234-123456789012') // salonId
        .mockReturnValueOnce('booking-123') // bookingId
        .mockReturnValueOnce('Customer requested cancellation'); // cancellationReason

      (utils.executeDatabaseOperation as jest.Mock)
        .mockResolvedValueOnce({
          success: true,
          data: {
            id: 'booking-123',
            status: 'confirmed',
          },
        })
        .mockResolvedValueOnce({
          success: true,
          affected_rows: 1,
        });
    });

    it('should cancel booking successfully', async () => {
      const result = await bookingEngineNode.execute.call(mockExecuteFunctions);
      const [defaultOutput, successOutput, conflictOutput, errorOutput] = result;

      expect(successOutput).toHaveLength(1);
      const cancellation = successOutput[0].json;

      expect(cancellation).toMatchObject({
        booking_cancelled: true,
        booking_id: 'booking-123',
        cancellation_reason: 'Customer requested cancellation',
      });
    });
  });

  describe('error handling', () => {
    it('should handle salon not found', async () => {
      (utils.getSalonData as jest.Mock).mockResolvedValue(null);

      mockExecuteFunctions.getNodeParameter
        .mockReturnValueOnce('createBooking') // operation
        .mockReturnValueOnce('invalid-salon-id'); // salonId

      const result = await bookingEngineNode.execute.call(mockExecuteFunctions);
      const [defaultOutput, successOutput, conflictOutput, errorOutput] = result;

      expect(errorOutput).toHaveLength(1);
      expect(errorOutput[0].json).toMatchObject({
        error: true,
        error_code: 'BOOKING_ENGINE_ERROR',
        error_message: expect.stringContaining('Salon not found'),
      });
    });

    it('should track performance metrics', async () => {
      mockExecuteFunctions.getNodeParameter
        .mockReturnValueOnce('getBookingDetails') // operation
        .mockReturnValueOnce('12345678-1234-1234-1234-123456789012') // salonId
        .mockReturnValueOnce('booking-123'); // bookingId

      (utils.executeDatabaseOperation as jest.Mock).mockResolvedValue({
        success: true,
        data: { id: 'booking-123', status: 'confirmed' },
      });

      await bookingEngineNode.execute.call(mockExecuteFunctions);

      expect(utils.startPerformanceTimer).toHaveBeenCalledWith('BookingEngine');
      expect(utils.endPerformanceTimer).toHaveBeenCalledWith('timer-123', expect.objectContaining({
        node_name: 'BookingEngine',
        salon_id: '12345678-1234-1234-1234-123456789012',
      }));
    });
  });
});