import { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { ServiceWindow } from './ServiceWindow.node';
import { SalonData, ConversationContext } from '../../types';
import * as utils from '../../utils';
import { TEST_CONSTANTS } from '../../__tests__/constants';
import { 
  createMockExecuteFunctions, 
  createMockSalonData, 
  createMockConversationContext,
  validateMultipleOutputs,
  MOCK_DB_RESPONSES 
} from '../../__tests__/test-helpers';

// Mock the utils module
jest.mock('../../utils', () => ({
  getSalonData: jest.fn(),
  executeDatabaseOperation: jest.fn(),
  logInfo: jest.fn(),
  logError: jest.fn(),
  logWarn: jest.fn(),
  startPerformanceTimer: jest.fn().mockReturnValue('timer-123'),
  endPerformanceTimer: jest.fn(),
  logServiceWindowOptimization: jest.fn(),
  validateNodeExecutionContext: jest.fn().mockReturnValue({ valid: true, errors: [], warnings: [] }),
  validateConversationContext: jest.fn().mockReturnValue({ valid: true, errors: [], warnings: [] }),
  initializeDatabase: jest.fn(),
  isDatabaseInitialized: jest.fn().mockReturnValue(true),
}));

describe('ServiceWindow Node', () => {
  let serviceWindowNode: ServiceWindow;
  let mockExecuteFunctions: jest.Mocked<IExecuteFunctions>;
  let mockSalonData: SalonData;
  let mockConversationContext: ConversationContext;

  beforeEach(() => {
    serviceWindowNode = new ServiceWindow();
    
    // Mock salon data with service window settings
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

    // Mock conversation context
    mockConversationContext = {
      id: '98765432-1234-1234-1234-123456789012',
      salon_id: '12345678-1234-1234-1234-123456789012',
      customer_id: '11111111-1111-1111-1111-111111111111',
      channel: 'whatsapp',
      external_id: 'whatsapp_123456',
      status: 'active',
      last_message_at: new Date(Date.now() - (25 * 60 * 60 * 1000)).toISOString(), // 25 hours ago
      message_count: 3,
      customer_sentiment: 'neutral',
      intent_detected: 'general_inquiry',
      booking_probability: 0.3,
    };

    // Mock execute functions
    mockExecuteFunctions = {
      getInputData: jest.fn().mockReturnValue([{ json: {} }]),
      getNodeParameter: jest.fn(),
      getExecutionId: jest.fn().mockReturnValue('exec-123'),
      getMode: jest.fn().mockReturnValue('manual'),
      getNode: jest.fn().mockReturnValue({ 
        id: 'service-window-node',
        name: 'Service Window',
        type: 'serviceWindow',
      }),
    } as unknown as jest.Mocked<IExecuteFunctions>;

    // Setup getSalonData mock
    (utils.getSalonData as jest.Mock).mockResolvedValue(mockSalonData);
    (utils.executeDatabaseOperation as jest.Mock).mockResolvedValue({
      success: true,
      data: [],
      execution_time_ms: 50,
    });
    
    // Ensure validation mocks are properly set for each test
    (utils.validateNodeExecutionContext as jest.Mock).mockReturnValue({ valid: true, errors: [], warnings: [] });
    (utils.validateConversationContext as jest.Mock).mockReturnValue({ valid: true, errors: [], warnings: [] });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('optimizeResponseTiming operation', () => {
    // Note: Each test now manages its own mock setup for better isolation

    it('should recommend optimization when conditions are favorable', async () => {
      // Setup favorable optimization conditions  
      mockExecuteFunctions.getNodeParameter
        .mockReturnValueOnce('optimizeResponseTiming') // operation
        .mockReturnValueOnce(TEST_CONSTANTS.SALON_IDS.VALID) // salonId
        .mockReturnValueOnce(JSON.stringify(createMockConversationContext())) // conversationContext
        .mockReturnValueOnce('Hello, do you have availability tomorrow?') // messageContent
        .mockReturnValueOnce('medium') // customerUrgency
        .mockReturnValueOnce(0.3) // bookingProbability
        .mockReturnValueOnce(false); // overrideSafetyChecks

      const result = await serviceWindowNode.execute.call(mockExecuteFunctions);

      // Should return three arrays for the three outputs
      expect(result).toHaveLength(3);
      const [defaultOutput, optimizedOutput, immediateOutput] = result;

      // Message should be routed to optimized output (index 1)
      expect(optimizedOutput).toHaveLength(1);
      expect(immediateOutput).toHaveLength(0);

      const optimizationResult = optimizedOutput[0].json;
      expect(optimizationResult).toMatchObject({
        should_optimize: true,
        delay_minutes: expect.any(Number),
        estimated_savings_euros: TEST_CONSTANTS.VALUES.TEMPLATE_COST,
        optimization_confidence: expect.any(Number),
        reasoning: expect.stringContaining('Safe to delay response by'), // Match actual implementation
        risk_factors: expect.any(Array),
        alternative_actions: expect.any(Array),
      });

      expect(optimizationResult.delay_minutes).toBeGreaterThan(0);
      expect(optimizationResult.optimization_confidence).toBeGreaterThanOrEqual(0.6); // Allow exactly 0.6
    });

    it('should not optimize urgent messages', async () => {
      // Reset the mock completely to override beforeEach
      mockExecuteFunctions.getNodeParameter.mockReset();
      
      // Setup urgent message scenario (high risk score)
      mockExecuteFunctions.getNodeParameter
        .mockReturnValueOnce('optimizeResponseTiming') // operation
        .mockReturnValueOnce(TEST_CONSTANTS.SALON_IDS.VALID) // salonId
        .mockReturnValueOnce(JSON.stringify(createMockConversationContext())) // conversationContext
        .mockReturnValueOnce('URGENT: I need to cancel my appointment NOW!') // messageContent
        .mockReturnValueOnce('urgent') // customerUrgency - THIS IS THE KEY CHANGE
        .mockReturnValueOnce(0.1) // bookingProbability
        .mockReturnValueOnce(false); // overrideSafetyChecks

      const result = await serviceWindowNode.execute.call(mockExecuteFunctions);
      const [defaultOutput, optimizedOutput, immediateOutput] = result;

      // Urgent messages should route to immediate output (index 2)
      expect(immediateOutput).toHaveLength(1);
      expect(optimizedOutput).toHaveLength(0);
      expect(defaultOutput).toHaveLength(0);

      // Verify urgent message handling matches implementation
      expect(immediateOutput[0].json).toMatchObject({
        should_optimize: false,
        reasoning: TEST_CONSTANTS.MESSAGES.SERVICE_WINDOW.URGENT_MESSAGE,
        alternative_actions: TEST_CONSTANTS.ALTERNATIVE_ACTIONS.URGENT_RESPONSE,
      });
    });

    it('should not optimize negative sentiment conversations', async () => {
      const negativeConversation = {
        ...mockConversationContext,
        customer_sentiment: 'negative' as const,
      };

      mockExecuteFunctions.getNodeParameter
        .mockReset()
        .mockReturnValueOnce('optimizeResponseTiming') // operation
        .mockReturnValueOnce('12345678-1234-1234-1234-123456789012') // salonId
        .mockReturnValueOnce(JSON.stringify(negativeConversation)) // conversationContext
        .mockReturnValueOnce('I am very unhappy with my service') // messageContent
        .mockReturnValueOnce('medium') // customerUrgency
        .mockReturnValueOnce(0.2) // bookingProbability
        .mockReturnValueOnce(false); // overrideSafetyChecks

      const result = await serviceWindowNode.execute.call(mockExecuteFunctions);
      const [defaultOutput, optimizedOutput, immediateOutput] = result;

      expect(immediateOutput).toHaveLength(1);
      const optimizationResult = immediateOutput[0].json;
      expect(optimizationResult).toMatchObject({
        should_optimize: false,
        reasoning: expect.stringContaining('negative'),
      });
    });

    it('should not optimize high booking probability conversations', async () => {
      mockExecuteFunctions.getNodeParameter
        .mockReset()
        .mockReturnValueOnce('optimizeResponseTiming') // operation
        .mockReturnValueOnce('12345678-1234-1234-1234-123456789012') // salonId
        .mockReturnValueOnce(JSON.stringify(mockConversationContext)) // conversationContext
        .mockReturnValueOnce('I would like to book an appointment for tomorrow at 2pm') // messageContent
        .mockReturnValueOnce('medium') // customerUrgency
        .mockReturnValueOnce(0.9) // bookingProbability
        .mockReturnValueOnce(false); // overrideSafetyChecks

      const result = await serviceWindowNode.execute.call(mockExecuteFunctions);
      const [defaultOutput, optimizedOutput, immediateOutput] = result;

      expect(immediateOutput).toHaveLength(1);
      const optimizationResult = immediateOutput[0].json;
      expect(optimizationResult).toMatchObject({
        should_optimize: false,
        reasoning: expect.stringContaining('High booking probability'),
      });
    });

    it('should respect override safety checks when enabled', async () => {
      mockExecuteFunctions.getNodeParameter
        .mockReset()
        .mockReturnValueOnce('optimizeResponseTiming') // operation
        .mockReturnValueOnce('12345678-1234-1234-1234-123456789012') // salonId
        .mockReturnValueOnce(JSON.stringify(mockConversationContext)) // conversationContext
        .mockReturnValueOnce('URGENT: Emergency!') // messageContent
        .mockReturnValueOnce('urgent') // customerUrgency
        .mockReturnValueOnce(0.1) // bookingProbability
        .mockReturnValueOnce(true); // overrideSafetyChecks

      const result = await serviceWindowNode.execute.call(mockExecuteFunctions);
      const [defaultOutput, optimizedOutput, immediateOutput] = result;

      // Should still analyze for optimization even with urgent flag when override is enabled
      expect(optimizedOutput.length + immediateOutput.length).toBeGreaterThan(0);
    });

    it('should not optimize when still in free messaging window', async () => {
      const recentConversation = {
        ...mockConversationContext,
        last_message_at: new Date(Date.now() - (2 * 60 * 60 * 1000)).toISOString(), // 2 hours ago
      };

      // Mock database to return recent message within 24-hour window
      const twoHoursAgo = new Date(Date.now() - (2 * 60 * 60 * 1000));
      (utils.executeDatabaseOperation as jest.Mock).mockResolvedValue({
        success: true,
        data: [{
          created_at: twoHoursAgo.toISOString(),
          direction: 'inbound'
        }],
        execution_time_ms: 50,
      });

      mockExecuteFunctions.getNodeParameter
        .mockReset()
        .mockReturnValueOnce('optimizeResponseTiming') // operation
        .mockReturnValueOnce('12345678-1234-1234-1234-123456789012') // salonId
        .mockReturnValueOnce(JSON.stringify(recentConversation)) // conversationContext
        .mockReturnValueOnce('How are you?') // messageContent
        .mockReturnValueOnce('low') // customerUrgency
        .mockReturnValueOnce(0.1) // bookingProbability
        .mockReturnValueOnce(false); // overrideSafetyChecks

      const result = await serviceWindowNode.execute.call(mockExecuteFunctions);
      const [defaultOutput, optimizedOutput, immediateOutput] = result;

      expect(immediateOutput).toHaveLength(1);
      const optimizationResult = immediateOutput[0].json;
      expect(optimizationResult).toMatchObject({
        should_optimize: false,
        reasoning: expect.stringContaining('free messaging window'),
      });
    });
  });

  describe('calculateSavingsPotential operation', () => {
    beforeEach(() => {
      mockExecuteFunctions.getNodeParameter
        .mockReturnValueOnce('calculateSavingsPotential') // operation
        .mockReturnValueOnce('12345678-1234-1234-1234-123456789012') // salonId
        .mockReturnValueOnce(30); // calculationPeriod

      // Mock historical data
      (utils.executeDatabaseOperation as jest.Mock).mockResolvedValue({
        success: true,
        data: [
          {
            event_data: {
              should_optimize: true,
              estimated_savings_euros: 0.05,
              optimization_confidence: 0.8,
            },
          },
          {
            event_data: {
              should_optimize: true,
              estimated_savings_euros: 0.05,
              optimization_confidence: 0.7,
            },
          },
          {
            event_data: {
              should_optimize: false,
              estimated_savings_euros: 0,
              optimization_confidence: 0.4,
            },
          },
        ],
        execution_time_ms: 100,
      });
    });

    it('should calculate monthly savings potential', async () => {
      const result = await serviceWindowNode.execute.call(mockExecuteFunctions);

      expect(result[0]).toHaveLength(1);
      const calculation = result[0][0].json;

      expect(calculation).toMatchObject({
        potential_savings_calculated: true,
        calculation_period_days: 30,
        current_settings: expect.objectContaining({
          enabled: true,
          template_cost_euros: 0.05,
        }),
        analysis: expect.objectContaining({
          monthly_savings_euros: expect.any(Number),
          optimizations_per_month: expect.any(Number),
          optimization_rate: expect.any(Number),
        }),
        recommendations: expect.any(Array),
      });

      expect(calculation.analysis.monthly_savings_euros).toBeGreaterThan(0);
    });

    it('should handle no historical data gracefully', async () => {
      (utils.executeDatabaseOperation as jest.Mock).mockResolvedValue({
        success: true,
        data: [],
        execution_time_ms: 50,
      });

      const result = await serviceWindowNode.execute.call(mockExecuteFunctions);
      const calculation = result[0][0].json;

      expect(calculation).toMatchObject({
        potential_savings_calculated: true,
        analysis: expect.objectContaining({
          monthly_savings_euros: 0,
          optimizations_per_month: 0,
        }),
      });
    });
  });

  describe('analyzeMessageCost operation', () => {
    beforeEach(() => {
      mockExecuteFunctions.getNodeParameter
        .mockReturnValueOnce('analyzeMessageCost') // operation
        .mockReturnValueOnce('12345678-1234-1234-1234-123456789012') // salonId
        .mockReturnValueOnce(JSON.stringify(mockConversationContext)) // conversationContext
        .mockReturnValueOnce('Hello, how can I help you?'); // messageContent
    });

    it('should analyze message cost correctly when outside free window', async () => {
      const result = await serviceWindowNode.execute.call(mockExecuteFunctions);

      expect(result[0]).toHaveLength(1);
      const analysis = result[0][0].json;

      expect(analysis).toMatchObject({
        cost_analysis_available: true,
        message_will_incur_cost: true,
        cost_details: expect.objectContaining({
          will_incur_template_cost: true,
          hours_since_last_message: expect.any(Number),
          template_cost_euros: 0.05,
          optimization_available: true,
        }),
        optimization_opportunity: true,
      });

      expect(analysis.cost_details.hours_since_last_message).toBeGreaterThan(24);
    });

    it('should analyze message cost correctly when inside free window', async () => {
      const recentConversation = {
        ...mockConversationContext,
        last_message_at: new Date(Date.now() - (2 * 60 * 60 * 1000)).toISOString(), // 2 hours ago
      };

      // Mock database to return recent message within 24-hour window (inside free window)
      const twoHoursAgo = new Date(Date.now() - (2 * 60 * 60 * 1000));
      (utils.executeDatabaseOperation as jest.Mock).mockResolvedValue({
        success: true,
        data: [{
          created_at: twoHoursAgo.toISOString(),
          direction: 'inbound'
        }],
        execution_time_ms: 50,
      });

      mockExecuteFunctions.getNodeParameter
        .mockReset()
        .mockReturnValueOnce('analyzeMessageCost') // operation
        .mockReturnValueOnce('12345678-1234-1234-1234-123456789012') // salonId
        .mockReturnValueOnce(JSON.stringify(recentConversation)) // conversationContext
        .mockReturnValueOnce('Hello, how can I help you?'); // messageContent

      const result = await serviceWindowNode.execute.call(mockExecuteFunctions);
      const analysis = result[0][0].json;

      expect(analysis).toMatchObject({
        message_will_incur_cost: false,
        cost_details: expect.objectContaining({
          will_incur_template_cost: false,
          is_in_free_window: true,
          optimization_available: false,
        }),
        optimization_opportunity: false,
      });
    });
  });

  describe('updateOptimizationSettings operation', () => {
    beforeEach(() => {
      mockExecuteFunctions.getNodeParameter
        .mockReturnValueOnce('updateOptimizationSettings') // operation
        .mockReturnValueOnce('12345678-1234-1234-1234-123456789012') // salonId
        .mockReturnValueOnce(JSON.stringify({
          max_optimization_percentage: 90,
          cost_threshold_euros: 0.08,
        })); // newSettings

      (utils.executeDatabaseOperation as jest.Mock).mockResolvedValue({
        success: true,
        affected_rows: 1,
        execution_time_ms: 75,
      });
    });

    it('should update optimization settings successfully', async () => {
      const result = await serviceWindowNode.execute.call(mockExecuteFunctions);

      expect(result[0]).toHaveLength(1);
      const update = result[0][0].json;

      expect(update).toMatchObject({
        settings_updated: true,
        old_settings: expect.objectContaining({
          max_optimization_percentage: 80,
          cost_threshold_euros: 0.10,
        }),
        new_settings: expect.objectContaining({
          max_optimization_percentage: 90,
          cost_threshold_euros: 0.08,
        }),
        estimated_impact: expect.objectContaining({
          impact_factors: expect.any(Array),
          estimated_savings_change_percent: expect.any(Number),
        }),
      });

      expect(utils.executeDatabaseOperation).toHaveBeenCalledWith({
        type: 'update',
        table: 'salons',
        salon_id: '12345678-1234-1234-1234-123456789012',
        data: expect.objectContaining({ 
          settings: expect.any(Object),
          updated_at: expect.any(String)
        }),
        filters: { id: '12345678-1234-1234-1234-123456789012' },
      });
    });

    it('should validate settings before updating', async () => {
      mockExecuteFunctions.getNodeParameter
        .mockReset()
        .mockReturnValueOnce('updateOptimizationSettings') // operation
        .mockReturnValueOnce('12345678-1234-1234-1234-123456789012') // salonId
        .mockReturnValueOnce(JSON.stringify({
          template_cost_euros: -0.01, // Invalid negative cost
        })); // newSettings

      const result = await serviceWindowNode.execute.call(mockExecuteFunctions);

      expect(result[0]).toHaveLength(1);
      const error = result[0][0].json;

      expect(error).toMatchObject({
        error: true,
        error_code: 'SERVICE_WINDOW_ERROR',
        error_message: expect.stringContaining('Template cost must be greater than 0'),
      });
    });
  });

  describe('getOptimizationStats operation', () => {
    beforeEach(() => {
      mockExecuteFunctions.getNodeParameter
        .mockReturnValueOnce('getOptimizationStats') // operation
        .mockReturnValueOnce('12345678-1234-1234-1234-123456789012') // salonId
        .mockReturnValueOnce(30); // calculationPeriod

      // Mock analytics data
      (utils.executeDatabaseOperation as jest.Mock).mockResolvedValue({
        success: true,
        data: [
          {
            event_data: {
              should_optimize: true,
              estimated_savings_euros: 0.05,
              delay_minutes: 180,
              optimization_confidence: 0.8,
            },
          },
          {
            event_data: {
              should_optimize: true,
              estimated_savings_euros: 0.05,
              delay_minutes: 120,
              optimization_confidence: 0.7,
            },
          },
          {
            event_data: {
              should_optimize: false,
              estimated_savings_euros: 0,
              delay_minutes: 0,
              optimization_confidence: 0.3,
            },
          },
        ],
        execution_time_ms: 100,
      });
    });

    it('should retrieve optimization statistics', async () => {
      const result = await serviceWindowNode.execute.call(mockExecuteFunctions);

      expect(result[0]).toHaveLength(1);
      const stats = result[0][0].json;

      expect(stats).toMatchObject({
        statistics_available: true,
        calculation_period_days: 30,
        optimization_stats: expect.objectContaining({
          total_decisions: 3,
          optimizations_applied: 2,
          optimization_rate: expect.closeTo(0.67, 1),
          total_savings_euros: 0.10,
          average_delay_minutes: 150, // (180 + 120) / 2
          average_confidence: expect.closeTo(0.75, 1), // (0.8 + 0.7) / 2
        }),
        performance_summary: expect.objectContaining({
          optimization_assessment: expect.any(String),
          savings_assessment: expect.any(String),
        }),
      });
    });

    it('should handle no statistics data gracefully', async () => {
      (utils.executeDatabaseOperation as jest.Mock).mockResolvedValue({
        success: true,
        data: [],
        execution_time_ms: 50,
      });

      const result = await serviceWindowNode.execute.call(mockExecuteFunctions);
      const stats = result[0][0].json;

      expect(stats).toMatchObject({
        statistics_available: true,
        optimization_stats: expect.objectContaining({
          total_decisions: 0,
          optimizations_applied: 0,
          optimization_rate: 0,
          total_savings_euros: 0,
        }),
      });
    });
  });

  describe('error handling', () => {
    it('should handle salon not found gracefully', async () => {
      (utils.getSalonData as jest.Mock).mockResolvedValue(null);

      mockExecuteFunctions.getNodeParameter
        .mockReturnValueOnce('optimizeResponseTiming') // operation
        .mockReturnValueOnce('nonexistent-salon-id') // salonId
        .mockReturnValueOnce(JSON.stringify(mockConversationContext)) // conversationContext
        .mockReturnValueOnce('Hello') // messageContent
        .mockReturnValueOnce('medium') // customerUrgency
        .mockReturnValueOnce(0.3) // bookingProbability
        .mockReturnValueOnce(false); // overrideSafetyChecks

      const result = await serviceWindowNode.execute.call(mockExecuteFunctions);

      expect(result[0]).toHaveLength(1);
      expect(result[0][0].json).toMatchObject({
        error: true,
        error_code: 'SALON_NOT_FOUND',
        error_message: expect.stringContaining('Salon not found'),
      });
    });

    it('should handle invalid conversation context', async () => {
      (utils.validateConversationContext as jest.Mock).mockReturnValue({
        valid: false,
        errors: ['Invalid conversation ID'],
        warnings: [],
      });

      mockExecuteFunctions.getNodeParameter
        .mockReturnValueOnce('optimizeResponseTiming') // operation
        .mockReturnValueOnce('12345678-1234-1234-1234-123456789012') // salonId
        .mockReturnValueOnce('{"invalid": "context"}') // conversationContext
        .mockReturnValueOnce('Hello') // messageContent
        .mockReturnValueOnce('medium') // customerUrgency
        .mockReturnValueOnce(0.3) // bookingProbability
        .mockReturnValueOnce(false); // overrideSafetyChecks

      const result = await serviceWindowNode.execute.call(mockExecuteFunctions);

      expect(result[0]).toHaveLength(1);
      expect(result[0][0].json).toMatchObject({
        error: true,
        error_code: 'SERVICE_WINDOW_ERROR',
        error_message: expect.stringContaining('Invalid conversation context'),
      });
    });

    it('should handle service window disabled salon', async () => {
      const salonWithoutServiceWindow = {
        ...mockSalonData,
        settings: {
          ...mockSalonData.settings,
          whatsapp_settings: {
            ...mockSalonData.settings!.whatsapp_settings,
            service_window_settings: {
              ...mockSalonData.settings!.whatsapp_settings!.service_window_settings,
              enabled: false,
            },
          },
        },
      };

      (utils.getSalonData as jest.Mock).mockResolvedValue(salonWithoutServiceWindow);

      mockExecuteFunctions.getNodeParameter
        .mockReturnValueOnce('optimizeResponseTiming') // operation
        .mockReturnValueOnce('12345678-1234-1234-1234-123456789012') // salonId
        .mockReturnValueOnce(JSON.stringify(mockConversationContext)) // conversationContext
        .mockReturnValueOnce('Hello') // messageContent
        .mockReturnValueOnce('medium') // customerUrgency
        .mockReturnValueOnce(0.3) // bookingProbability
        .mockReturnValueOnce(false); // overrideSafetyChecks

      const result = await serviceWindowNode.execute.call(mockExecuteFunctions);
      const [defaultOutput, optimizedOutput, immediateOutput] = result;

      expect(immediateOutput).toHaveLength(1);
      expect(immediateOutput[0].json).toMatchObject({
        should_optimize: false,
        reasoning: expect.stringContaining('disabled'),
      });
    });
  });

  describe('performance monitoring', () => {
    it('should track performance metrics', async () => {
      // Create proper mock with consistent parameter handling
      const nodeParams = {
        operation: 'optimizeResponseTiming',
        salonId: TEST_CONSTANTS.SALON_IDS.VALID,
        conversationContext: JSON.stringify(createMockConversationContext()),
        messageContent: 'Hello',
        customerUrgency: 'medium',
        bookingProbability: 0.3,
        overrideSafetyChecks: false,
      };
      
      mockExecuteFunctions.getNodeParameter.mockImplementation((paramName: string, itemIndex = 0) => {
        return nodeParams[paramName as keyof typeof nodeParams];
      });

      await serviceWindowNode.execute.call(mockExecuteFunctions);

      expect(utils.startPerformanceTimer).toHaveBeenCalledWith('ServiceWindow');
      expect(utils.endPerformanceTimer).toHaveBeenCalledWith('timer-123', expect.objectContaining({
        node_name: 'ServiceWindow',
        salon_id: TEST_CONSTANTS.SALON_IDS.VALID,
      }));
    });

    it('should log optimization decisions for analytics', async () => {
      mockExecuteFunctions.getNodeParameter
        .mockReturnValueOnce('optimizeResponseTiming') // operation
        .mockReturnValueOnce('12345678-1234-1234-1234-123456789012') // salonId
        .mockReturnValueOnce(JSON.stringify(mockConversationContext)) // conversationContext
        .mockReturnValueOnce('Hello') // messageContent
        .mockReturnValueOnce('medium') // customerUrgency
        .mockReturnValueOnce(0.3) // bookingProbability
        .mockReturnValueOnce(false); // overrideSafetyChecks

      await serviceWindowNode.execute.call(mockExecuteFunctions);

      expect(utils.logServiceWindowOptimization).toHaveBeenCalledWith(
        '12345678-1234-1234-1234-123456789012',
        '98765432-1234-1234-1234-123456789012',
        expect.any(Boolean),
        expect.any(Number),
        expect.any(String),
        'exec-123'
      );
    });
  });
});