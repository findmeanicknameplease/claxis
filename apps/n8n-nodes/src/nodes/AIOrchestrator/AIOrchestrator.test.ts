import { IExecuteFunctions } from 'n8n-workflow';
import { AIOrchestrator } from './AIOrchestrator.node';
import { SalonData, ConversationContext } from '../../types';
import * as utils from '../../utils';
import { TEST_CONSTANTS } from '../../__tests__/constants';
import { createMockConversationContext } from '../../__tests__/test-helpers';

// Mock the utils module
jest.mock('../../utils', () => ({
  getSalonData: jest.fn(),
  executeDatabaseOperation: jest.fn(),
  logInfo: jest.fn(),
  logError: jest.fn(),
  logWarn: jest.fn(),
  startPerformanceTimer: jest.fn().mockReturnValue('timer-123'),
  endPerformanceTimer: jest.fn(),
  logAIModelUsage: jest.fn(),
  validateNodeExecutionContext: jest.fn().mockReturnValue({ valid: true, errors: [], warnings: [] }),
  validateConversationContext: jest.fn().mockReturnValue({ valid: true, errors: [], warnings: [] }),
  initializeDatabase: jest.fn(),
  isDatabaseInitialized: jest.fn().mockReturnValue(true),
}));

describe('AIOrchestrator Node', () => {
  let aiOrchestratorNode: AIOrchestrator;
  let mockExecuteFunctions: jest.Mocked<IExecuteFunctions>;
  let mockSalonData: SalonData;
  let mockConversationContext: ConversationContext;

  beforeEach(() => {
    aiOrchestratorNode = new AIOrchestrator();
    
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

    mockConversationContext = {
      id: '98765432-1234-1234-1234-123456789012',
      salon_id: '12345678-1234-1234-1234-123456789012',
      customer_id: '11111111-1111-1111-1111-111111111111',
      channel: 'whatsapp',
      external_id: 'whatsapp_123456',
      status: 'active',
      last_message_at: new Date().toISOString(),
      message_count: 3,
      customer_sentiment: 'neutral',
      intent_detected: 'general_inquiry',
      booking_probability: 0.3,
    };

    mockExecuteFunctions = {
      getInputData: jest.fn().mockReturnValue([{ json: {} }]),
      getNodeParameter: jest.fn(),
      getExecutionId: jest.fn().mockReturnValue('exec-123'),
      getMode: jest.fn().mockReturnValue('manual'),
      getNode: jest.fn().mockReturnValue({ 
        id: 'ai-orchestrator-node',
        name: 'AI Orchestrator',
        type: 'aiOrchestrator',
      }),
    } as unknown as jest.Mocked<IExecuteFunctions>;

    (utils.getSalonData as jest.Mock).mockResolvedValue(mockSalonData);
    
    // Ensure validation mocks are properly set for each test (same pattern as ServiceWindow)
    (utils.validateNodeExecutionContext as jest.Mock).mockReturnValue({ valid: true, errors: [], warnings: [] });
    (utils.validateConversationContext as jest.Mock).mockReturnValue({ valid: true, errors: [], warnings: [] });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('routeAIRequest operation', () => {
    beforeEach(() => {
      mockExecuteFunctions.getNodeParameter
        .mockReturnValueOnce('routeAIRequest') // operation
        .mockReturnValueOnce('12345678-1234-1234-1234-123456789012') // salonId
        .mockReturnValueOnce(JSON.stringify(mockConversationContext)) // conversationContext
        .mockReturnValueOnce('Hello, I need help with booking an appointment') // messageContent
        .mockReturnValueOnce('general_inquiry') // requestType
        .mockReturnValueOnce('balanced') // responsePriority
        .mockReturnValueOnce('{"max_cost_euros": 1.0, "enforce_limit": false}'); // budgetConstraints
    });

    it('should route to Gemini Flash for general inquiries', async () => {
      const result = await aiOrchestratorNode.execute.call(mockExecuteFunctions);

      expect(result).toHaveLength(4);
      const [defaultOutput, geminiOutput, deepseekOutput, elevenLabsOutput] = result;

      expect(defaultOutput).toHaveLength(1);
      const routingResult = defaultOutput[0].json;

      expect(routingResult).toMatchObject({
        routing_decision: 'model_selected',
        selected_model: 'gemini_flash',
        reasoning: expect.any(String),
        confidence_score: expect.any(Number),
        estimated_cost_euros: expect.any(Number),
        model_capabilities: expect.objectContaining({
          strengths: expect.any(Array),
          limitations: expect.any(Array),
          use_cases: expect.any(Array),
        }),
      });

      expect(utils.logAIModelUsage).toHaveBeenCalledWith(
        '12345678-1234-1234-1234-123456789012',
        '98765432-1234-1234-1234-123456789012',
        'gemini_flash',
        expect.any(Number),
        'exec-123'
      );
    });

    it('should route to DeepSeek for complex problem solving', async () => {
      mockExecuteFunctions.getNodeParameter
        .mockReset()
        .mockReturnValueOnce('routeAIRequest') // operation
        .mockReturnValueOnce('12345678-1234-1234-1234-123456789012') // salonId
        .mockReturnValueOnce(JSON.stringify(mockConversationContext)) // conversationContext
        .mockReturnValueOnce('I have a complex scheduling conflict that needs analysis') // messageContent
        .mockReturnValueOnce('complex_problem_solving') // requestType
        .mockReturnValueOnce('quality') // responsePriority
        .mockReturnValueOnce('{"max_cost_euros": 1.0, "enforce_limit": false}'); // budgetConstraints

      const result = await aiOrchestratorNode.execute.call(mockExecuteFunctions);
      const routingResult = result[0][0].json;

      expect(routingResult).toMatchObject({
        routing_decision: 'model_selected',
        selected_model: 'deepseek_r1',
        reasoning: expect.stringContaining('Complex problem solving'),
      });
    });

    it('should respect budget constraints', async () => {
      mockExecuteFunctions.getNodeParameter
        .mockReset()
        .mockReturnValueOnce('routeAIRequest') // operation
        .mockReturnValueOnce('12345678-1234-1234-1234-123456789012') // salonId
        .mockReturnValueOnce(JSON.stringify(mockConversationContext)) // conversationContext
        .mockReturnValueOnce('Very long message that would be expensive to process...'.repeat(100)) // messageContent
        .mockReturnValueOnce('general_inquiry') // requestType
        .mockReturnValueOnce('balanced') // responsePriority
        .mockReturnValueOnce('{"max_cost_euros": 0.001, "enforce_limit": true}'); // budgetConstraints

      const result = await aiOrchestratorNode.execute.call(mockExecuteFunctions);
      const routingResult = result[0][0].json;

      expect(routingResult).toMatchObject({
        routing_decision: 'budget_exceeded',
        selected_model: 'none',
        reasoning: expect.stringContaining('budget limit'),
        budget_status: expect.objectContaining({
          estimated_cost_euros: expect.any(Number),
          budget_limit_euros: 0.001,
        }),
      });
    });

    it('should route to ElevenLabs for voice responses', async () => {
      mockExecuteFunctions.getNodeParameter
        .mockReset()
        .mockReturnValueOnce('routeAIRequest') // operation
        .mockReturnValueOnce('12345678-1234-1234-1234-123456789012') // salonId
        .mockReturnValueOnce(JSON.stringify(mockConversationContext)) // conversationContext
        .mockReturnValueOnce('Generate voice response') // messageContent
        .mockReturnValueOnce('voice_response') // requestType
        .mockReturnValueOnce('balanced') // responsePriority
        .mockReturnValueOnce('{"max_cost_euros": 1.0, "enforce_limit": false}'); // budgetConstraints

      const result = await aiOrchestratorNode.execute.call(mockExecuteFunctions);
      const routingResult = result[0][0].json;

      expect(routingResult).toMatchObject({
        routing_decision: 'model_selected',
        selected_model: 'elevenlabs',
        reasoning: 'Voice response requested',
        confidence_score: 1.0,
      });
    });
  });

  describe('generateResponse operation', () => {
    beforeEach(() => {
      mockExecuteFunctions.getNodeParameter
        .mockReturnValueOnce('generateResponse') // operation
        .mockReturnValueOnce('12345678-1234-1234-1234-123456789012') // salonId
        .mockReturnValueOnce(JSON.stringify(mockConversationContext)) // conversationContext
        .mockReturnValueOnce('Hello, how can I help you?') // messageContent
        .mockReturnValueOnce('gemini_flash') // preferredModel
        .mockReturnValueOnce('de'); // language
    });

    it('should generate response using specified model', async () => {
      const result = await aiOrchestratorNode.execute.call(mockExecuteFunctions);
      const [defaultOutput, geminiOutput, deepseekOutput, elevenLabsOutput] = result;

      expect(geminiOutput).toHaveLength(1);
      const responseResult = geminiOutput[0].json;

      expect(responseResult).toMatchObject({
        response_generated: true,
        model_used: 'gemini_flash',
        language: 'de',
        response_content: expect.stringContaining('Gemini Flash'),
        confidence_score: expect.any(Number),
        processing_time_ms: expect.any(Number),
        cost_euros: expect.any(Number),
        token_usage: expect.objectContaining({
          input: expect.any(Number),
          output: expect.any(Number),
        }),
        conversation_id: '98765432-1234-1234-1234-123456789012',
      });
    });

    it('should auto-select model when preferred is auto', async () => {
      mockExecuteFunctions.getNodeParameter
        .mockReset()
        .mockReturnValueOnce('generateResponse') // operation
        .mockReturnValueOnce('12345678-1234-1234-1234-123456789012') // salonId
        .mockReturnValueOnce(JSON.stringify(mockConversationContext)) // conversationContext
        .mockReturnValueOnce('Hello, how can I help you?') // messageContent
        .mockReturnValueOnce('auto') // preferredModel
        .mockReturnValueOnce('auto'); // language

      const result = await aiOrchestratorNode.execute.call(mockExecuteFunctions);

      expect(result[1]).toHaveLength(1); // Should route to gemini output
      const responseResult = result[1][0].json;

      expect(responseResult).toMatchObject({
        response_generated: true,
        model_used: 'gemini_flash', // Auto-selected
        language: 'de', // From salon settings
      });
    });

    it('should handle DeepSeek response routing', async () => {
      mockExecuteFunctions.getNodeParameter
        .mockReset()
        .mockReturnValueOnce('generateResponse') // operation
        .mockReturnValueOnce('12345678-1234-1234-1234-123456789012') // salonId
        .mockReturnValueOnce(JSON.stringify(mockConversationContext)) // conversationContext
        .mockReturnValueOnce('Complex analysis required') // messageContent
        .mockReturnValueOnce('deepseek_r1') // preferredModel
        .mockReturnValueOnce('en'); // language

      const result = await aiOrchestratorNode.execute.call(mockExecuteFunctions);
      const [defaultOutput, geminiOutput, deepseekOutput, elevenLabsOutput] = result;

      expect(deepseekOutput).toHaveLength(1);
      const responseResult = deepseekOutput[0].json;

      expect(responseResult).toMatchObject({
        model_used: 'deepseek_r1',
        language: 'en',
        response_content: expect.stringContaining('DeepSeek R1'),
      });
    });
  });

  describe('analyzeModelPerformance operation', () => {
    beforeEach(() => {
      mockExecuteFunctions.getNodeParameter
        .mockReturnValueOnce('analyzeModelPerformance') // operation
        .mockReturnValueOnce('12345678-1234-1234-1234-123456789012') // salonId
        .mockReturnValueOnce(30); // calculationPeriod

      // Mock analytics data
      (utils.executeDatabaseOperation as jest.Mock).mockResolvedValue({
        success: true,
        data: [
          {
            event_data: {
              model_used: 'gemini_flash',
              cost_euros: 0.001,
              processing_time_ms: 150,
            },
          },
          {
            event_data: {
              model_used: 'deepseek_r1',
              cost_euros: 0.005,
              processing_time_ms: 800,
            },
          },
          {
            event_data: {
              model_used: 'gemini_flash',
              cost_euros: 0.001,
              processing_time_ms: 120,
            },
          },
        ],
        execution_time_ms: 100,
      });
    });

    it('should analyze model performance correctly', async () => {
      const result = await aiOrchestratorNode.execute.call(mockExecuteFunctions);

      expect(result[0]).toHaveLength(1);
      const analysis = result[0][0].json;

      expect(analysis).toMatchObject({
        performance_analysis_available: true,
        calculation_period_days: 30,
        total_requests: 3,
        model_performance: expect.objectContaining({
          gemini_flash: expect.objectContaining({
            total_requests: 2,
            total_cost_euros: 0.002,
            avg_response_time_ms: 135, // (150 + 120) / 2
          }),
          deepseek_r1: expect.objectContaining({
            total_requests: 1,
            total_cost_euros: 0.005,
            avg_response_time_ms: 800,
          }),
        }),
        cost_analysis: expect.objectContaining({
          total_cost_euros: 0.007,
          average_cost_per_request_euros: expect.closeTo(0.0023, 3),
        }),
        recommendations: expect.any(Array),
      });
    });

    it('should handle no performance data gracefully', async () => {
      (utils.executeDatabaseOperation as jest.Mock).mockResolvedValue({
        success: true,
        data: [],
        execution_time_ms: 50,
      });

      const result = await aiOrchestratorNode.execute.call(mockExecuteFunctions);
      const analysis = result[0][0].json;

      expect(analysis).toMatchObject({
        performance_analysis_available: true,
        total_requests: 0,
        model_performance: {},
      });
    });
  });

  describe('updateAISettings operation', () => {
    beforeEach(() => {
      mockExecuteFunctions.getNodeParameter
        .mockReturnValueOnce('updateAISettings') // operation
        .mockReturnValueOnce('12345678-1234-1234-1234-123456789012') // salonId
        .mockReturnValueOnce(JSON.stringify({
          cost_budget_monthly_euros: 150,
          confidence_threshold: 0.9,
          preferred_language: 'en',
        })); // newAISettings

      (utils.executeDatabaseOperation as jest.Mock).mockResolvedValue({
        success: true,
        affected_rows: 1,
        execution_time_ms: 75,
      });
    });

    it('should update AI settings successfully', async () => {
      const result = await aiOrchestratorNode.execute.call(mockExecuteFunctions);

      expect(result[0]).toHaveLength(1);
      const update = result[0][0].json;

      expect(update).toMatchObject({
        settings_updated: true,
        old_settings: mockSalonData.settings!.ai_settings,
        new_settings: expect.objectContaining({
          cost_budget_monthly_euros: 150,
          confidence_threshold: 0.9,
          preferred_language: 'en',
          gemini_enabled: true, // Should preserve existing settings
        }),
        changes_applied: ['cost_budget_monthly_euros', 'confidence_threshold', 'preferred_language'],
        estimated_impact: expect.any(Object),
      });

      expect(utils.executeDatabaseOperation).toHaveBeenCalledWith({
        type: 'update',
        table: 'salons',
        salon_id: '12345678-1234-1234-1234-123456789012',
        data: { settings: expect.any(Object) },
        filters: { id: '12345678-1234-1234-1234-123456789012' },
      });
    });

    it('should validate AI settings before updating', async () => {
      mockExecuteFunctions.getNodeParameter
        .mockReset()
        .mockReturnValueOnce('updateAISettings') // operation
        .mockReturnValueOnce('12345678-1234-1234-1234-123456789012') // salonId
        .mockReturnValueOnce(JSON.stringify({
          cost_budget_monthly_euros: -50, // Invalid negative budget
        })); // newAISettings

      const result = await aiOrchestratorNode.execute.call(mockExecuteFunctions);

      expect(result[0]).toHaveLength(1);
      const error = result[0][0].json;

      expect(error).toMatchObject({
        error: true,
        error_code: 'AI_ORCHESTRATOR_ERROR',
        error_message: expect.stringContaining('Monthly cost budget must be non-negative'),
      });
    });
  });

  describe('getAIUsageStats operation', () => {
    beforeEach(() => {
      mockExecuteFunctions.getNodeParameter
        .mockReturnValueOnce('getAIUsageStats') // operation
        .mockReturnValueOnce('12345678-1234-1234-1234-123456789012') // salonId
        .mockReturnValueOnce(30); // calculationPeriod

      // Mock usage statistics data
      (utils.executeDatabaseOperation as jest.Mock).mockResolvedValue({
        success: true,
        data: [
          {
            event_data: {
              model_used: 'gemini_flash',
              cost_euros: 0.001,
              processing_time_ms: 150,
            },
          },
          {
            event_data: {
              model_used: 'deepseek_r1',
              cost_euros: 0.005,
              processing_time_ms: 800,
            },
          },
        ],
        execution_time_ms: 100,
      });
    });

    it('should retrieve AI usage statistics', async () => {
      const result = await aiOrchestratorNode.execute.call(mockExecuteFunctions);

      expect(result[0]).toHaveLength(1);
      const stats = result[0][0].json;

      expect(stats).toMatchObject({
        statistics_available: true,
        calculation_period_days: 30,
        usage_summary: expect.objectContaining({
          total_requests: 2,
          total_cost_euros: 0.006,
          average_requests_per_day: expect.closeTo(0.067, 2),
          average_cost_per_day_euros: expect.closeTo(0.0002, 4),
        }),
        model_breakdown: expect.any(Object),
        cost_breakdown: expect.any(Object),
        trends: expect.any(Object),
        budget_status: expect.objectContaining({
          monthly_budget_euros: 100,
          budget_utilization_percentage: expect.any(Number),
        }),
        recommendations: expect.any(Array),
      });
    });
  });

  describe('synthesizeVoiceResponse operation', () => {
    beforeEach(() => {
      mockExecuteFunctions.getNodeParameter
        .mockReturnValueOnce('synthesizeVoiceResponse') // operation
        .mockReturnValueOnce('12345678-1234-1234-1234-123456789012') // salonId
        .mockReturnValueOnce('Hello, welcome to our salon!') // messageContent
        .mockReturnValueOnce('{"voice_id": "default", "stability": 0.75, "similarity_boost": 0.8}') // voiceSettings
        .mockReturnValueOnce('de'); // language
    });

    it('should synthesize voice response successfully', async () => {
      const result = await aiOrchestratorNode.execute.call(mockExecuteFunctions);
      const [defaultOutput, geminiOutput, deepseekOutput, elevenLabsOutput] = result;

      expect(elevenLabsOutput).toHaveLength(1);
      const voiceResult = elevenLabsOutput[0].json;

      expect(voiceResult).toMatchObject({
        voice_synthesis_completed: true,
        original_text: 'Hello, welcome to our salon!',
        language: 'de',
        voice_settings: {
          voice_id: 'default',
          stability: 0.75,
          similarity_boost: 0.8,
        },
        audio_url: expect.stringContaining('elevenlabs.io'),
        audio_duration_seconds: expect.any(Number),
        cost_euros: expect.any(Number),
      });
    });

    it('should handle ElevenLabs disabled', async () => {
      const salonWithoutElevenLabs = {
        ...mockSalonData,
        settings: {
          ...mockSalonData.settings,
          ai_settings: {
            ...mockSalonData.settings!.ai_settings,
            elevenlabs_enabled: false,
          },
        },
      };

      (utils.getSalonData as jest.Mock).mockResolvedValue(salonWithoutElevenLabs);

      const result = await aiOrchestratorNode.execute.call(mockExecuteFunctions);

      expect(result[0]).toHaveLength(1);
      expect(result[0][0].json).toMatchObject({
        error: true,
        error_code: 'AI_ORCHESTRATOR_ERROR',
        error_message: expect.stringContaining('ElevenLabs voice synthesis is not enabled'),
      });
    });
  });

  describe('optimizeAIBudget operation', () => {
    beforeEach(() => {
      mockExecuteFunctions.getNodeParameter
        .mockReturnValueOnce('optimizeAIBudget') // operation
        .mockReturnValueOnce('12345678-1234-1234-1234-123456789012') // salonId
        .mockReturnValueOnce('{"max_cost_euros": 50, "target_savings_percent": 20}'); // budgetConstraints

      // Mock current usage data
      (utils.executeDatabaseOperation as jest.Mock).mockResolvedValue({
        success: true,
        data: [
          {
            event_data: {
              model_used: 'deepseek_r1',
              cost_euros: 0.01,
              processing_time_ms: 1000,
            },
          },
        ],
        execution_time_ms: 100,
      });
    });

    it('should generate budget optimization recommendations', async () => {
      const result = await aiOrchestratorNode.execute.call(mockExecuteFunctions);

      expect(result[0]).toHaveLength(1);
      const optimization = result[0][0].json;

      expect(optimization).toMatchObject({
        budget_optimization_available: true,
        current_usage: expect.objectContaining({
          summary: expect.any(Object),
        }),
        budget_constraints: {
          max_cost_euros: 50,
          target_savings_percent: 20,
        },
        optimization_recommendations: expect.any(Array),
        potential_savings_euros: expect.any(Number),
        risk_assessment: expect.any(String),
        implementation_steps: expect.any(Array),
      });

      expect(optimization.optimization_recommendations).toContain(
        'Switch high-volume requests to cost-effective models'
      );
    });
  });

  describe('error handling', () => {
    it('should handle salon not found', async () => {
      (utils.getSalonData as jest.Mock).mockResolvedValue(null);

      mockExecuteFunctions.getNodeParameter
        .mockReturnValueOnce('routeAIRequest') // operation
        .mockReturnValueOnce('nonexistent-salon-id'); // salonId

      const result = await aiOrchestratorNode.execute.call(mockExecuteFunctions);

      expect(result[0]).toHaveLength(1);
      expect(result[0][0].json).toMatchObject({
        error: true,
        error_code: 'AI_ORCHESTRATOR_ERROR',
        error_message: expect.stringContaining('Salon not found'),
      });
    });

    it('should handle AI features disabled', async () => {
      const salonWithoutAI = {
        ...mockSalonData,
        settings: {
          ...mockSalonData.settings,
          ai_settings: {
            ...mockSalonData.settings!.ai_settings,
            gemini_enabled: false,
            deepseek_enabled: false,
            elevenlabs_enabled: false,
          },
        },
      };

      (utils.getSalonData as jest.Mock).mockResolvedValue(salonWithoutAI);

      mockExecuteFunctions.getNodeParameter
        .mockReturnValueOnce('routeAIRequest') // operation
        .mockReturnValueOnce('12345678-1234-1234-1234-123456789012'); // salonId

      const result = await aiOrchestratorNode.execute.call(mockExecuteFunctions);

      expect(result[0]).toHaveLength(1);
      expect(result[0][0].json).toMatchObject({
        error: true,
        error_code: 'AI_ORCHESTRATOR_ERROR',
        error_message: 'AI features are disabled for this salon',
      });
    });

    it('should handle invalid conversation context', async () => {
      (utils.validateConversationContext as jest.Mock).mockReturnValue({
        valid: false,
        errors: ['Invalid conversation ID'],
        warnings: [],
      });

      mockExecuteFunctions.getNodeParameter
        .mockReturnValueOnce('routeAIRequest') // operation
        .mockReturnValueOnce('12345678-1234-1234-1234-123456789012') // salonId
        .mockReturnValueOnce('{"invalid": "context"}') // conversationContext
        .mockReturnValueOnce('Hello') // messageContent
        .mockReturnValueOnce('general_inquiry') // requestType
        .mockReturnValueOnce('balanced') // responsePriority
        .mockReturnValueOnce('{}'); // budgetConstraints

      const result = await aiOrchestratorNode.execute.call(mockExecuteFunctions);

      expect(result[0]).toHaveLength(1);
      expect(result[0][0].json).toMatchObject({
        error: true,
        error_code: 'AI_ORCHESTRATOR_ERROR',
        error_message: expect.stringContaining('Invalid conversation context'),
      });
    });

    it('should handle invalid JSON in parameters', async () => {
      mockExecuteFunctions.getNodeParameter
        .mockReturnValueOnce('routeAIRequest') // operation
        .mockReturnValueOnce('12345678-1234-1234-1234-123456789012') // salonId
        .mockReturnValueOnce('{invalid json}') // conversationContext
        .mockReturnValueOnce('Hello') // messageContent
        .mockReturnValueOnce('general_inquiry') // requestType
        .mockReturnValueOnce('balanced') // responsePriority
        .mockReturnValueOnce('{}'); // budgetConstraints

      const result = await aiOrchestratorNode.execute.call(mockExecuteFunctions);

      expect(result[0]).toHaveLength(1);
      expect(result[0][0].json).toMatchObject({
        error: true,
        error_code: 'AI_ORCHESTRATOR_ERROR',
        error_message: expect.stringContaining('Invalid JSON'),
      });
    });
  });

  describe('performance monitoring', () => {
    it('should track performance metrics', async () => {
      // Create proper mock with consistent parameter handling
      const nodeParams = {
        operation: 'routeAIRequest',
        salonId: TEST_CONSTANTS.SALON_IDS.VALID,
        conversationContext: JSON.stringify(createMockConversationContext()),
        messageContent: 'Hello',
        requestType: 'general_inquiry',
        responsePriority: 'balanced',
        budgetConstraints: '{}',
        optimizationMode: 'balanced',
      };
      
      mockExecuteFunctions.getNodeParameter.mockImplementation((paramName: string, itemIndex = 0) => {
        return nodeParams[paramName as keyof typeof nodeParams];
      });

      await aiOrchestratorNode.execute.call(mockExecuteFunctions);

      expect(utils.startPerformanceTimer).toHaveBeenCalledWith('AIOrchestrator');
      expect(utils.endPerformanceTimer).toHaveBeenCalledWith('timer-123', expect.objectContaining({
        node_name: 'AIOrchestrator',
        salon_id: TEST_CONSTANTS.SALON_IDS.VALID,
      }));
    });

    it('should log AI model usage for analytics', async () => {
      mockExecuteFunctions.getNodeParameter
        .mockReturnValueOnce('routeAIRequest') // operation
        .mockReturnValueOnce('12345678-1234-1234-1234-123456789012') // salonId
        .mockReturnValueOnce(JSON.stringify(mockConversationContext)) // conversationContext
        .mockReturnValueOnce('Hello') // messageContent
        .mockReturnValueOnce('general_inquiry') // requestType
        .mockReturnValueOnce('balanced') // responsePriority
        .mockReturnValueOnce('{}'); // budgetConstraints

      await aiOrchestratorNode.execute.call(mockExecuteFunctions);

      expect(utils.logAIModelUsage).toHaveBeenCalledWith(
        '12345678-1234-1234-1234-123456789012',
        '98765432-1234-1234-1234-123456789012',
        'gemini_flash',
        expect.any(Number),
        'exec-123'
      );
    });
  });
});