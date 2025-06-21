import { IExecuteFunctions } from 'n8n-workflow';
import { VoiceAgent } from './VoiceAgent.node';
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
  executeDatabaseOperation: jest.fn(),
}));

describe('VoiceAgent Node', () => {
  let voiceAgentNode: VoiceAgent;
  let mockExecuteFunctions: jest.Mocked<IExecuteFunctions>;
  let mockSalonData: SalonData;

  beforeEach(() => {
    voiceAgentNode = new VoiceAgent();
    
    mockSalonData = {
      id: '12345678-1234-1234-1234-123456789012',
      business_name: 'Premium Salon',
      owner_name: 'Maria Garcia',
      email: 'maria@premiumsalon.com',
      phone: '+31612345678',
      whatsapp_number: '+31612345678',
      instagram_handle: 'premiumsalon',
      address: {
        street: '123 Canal Street',
        city: 'Amsterdam',
        state: 'North Holland',
        postal_code: '1012AB',
        country: 'NL',
      },
      timezone: 'Europe/Amsterdam',
      subscription_tier: 'enterprise', // Enterprise tier for voice agent
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
          preferred_language: 'nl',
          fallback_language: 'en',
          confidence_threshold: 0.8,
          cost_budget_monthly_euros: 100,
        },
        notification_preferences: {
          email_notifications: true,
          sms_notifications: false,
          notification_types: ['booking_created', 'booking_cancelled'],
        },
        voice_agent_settings: {
          enabled: true,
          after_hours_enabled: true,
          max_call_duration_minutes: 10,
          personality: 'friendly',
          voice_language: 'nl',
          fallback_to_human: true,
          cost_budget_daily_euros: 50,
          allowed_call_types: ['inbound', 'reactivation', 'followup'],
        },
      },
      twilio_phone_number: '+31712345678',
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
        id: 'voice-agent-node',
        name: 'Voice Agent',
        type: 'voiceAgent',
      }),
      helpers: {
        httpRequest: jest.fn(),
      },
    } as unknown as jest.Mocked<IExecuteFunctions>;

    (utils.getSalonData as jest.Mock).mockResolvedValue(mockSalonData);
    (utils.executeDatabaseOperation as jest.Mock).mockResolvedValue({ 
      success: true, 
      data: [{ id: 'test-id', total_cost_euros: '5.50' }] 
    });
    
    // Ensure validation mocks are properly set for each test
    (utils.validateNodeExecutionContext as jest.Mock).mockReturnValue({ valid: true, errors: [], warnings: [] });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initiateCall operation', () => {
    beforeEach(() => {
      mockExecuteFunctions.getNodeParameter
        .mockReturnValueOnce('initiateCall') // operation
        .mockReturnValueOnce('12345678-1234-1234-1234-123456789012') // salonId
        .mockReturnValueOnce('http://localhost:3001') // voiceGatewayUrl
        .mockReturnValueOnce('+31612345678') // phoneNumber
        .mockReturnValueOnce('reactivation') // campaignType
        .mockReturnValueOnce('{"last_visit": "2024-01-15", "name": "Sarah"}') // customerContext
        .mockReturnValueOnce(''); // scheduledTime
    });

    it('should initiate outbound call successfully', async () => {
      // Mock successful Voice Gateway response
      (mockExecuteFunctions.helpers.httpRequest as jest.Mock).mockResolvedValue({
        success: true,
        call_sid: 'CA123456789',
        status: 'initiated',
        direction: 'outbound'
      });

      const result = await voiceAgentNode.execute.call(mockExecuteFunctions);

      expect(result).toHaveLength(3); // [default, success, failure]
      const [defaultOutput] = result;
      
      expect(defaultOutput).toHaveLength(1);
      const response = defaultOutput[0].json;

      expect(response).toMatchObject({
        call_initiated: true,
        call_sid: 'CA123456789',
        phone_number: '+31612345678',
        campaign_type: 'reactivation',
        scheduled: false,
        estimated_cost_euros: 0.5,
      });

      expect(mockExecuteFunctions.helpers.httpRequest).toHaveBeenCalledWith({
        method: 'POST',
        url: 'http://localhost:3001/calls/initiate',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'test-key-123',
        },
        body: {
          salon_id: '12345678-1234-1234-1234-123456789012',
          phone_number: '+31612345678',
          campaign_type: 'reactivation',
          customer_context: { last_visit: '2024-01-15', name: 'Sarah' },
          scheduled_time: null,
        },
        timeout: 10000,
      });
    });

    it('should handle scheduled calls', async () => {
      const scheduledTime = '2024-12-25T10:00:00Z';
      
      mockExecuteFunctions.getNodeParameter
        .mockReset()
        .mockReturnValueOnce('initiateCall') // operation
        .mockReturnValueOnce('12345678-1234-1234-1234-123456789012') // salonId
        .mockReturnValueOnce('http://localhost:3001') // voiceGatewayUrl
        .mockReturnValueOnce('+31612345678') // phoneNumber
        .mockReturnValueOnce('followup') // campaignType
        .mockReturnValueOnce('{"appointment_id": "apt_123"}') // customerContext
        .mockReturnValueOnce(scheduledTime); // scheduledTime

      (mockExecuteFunctions.helpers.httpRequest as jest.Mock).mockResolvedValue({
        success: true,
        call_scheduled: true,
        queue_id: 'queue_123',
        scheduled_for: scheduledTime
      });

      const result = await voiceAgentNode.execute.call(mockExecuteFunctions);
      const response = result[0][0].json;

      expect(response).toMatchObject({
        call_initiated: true,
        scheduled: true,
        campaign_type: 'followup',
      });

      expect(mockExecuteFunctions.helpers.httpRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            scheduled_time: scheduledTime,
          })
        })
      );
    });

    it('should validate phone number format', async () => {
      mockExecuteFunctions.getNodeParameter
        .mockReset()
        .mockReturnValueOnce('initiateCall') // operation
        .mockReturnValueOnce('12345678-1234-1234-1234-123456789012') // salonId
        .mockReturnValueOnce('http://localhost:3001') // voiceGatewayUrl
        .mockReturnValueOnce('invalid-phone') // phoneNumber (invalid format)
        .mockReturnValueOnce('reactivation') // campaignType
        .mockReturnValueOnce('{}') // customerContext
        .mockReturnValueOnce(''); // scheduledTime

      mockExecuteFunctions.getMode.mockReturnValue('trigger');

      const result = await voiceAgentNode.execute.call(mockExecuteFunctions);
      const response = result[0][0].json;

      expect(response).toMatchObject({
        error: true,
        error_code: 'VOICE_AGENT_ERROR',
        error_message: expect.stringContaining('Invalid phone number format'),
      });
    });

    it('should check daily budget limits', async () => {
      // Mock high daily cost to trigger budget limit
      (utils.executeDatabaseOperation as jest.Mock).mockResolvedValue({ 
        success: true, 
        data: [{ total_cost_euros: '55.00' }] // Over the €50 daily budget
      });

      mockExecuteFunctions.getMode.mockReturnValue('trigger');

      const result = await voiceAgentNode.execute.call(mockExecuteFunctions);
      const response = result[0][0].json;

      expect(response).toMatchObject({
        error: true,
        error_code: 'VOICE_AGENT_ERROR',
        error_message: expect.stringContaining('Daily voice budget'),
      });
    });

    it('should handle invalid JSON in customer context', async () => {
      mockExecuteFunctions.getNodeParameter
        .mockReset()
        .mockReturnValueOnce('initiateCall') // operation
        .mockReturnValueOnce('12345678-1234-1234-1234-123456789012') // salonId
        .mockReturnValueOnce('http://localhost:3001') // voiceGatewayUrl
        .mockReturnValueOnce('+31612345678') // phoneNumber
        .mockReturnValueOnce('reactivation') // campaignType
        .mockReturnValueOnce('invalid-json') // customerContext (invalid JSON)
        .mockReturnValueOnce(''); // scheduledTime

      mockExecuteFunctions.getMode.mockReturnValue('trigger');

      const result = await voiceAgentNode.execute.call(mockExecuteFunctions);
      const response = result[0][0].json;

      expect(response).toMatchObject({
        error: true,
        error_code: 'VOICE_AGENT_ERROR',
        error_message: expect.stringContaining('Invalid customer context JSON'),
      });
    });
  });

  describe('processMissedCall operation', () => {
    beforeEach(() => {
      mockExecuteFunctions.getNodeParameter
        .mockReturnValueOnce('processMissedCall') // operation
        .mockReturnValueOnce('12345678-1234-1234-1234-123456789012') // salonId
        .mockReturnValueOnce('http://localhost:3001') // voiceGatewayUrl
        .mockReturnValueOnce('+31612345678') // missedCallPhone
        .mockReturnValueOnce(true) // enableSpamProtection
        .mockReturnValueOnce(5); // callbackDelayMinutes
    });

    it('should process missed call with spam protection', async () => {
      // Mock Twilio Lookup response for safe number
      (mockExecuteFunctions.helpers.httpRequest as jest.Mock).mockResolvedValue({
        line_type_intelligence: {
          type: 'mobile',
          carrier_name: 'KPN',
          error_code: null
        }
      });

      const result = await voiceAgentNode.execute.call(mockExecuteFunctions);
      const response = result[0][0].json;

      expect(response).toMatchObject({
        callback_queued: true,
        phone_number: '+31612345678',
        delay_minutes: 5,
        spam_protection_enabled: true,
        safety_status: 'verified_safe',
      });

      // Should call Twilio Lookup API
      expect(mockExecuteFunctions.helpers.httpRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'GET',
          url: expect.stringContaining('lookups.twilio.com'),
        })
      );

      // Should insert into callback queue
      expect(utils.executeDatabaseOperation).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO callback_queue'),
        expect.arrayContaining([
          '12345678-1234-1234-1234-123456789012',
          '+31612345678',
          'missed_call_callback',
        ])
      );
    });

    it('should block risky VoIP numbers', async () => {
      // Mock Twilio Lookup response for VoIP number
      (mockExecuteFunctions.helpers.httpRequest as jest.Mock).mockResolvedValue({
        line_type_intelligence: {
          type: 'voip',
          carrier_name: 'Skype',
          error_code: null
        }
      });

      const result = await voiceAgentNode.execute.call(mockExecuteFunctions);
      const response = result[0][0].json;

      expect(response).toMatchObject({
        callback_queued: false,
        reason: 'Phone number failed spam protection checks',
        safety_status: 'blocked',
      });
    });

    it('should handle spam protection disabled', async () => {
      mockExecuteFunctions.getNodeParameter
        .mockReset()
        .mockReturnValueOnce('processMissedCall') // operation
        .mockReturnValueOnce('12345678-1234-1234-1234-123456789012') // salonId
        .mockReturnValueOnce('http://localhost:3001') // voiceGatewayUrl
        .mockReturnValueOnce('+31612345678') // missedCallPhone
        .mockReturnValueOnce(false) // enableSpamProtection (disabled)
        .mockReturnValueOnce(2); // callbackDelayMinutes

      const result = await voiceAgentNode.execute.call(mockExecuteFunctions);
      const response = result[0][0].json;

      expect(response).toMatchObject({
        callback_queued: true,
        spam_protection_enabled: false,
        safety_status: 'verified_safe',
      });

      // Should NOT call Twilio Lookup API
      expect(mockExecuteFunctions.helpers.httpRequest).not.toHaveBeenCalled();
    });
  });

  describe('manageCampaign operation', () => {
    beforeEach(() => {
      mockExecuteFunctions.getNodeParameter
        .mockReturnValueOnce('manageCampaign') // operation
        .mockReturnValueOnce('12345678-1234-1234-1234-123456789012') // salonId
        .mockReturnValueOnce('http://localhost:3001'); // voiceGatewayUrl
    });

    it('should create new campaign', async () => {
      mockExecuteFunctions.getNodeParameter
        .mockReturnValueOnce('create') // campaignAction
        .mockReturnValueOnce('') // campaignId (not needed for create)
        .mockReturnValueOnce('{"name": "Holiday Reactivation", "campaign_type": "reactivation", "target_criteria": {"last_visit_days_ago": 60}}'); // campaignConfig

      // Mock database operation to return campaign creation data
      (utils.executeDatabaseOperation as jest.Mock).mockResolvedValueOnce({
        success: true,
        data: [{
          id: 'campaign-123',
          name: 'Holiday Reactivation',
          campaign_type: 'reactivation',
          status: 'draft'
        }]
      });

      const result = await voiceAgentNode.execute.call(mockExecuteFunctions);
      const response = result[0][0].json;

      expect(response).toMatchObject({
        campaign_created: true,
        campaign_name: 'Holiday Reactivation',
        campaign_type: 'reactivation',
        status: 'draft',
      });

      expect(utils.executeDatabaseOperation).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO voice_agent_campaigns'),
        expect.arrayContaining([
          '12345678-1234-1234-1234-123456789012',
          'Holiday Reactivation',
          'reactivation',
          'draft',
        ])
      );
    });

    it('should start existing campaign', async () => {
      mockExecuteFunctions.getNodeParameter
        .mockReturnValueOnce('start') // campaignAction
        .mockReturnValueOnce('campaign-uuid-123') // campaignId
        .mockReturnValueOnce('{}'); // campaignConfig (not needed for start)

      (utils.executeDatabaseOperation as jest.Mock).mockResolvedValue({
        success: true,
        data: [{ name: 'Test Campaign', status: 'active' }]
      });

      const result = await voiceAgentNode.execute.call(mockExecuteFunctions);
      const response = result[0][0].json;

      expect(response).toMatchObject({
        campaign_updated: true,
        campaign_id: 'campaign-uuid-123',
        action: 'start',
        new_status: 'active',
      });

      expect(utils.executeDatabaseOperation).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE voice_agent_campaigns SET status'),
        ['active', 'campaign-uuid-123', '12345678-1234-1234-1234-123456789012']
      );
    });

    it('should get campaign status', async () => {
      mockExecuteFunctions.getNodeParameter
        .mockReturnValueOnce('status') // campaignAction
        .mockReturnValueOnce('campaign-uuid-123') // campaignId
        .mockReturnValueOnce('{}'); // campaignConfig

      (utils.executeDatabaseOperation as jest.Mock).mockResolvedValue({
        success: true,
        data: [{
          name: 'Holiday Campaign',
          campaign_type: 'reactivation',
          status: 'active',
          total_targets: 100,
          calls_initiated: 75,
          calls_completed: 45,
          successful_outcomes: 12,
          total_cost_euros: '25.50',
          created_at: '2024-01-01T00:00:00Z',
          start_date: '2024-01-15T09:00:00Z',
          end_date: '2024-01-31T17:00:00Z'
        }]
      });

      const result = await voiceAgentNode.execute.call(mockExecuteFunctions);
      const response = result[0][0].json;

      expect(response).toMatchObject({
        campaign_id: 'campaign-uuid-123',
        campaign_status: 'active',
        campaign_name: 'Holiday Campaign',
        performance: {
          total_targets: 100,
          calls_initiated: 75,
          calls_completed: 45,
          successful_outcomes: 12,
          success_rate: '26.7', // 12/45 * 100
          total_cost_euros: 25.50,
        },
      });
    });
  });

  describe('checkStatus operation', () => {
    beforeEach(() => {
      mockExecuteFunctions.getNodeParameter
        .mockReturnValueOnce('checkStatus') // operation
        .mockReturnValueOnce('12345678-1234-1234-1234-123456789012') // salonId
        .mockReturnValueOnce('http://localhost:3001'); // voiceGatewayUrl
    });

    it('should check Voice Gateway status successfully', async () => {
      (mockExecuteFunctions.helpers.httpRequest as jest.Mock).mockResolvedValue({
        status: 'healthy',
        service: 'voice-gateway-service',
        version: '1.0.0',
        active_calls: 3,
        uptime: 86400
      });

      const result = await voiceAgentNode.execute.call(mockExecuteFunctions);
      const response = result[0][0].json;

      expect(response).toMatchObject({
        voice_gateway_available: true,
        service_status: 'healthy',
        active_calls: 3,
        uptime_seconds: 86400,
      });

      expect(mockExecuteFunctions.helpers.httpRequest).toHaveBeenCalledWith({
        method: 'GET',
        url: 'http://localhost:3001/health',
        timeout: 5000,
      });
    });

    it('should handle Voice Gateway unavailable', async () => {
      (mockExecuteFunctions.helpers.httpRequest as jest.Mock).mockRejectedValue(
        new Error('Connection refused')
      );

      const result = await voiceAgentNode.execute.call(mockExecuteFunctions);
      const response = result[0][0].json;

      expect(response).toMatchObject({
        voice_gateway_available: false,
        service_status: 'unavailable',
        error_message: 'Connection refused',
      });
    });
  });

  describe('getAnalytics operation', () => {
    beforeEach(() => {
      mockExecuteFunctions.getNodeParameter
        .mockReturnValueOnce('getAnalytics') // operation
        .mockReturnValueOnce('12345678-1234-1234-1234-123456789012') // salonId
        .mockReturnValueOnce('http://localhost:3001') // voiceGatewayUrl
        .mockReturnValueOnce('week'); // analyticsPeriod
    });

    it('should retrieve voice analytics successfully', async () => {
      (utils.executeDatabaseOperation as jest.Mock).mockResolvedValue({
        success: true,
        data: [{
          total_calls: '50',
          inbound_calls: '30',
          outbound_calls: '20',
          completed_calls: '35',
          missed_calls: '15',
          avg_duration_seconds: 180,
          total_talk_time_seconds: 6300,
          total_cost_usd: '12.50',
          bookings_created: '8',
          reactivation_calls: '12'
        }]
      });

      const result = await voiceAgentNode.execute.call(mockExecuteFunctions);
      const response = result[0][0].json;

      expect(response).toMatchObject({
        analytics_period: 'Last 7 Days',
        period_type: 'week',
        salon_name: 'Premium Salon',
        call_volume: {
          total_calls: 50,
          inbound_calls: 30,
          outbound_calls: 20,
          completed_calls: 35,
          missed_calls: 15,
        },
        performance_metrics: {
          completion_rate_percent: 70.0, // 35/50 * 100
          avg_call_duration_minutes: '3.0', // 180/60
          total_talk_time_hours: '1.8', // 6300/3600
        },
        business_outcomes: {
          bookings_created: 8,
          booking_conversion_rate_percent: 22.9, // 8/35 * 100
          reactivation_calls: 12,
        },
        cost_analysis: {
          total_cost_usd: 12.50,
          total_cost_euros: '11.50', // 12.50 * 0.92
          cost_per_call_euros: '0.23', // 11.50/50
          cost_per_booking_euros: '1.44', // 11.50/8
        },
      });

      expect(utils.executeDatabaseOperation).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        ['12345678-1234-1234-1234-123456789012']
      );
    });
  });

  describe('Enterprise tier validation', () => {
    it('should reject salon without voice agent enabled', async () => {
      const basicSalonData = {
        ...mockSalonData,
        settings: {
          ...mockSalonData.settings,
          voice_agent_settings: {
            enabled: false, // Voice agent disabled
          }
        }
      };

      (utils.getSalonData as jest.Mock).mockResolvedValue(basicSalonData);

      mockExecuteFunctions.getNodeParameter
        .mockReturnValueOnce('initiateCall')
        .mockReturnValueOnce('12345678-1234-1234-1234-123456789012')
        .mockReturnValueOnce('http://localhost:3001');

      mockExecuteFunctions.getMode.mockReturnValue('trigger');

      const result = await voiceAgentNode.execute.call(mockExecuteFunctions);
      const response = result[0][0].json;

      expect(response).toMatchObject({
        error: true,
        error_code: 'VOICE_AGENT_ERROR',
        error_message: expect.stringContaining('Voice Agent is not enabled'),
      });
    });

    it('should reject salon not found', async () => {
      (utils.getSalonData as jest.Mock).mockResolvedValue(null);

      mockExecuteFunctions.getNodeParameter
        .mockReturnValueOnce('initiateCall')
        .mockReturnValueOnce('nonexistent-salon-id')
        .mockReturnValueOnce('http://localhost:3001');

      mockExecuteFunctions.getMode.mockReturnValue('trigger');

      const result = await voiceAgentNode.execute.call(mockExecuteFunctions);
      const response = result[0][0].json;

      expect(response).toMatchObject({
        error: true,
        error_code: 'VOICE_AGENT_ERROR',
        error_message: expect.stringContaining('Salon not found'),
      });
    });
  });

  describe('performance monitoring', () => {
    it('should track performance metrics', async () => {
      mockExecuteFunctions.getNodeParameter
        .mockReturnValueOnce('checkStatus')
        .mockReturnValueOnce('12345678-1234-1234-1234-123456789012')
        .mockReturnValueOnce('http://localhost:3001');

      (mockExecuteFunctions.helpers.httpRequest as jest.Mock).mockResolvedValue({
        status: 'healthy'
      });

      await voiceAgentNode.execute.call(mockExecuteFunctions);

      expect(utils.startPerformanceTimer).toHaveBeenCalledWith('VoiceAgent');
      expect(utils.endPerformanceTimer).toHaveBeenCalledWith('timer-123', expect.objectContaining({
        node_name: 'VoiceAgent',
      }));
    });
  });
});