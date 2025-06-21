import { IExecuteFunctions } from 'n8n-workflow';
import { VoiceSynthesis } from './VoiceSynthesis.node';
import { SalonData } from '../../types';
import * as utils from '../../utils';
import { TEST_CONSTANTS } from '../../__tests__/constants';

// Mock the utils module
jest.mock('../../utils', () => ({
  getSalonData: jest.fn(),
  logInfo: jest.fn(),
  logError: jest.fn(),
  logWarn: jest.fn(),
  startPerformanceTimer: jest.fn().mockReturnValue('timer-123'),
  endPerformanceTimer: jest.fn(),
  validateNodeExecutionContext: jest.fn().mockReturnValue({ valid: true, errors: [], warnings: [] }),
  initializeDatabase: jest.fn(),
  isDatabaseInitialized: jest.fn().mockReturnValue(true),
}));

describe('VoiceSynthesis Node', () => {
  let voiceSynthesisNode: VoiceSynthesis;
  let mockExecuteFunctions: jest.Mocked<IExecuteFunctions>;
  let mockSalonData: SalonData;

  beforeEach(() => {
    voiceSynthesisNode = new VoiceSynthesis();
    
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
          elevenlabs_enabled: true,
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
        id: 'voice-synthesis-node',
        name: 'Voice Synthesis',
        type: 'voiceSynthesis',
      }),
      helpers: {
        httpRequest: jest.fn(),
      },
    } as unknown as jest.Mocked<IExecuteFunctions>;

    (utils.getSalonData as jest.Mock).mockResolvedValue(mockSalonData);
    
    // Ensure validation mocks are properly set for each test
    (utils.validateNodeExecutionContext as jest.Mock).mockReturnValue({ valid: true, errors: [], warnings: [] });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('synthesizeVoice operation', () => {
    beforeEach(() => {
      mockExecuteFunctions.getNodeParameter
        .mockReturnValueOnce('synthesizeVoice') // operation
        .mockReturnValueOnce('12345678-1234-1234-1234-123456789012') // salonId
        .mockReturnValueOnce('http://localhost:3000') // serviceUrl
        .mockReturnValueOnce('Hallo, Ihr Termin ist bestätigt!') // text
        .mockReturnValueOnce('de') // language
        .mockReturnValueOnce('') // testScenario
        .mockReturnValueOnce('fire_and_forget'); // callbackMode
    });

    it('should initiate voice synthesis successfully', async () => {
      // Mock successful HTTP response
      (mockExecuteFunctions.helpers.httpRequest as jest.Mock).mockResolvedValue({
        status: 'processing',
        message: 'Voice synthesis request accepted',
        idempotencyKey: 'exec-123',
        estimatedCompletionSeconds: 2
      });

      const result = await voiceSynthesisNode.execute.call(mockExecuteFunctions);

      expect(result).toHaveLength(3); // [default, success, failure]
      const [defaultOutput] = result;
      
      expect(defaultOutput).toHaveLength(1);
      const response = defaultOutput[0].json;

      expect(response).toMatchObject({
        synthesis_initiated: true,
        status: 'accepted',
        message: 'Voice synthesis request accepted',
        callback_mode: 'fire_and_forget',
        idempotency_key: 'exec-123',
      });

      expect(mockExecuteFunctions.helpers.httpRequest).toHaveBeenCalledWith({
        method: 'POST',
        url: 'http://localhost:3000/synthesize',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'test-key-123',
        },
        body: {
          text: 'Hallo, Ihr Termin ist bestätigt!',
          language: 'de',
          salonId: '12345678-1234-1234-1234-123456789012',
          idempotencyKey: 'exec-123',
        },
        timeout: 10000,
      });
    });

    it('should handle test scenario mode', async () => {
      mockExecuteFunctions.getNodeParameter
        .mockReset()
        .mockReturnValueOnce('synthesizeVoice') // operation
        .mockReturnValueOnce('12345678-1234-1234-1234-123456789012') // salonId
        .mockReturnValueOnce('http://localhost:3000') // serviceUrl
        .mockReturnValueOnce('Test message') // text
        .mockReturnValueOnce('de') // language
        .mockReturnValueOnce('success') // testScenario
        .mockReturnValueOnce('fire_and_forget'); // callbackMode

      (mockExecuteFunctions.helpers.httpRequest as jest.Mock).mockResolvedValue({
        status: 'processing_test',
        message: 'Test mode: success'
      });

      const result = await voiceSynthesisNode.execute.call(mockExecuteFunctions);
      const response = result[0][0].json;

      expect(mockExecuteFunctions.helpers.httpRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            testScenario: 'success'
          })
        })
      );
    });

    it('should handle wait callback mode', async () => {
      mockExecuteFunctions.getNodeParameter
        .mockReset()
        .mockReturnValueOnce('synthesizeVoice') // operation
        .mockReturnValueOnce('12345678-1234-1234-1234-123456789012') // salonId
        .mockReturnValueOnce('http://localhost:3000') // serviceUrl
        .mockReturnValueOnce('Test message') // text
        .mockReturnValueOnce('de') // language
        .mockReturnValueOnce('') // testScenario
        .mockReturnValueOnce('wait'); // callbackMode

      const result = await voiceSynthesisNode.execute.call(mockExecuteFunctions);
      const response = result[0][0].json;

      expect(response).toMatchObject({
        synthesis_initiated: true,
        status: 'processing',
        message: 'Voice synthesis started - waiting for callback',
        callback_mode: 'wait',
        estimated_completion_seconds: 2,
      });

      // Should not call HTTP request in wait mode (callback URL not yet implemented)
      expect(mockExecuteFunctions.helpers.httpRequest).not.toHaveBeenCalled();
    });

    it('should validate empty text input', async () => {
      mockExecuteFunctions.getNodeParameter
        .mockReset()
        .mockReturnValueOnce('synthesizeVoice') // operation
        .mockReturnValueOnce('12345678-1234-1234-1234-123456789012') // salonId
        .mockReturnValueOnce('http://localhost:3000') // serviceUrl
        .mockReturnValueOnce('') // text (empty)
        .mockReturnValueOnce('de') // language
        .mockReturnValueOnce('') // testScenario
        .mockReturnValueOnce('fire_and_forget'); // callbackMode

      // Mock getMode to return 'trigger' so errors are caught instead of thrown
      mockExecuteFunctions.getMode.mockReturnValue('trigger');

      const result = await voiceSynthesisNode.execute.call(mockExecuteFunctions);
      const response = result[0][0].json;

      expect(response).toMatchObject({
        error: true,
        error_code: 'VOICE_SYNTHESIS_ERROR',
        error_message: expect.stringContaining('Text to synthesize cannot be empty'),
      });
    });

    it('should handle salon not found', async () => {
      (utils.getSalonData as jest.Mock).mockResolvedValue(null);

      mockExecuteFunctions.getNodeParameter
        .mockReset()
        .mockReturnValueOnce('synthesizeVoice') // operation
        .mockReturnValueOnce('nonexistent-salon-id') // salonId
        .mockReturnValueOnce('http://localhost:3000') // serviceUrl
        .mockReturnValueOnce('Test message') // text
        .mockReturnValueOnce('de') // language
        .mockReturnValueOnce('') // testScenario
        .mockReturnValueOnce('fire_and_forget'); // callbackMode

      // Mock getMode to return 'trigger' so errors are caught instead of thrown
      mockExecuteFunctions.getMode.mockReturnValue('trigger');

      const result = await voiceSynthesisNode.execute.call(mockExecuteFunctions);
      const response = result[0][0].json;

      expect(response).toMatchObject({
        error: true,
        error_code: 'VOICE_SYNTHESIS_ERROR',
        error_message: expect.stringContaining('Salon not found'),
      });
    });

    it('should handle service connection failure', async () => {
      mockExecuteFunctions.getNodeParameter
        .mockReset()
        .mockReturnValueOnce('synthesizeVoice') // operation
        .mockReturnValueOnce('12345678-1234-1234-1234-123456789012') // salonId
        .mockReturnValueOnce('http://localhost:3000') // serviceUrl
        .mockReturnValueOnce('Test message') // text
        .mockReturnValueOnce('de') // language
        .mockReturnValueOnce('') // testScenario
        .mockReturnValueOnce('fire_and_forget'); // callbackMode

      // Mock getMode to return 'trigger' so errors are caught instead of thrown
      mockExecuteFunctions.getMode.mockReturnValue('trigger');

      (mockExecuteFunctions.helpers.httpRequest as jest.Mock).mockRejectedValue(
        new Error('Connection refused')
      );

      const result = await voiceSynthesisNode.execute.call(mockExecuteFunctions);
      const response = result[0][0].json;

      expect(response).toMatchObject({
        error: true,
        error_code: 'VOICE_SYNTHESIS_ERROR',
        error_message: expect.stringContaining('Failed to call VoiceSynthesisService'),
      });
    });
  });

  describe('checkServiceStatus operation', () => {
    beforeEach(() => {
      mockExecuteFunctions.getNodeParameter
        .mockReturnValueOnce('checkServiceStatus') // operation
        .mockReturnValueOnce('') // salonId (not needed for status check)
        .mockReturnValueOnce('http://localhost:3000'); // serviceUrl
    });

    it('should check service status successfully', async () => {
      (mockExecuteFunctions.helpers.httpRequest as jest.Mock).mockResolvedValue({
        status: 'healthy',
        timestamp: '2024-01-01T00:00:00Z',
        service: 'voice-synthesis-service',
        version: '1.0.0'
      });

      const result = await voiceSynthesisNode.execute.call(mockExecuteFunctions);
      const response = result[0][0].json;

      expect(response).toMatchObject({
        service_available: true,
        service_status: 'healthy',
        checked_at: expect.any(String),
      });

      expect(mockExecuteFunctions.helpers.httpRequest).toHaveBeenCalledWith({
        method: 'GET',
        url: 'http://localhost:3000/health',
        timeout: 5000,
      });
    });

    it('should handle service unavailable', async () => {
      (mockExecuteFunctions.helpers.httpRequest as jest.Mock).mockRejectedValue(
        new Error('Service unavailable')
      );

      const result = await voiceSynthesisNode.execute.call(mockExecuteFunctions);
      const response = result[0][0].json;

      expect(response).toMatchObject({
        service_available: false,
        service_status: 'unavailable',
        error_message: 'Service unavailable',
        checked_at: expect.any(String),
      });
    });
  });

  describe('performance monitoring', () => {
    it('should track performance metrics', async () => {
      mockExecuteFunctions.getNodeParameter
        .mockReturnValueOnce('checkServiceStatus') // operation
        .mockReturnValueOnce('') // salonId
        .mockReturnValueOnce('http://localhost:3000'); // serviceUrl

      (mockExecuteFunctions.helpers.httpRequest as jest.Mock).mockResolvedValue({
        status: 'healthy'
      });

      await voiceSynthesisNode.execute.call(mockExecuteFunctions);

      expect(utils.startPerformanceTimer).toHaveBeenCalledWith('VoiceSynthesis');
      expect(utils.endPerformanceTimer).toHaveBeenCalledWith('timer-123', expect.objectContaining({
        node_name: 'VoiceSynthesis',
      }));
    });
  });
});