import { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { InstagramClient } from './InstagramClient.node';
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

describe('InstagramClient Node', () => {
  let instagramClient: InstagramClient;
  let mockExecuteFunctions: jest.Mocked<IExecuteFunctions>;
  
  const mockSalonData = {
    id: 'salon-123',
    name: 'Test Salon',
    subscription_tier: 'enterprise',
    settings: {
      instagram: {
        auto_reply_enabled: true,
        booking_intent_threshold: 0.7,
        response_templates: {
          de: 'Vielen Dank für Ihr Interesse! Schreiben Sie uns eine DM.',
          en: 'Thank you for your interest! Send us a DM.',
        },
      },
    },
  };

  beforeEach(() => {
    instagramClient = new InstagramClient();
    
    // Mock execution context
    mockExecuteFunctions = {
      getInputData: jest.fn(),
      getNodeParameter: jest.fn(),
      getNode: jest.fn(() => ({ name: 'InstagramClient', type: 'instagramClient' })),
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
    (utils.validateNodeExecutionContext as jest.Mock).mockReturnValue({});
    (utils.startPerformanceTimer as jest.Mock).mockReturnValue('timer-123');
    (utils.endPerformanceTimer as jest.Mock).mockReturnValue(150);
    (utils.executeDatabaseOperation as jest.Mock).mockResolvedValue(undefined);
  });

  describe('Node Configuration', () => {
    test('should have correct node description', () => {
      expect(instagramClient.description.displayName).toBe('Instagram Client');
      expect(instagramClient.description.name).toBe('instagramClient');
      expect(instagramClient.description.group).toContain('social');
      expect(instagramClient.description.outputs).toEqual(['main', 'success', 'failure']);
    });

    test('should have all required operations', () => {
      const operations = instagramClient.description.properties
        ?.find(prop => prop.name === 'operation')
        ?.options?.map((opt: any) => opt.value);
      
      expect(operations).toContain('monitorComments');
      expect(operations).toContain('replyComment');
      expect(operations).toContain('sendDM');
      expect(operations).toContain('analyzePost');
      expect(operations).toContain('getRecentPosts');
      expect(operations).toContain('processWebhook');
    });
  });

  describe('Monitor Comments Operation', () => {
    beforeEach(() => {
      mockExecuteFunctions.getInputData.mockReturnValue([{ json: {} }]);
      mockExecuteFunctions.getNodeParameter
        .mockImplementation((paramName: string) => {
          switch (paramName) {
            case 'operation':
              return 'monitorComments';
            case 'mediaId':
              return '18025823451234567';
            case 'advancedOptions':
              return {
                language: 'de',
                bookingIntentThreshold: 0.7,
                autoReplyEnabled: true,
                trackAnalytics: true,
              };
            case 'performanceTracking':
              return { enableMonitoring: true };
            default:
              return undefined;
          }
        });
    });

    test('should monitor comments successfully', async () => {
      const result = await instagramClient.execute.call(mockExecuteFunctions);
      
      expect(result).toHaveLength(3); // [main, success, failure]
      expect(result[0]).toHaveLength(1); // One item processed
      expect(result[1]).toHaveLength(1); // Success output
      expect(result[2]).toHaveLength(0); // No failures
      
      const outputData = result[0][0].json;
      expect(outputData.success).toBe(true);
      expect(outputData.media_id).toBe('18025823451234567');
      expect(outputData.comments_analyzed).toBeGreaterThan(0);
      expect(outputData.booking_intents_found).toBeDefined();
    });

    test('should track performance metrics', async () => {
      await instagramClient.execute.call(mockExecuteFunctions);
      
      expect(utils.startPerformanceTimer).toHaveBeenCalled();
      expect(utils.endPerformanceTimer).toHaveBeenCalledWith('timer-123');
      expect(utils.logInfo).toHaveBeenCalledWith(
        'Instagram operation completed successfully',
        expect.objectContaining({
          operation: 'monitorComments',
          salonId: 'salon-123',
          executionTime: 150,
        })
      );
    });

    test('should store analytics data', async () => {
      await instagramClient.execute.call(mockExecuteFunctions);
      
      expect(utils.executeDatabaseOperation).toHaveBeenCalled();
    });
  });

  describe('Reply Comment Operation', () => {
    beforeEach(() => {
      mockExecuteFunctions.getInputData.mockReturnValue([{ json: {} }]);
      mockExecuteFunctions.getNodeParameter
        .mockImplementation((paramName: string) => {
          switch (paramName) {
            case 'operation':
              return 'replyComment';
            case 'commentId':
              return '17987456321234567';
            case 'replyMessage':
              return 'Thank you for your interest! Please send us a DM.';
            case 'advancedOptions':
              return {};
            case 'performanceTracking':
              return { enableMonitoring: true };
            default:
              return undefined;
          }
        });
    });

    test('should reply to comment successfully', async () => {
      const result = await instagramClient.execute.call(mockExecuteFunctions);
      
      const outputData = result[0][0].json;
      expect(outputData.success).toBe(true);
      expect(outputData.original_comment_id).toBe('17987456321234567');
      expect(outputData.reply_message).toBe('Thank you for your interest! Please send us a DM.');
      expect(outputData.reply_id).toBeDefined();
      expect(outputData.posted_at).toBeDefined();
    });
  });

  describe('Send Direct Message Operation', () => {
    beforeEach(() => {
      mockExecuteFunctions.getInputData.mockReturnValue([{ json: {} }]);
      mockExecuteFunctions.getNodeParameter
        .mockImplementation((paramName: string) => {
          switch (paramName) {
            case 'operation':
              return 'sendDM';
            case 'recipientUserId':
              return '17841400123456789';
            case 'messageContent':
              return 'Hello! Thanks for your interest in our services.';
            case 'advancedOptions':
              return {};
            case 'performanceTracking':
              return { enableMonitoring: true };
            default:
              return undefined;
          }
        });
    });

    test('should send DM successfully', async () => {
      const result = await instagramClient.execute.call(mockExecuteFunctions);
      
      const outputData = result[0][0].json;
      expect(outputData.success).toBe(true);
      expect(outputData.recipient_id).toBe('17841400123456789');
      expect(outputData.message_content).toBe('Hello! Thanks for your interest in our services.');
      expect(outputData.message_id).toBeDefined();
      expect(outputData.delivery_status).toBe('sent');
    });
  });

  describe('Analyze Post Operation', () => {
    beforeEach(() => {
      mockExecuteFunctions.getInputData.mockReturnValue([{ json: {} }]);
      mockExecuteFunctions.getNodeParameter
        .mockImplementation((paramName: string) => {
          switch (paramName) {
            case 'operation':
              return 'analyzePost';
            case 'mediaId':
              return '18025823451234567';
            case 'advancedOptions':
              return {
                includeMediaAnalysis: true,
                trackAnalytics: true,
              };
            case 'performanceTracking':
              return { enableMonitoring: true };
            default:
              return undefined;
          }
        });
    });

    test('should analyze post with media analysis', async () => {
      const result = await instagramClient.execute.call(mockExecuteFunctions);
      
      const outputData = result[0][0].json;
      expect(outputData.success).toBe(true);
      expect(outputData.analysis).toBeDefined();
      expect(outputData.analysis.media_id).toBe('18025823451234567');
      expect(outputData.analysis.engagement).toBeDefined();
      expect(outputData.analysis.performance).toBeDefined();
      expect(outputData.analysis.content_analysis).toBeDefined(); // Should include media analysis
      expect(outputData.analysis.comments_with_booking_intent).toBeDefined();
    });
  });

  describe('Get Recent Posts Operation', () => {
    beforeEach(() => {
      mockExecuteFunctions.getInputData.mockReturnValue([{ json: {} }]);
      mockExecuteFunctions.getNodeParameter
        .mockImplementation((paramName: string) => {
          switch (paramName) {
            case 'operation':
              return 'getRecentPosts';
            case 'advancedOptions':
              return {};
            case 'performanceTracking':
              return { enableMonitoring: true };
            default:
              return undefined;
          }
        });
    });

    test('should get recent posts successfully', async () => {
      const result = await instagramClient.execute.call(mockExecuteFunctions);
      
      const outputData = result[0][0].json;
      expect(outputData.success).toBe(true);
      expect(outputData.posts_count).toBeGreaterThan(0);
      expect(outputData.posts).toBeDefined();
      expect(Array.isArray(outputData.posts)).toBe(true);
      
      // Check post structure
      const firstPost = (outputData.posts as any[])[0];
      expect(firstPost.id).toBeDefined();
      expect(firstPost.media_type).toBeDefined();
      expect(firstPost.permalink).toBeDefined();
      expect(firstPost.like_count).toBeDefined();
      expect(firstPost.comments_count).toBeDefined();
    });
  });

  describe('Process Webhook Operation', () => {
    const mockCommentWebhookData = {
      comment_id: '123456789',
      text: 'Can I book an appointment?',
      from: {
        id: '987654321',
        username: 'test_user',
      },
      media_id: '18025823451234567',
    };

    beforeEach(() => {
      mockExecuteFunctions.getInputData.mockReturnValue([{ json: {} }]);
      mockExecuteFunctions.getNodeParameter
        .mockImplementation((paramName: string) => {
          switch (paramName) {
            case 'operation':
              return 'processWebhook';
            case 'webhookEventType':
              return 'comment';
            case 'webhookEventData':
              return JSON.stringify(mockCommentWebhookData);
            case 'advancedOptions':
              return {};
            case 'performanceTracking':
              return { enableMonitoring: true };
            default:
              return undefined;
          }
        });
    });

    test('should process comment webhook successfully', async () => {
      const result = await instagramClient.execute.call(mockExecuteFunctions);
      
      const outputData = result[0][0].json;
      expect(outputData.success).toBe(true);
      expect(outputData.event_type).toBe('comment');
      expect(outputData.processed_at).toBeDefined();
      expect(outputData.result).toBeDefined();
      expect(outputData.result.comment_id).toBe('123456789');
      expect(outputData.result.booking_intent_score).toBeDefined();
    });

    test('should handle DM webhook', async () => {
      const mockDMData = {
        sender: { id: '987654321' },
        message: { 
          mid: 'mid.123456',
          text: 'Hello, I want to book an appointment'
        },
      };
      
      mockExecuteFunctions.getNodeParameter
        .mockImplementation((paramName: string) => {
          switch (paramName) {
            case 'operation':
              return 'processWebhook';
            case 'webhookEventType':
              return 'dm';
            case 'webhookEventData':
              return JSON.stringify(mockDMData);
            default:
              return undefined;
          }
        });

      const result = await instagramClient.execute.call(mockExecuteFunctions);
      
      const outputData = result[0][0].json;
      expect(outputData.success).toBe(true);
      expect(outputData.event_type).toBe('dm');
      expect(outputData.result.message_id).toBe('mid.123456');
      expect(outputData.result.sender_id).toBe('987654321');
    });

    test('should handle invalid JSON in webhook data', async () => {
      mockExecuteFunctions.getNodeParameter
        .mockImplementation((paramName: string) => {
          switch (paramName) {
            case 'operation':
              return 'processWebhook';
            case 'webhookEventType':
              return 'comment';
            case 'webhookEventData':
              return 'invalid json';
            default:
              return undefined;
          }
        });

      const result = await instagramClient.execute.call(mockExecuteFunctions);
      
      expect(result[0]).toHaveLength(1); // Error output
      expect(result[2]).toHaveLength(1); // Failure output
      
      const errorData = result[2][0].json;
      expect(errorData.success).toBe(false);
      expect(errorData.error).toContain('Invalid JSON in webhook event data');
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
      const result = await instagramClient.execute.call(mockExecuteFunctions);
      
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
              return 'monitorComments';
            default:
              return undefined;
          }
        });

      const result = await instagramClient.execute.call(mockExecuteFunctions);
      
      const errorData = result[2][0].json;
      expect(errorData.success).toBe(false);
      expect(errorData.error).toBe('Salon not found');
    });
  });

  describe('Multi-language Support', () => {
    beforeEach(() => {
      mockExecuteFunctions.getInputData.mockReturnValue([{ json: {} }]);
    });

    test('should support German language', async () => {
      mockExecuteFunctions.getNodeParameter
        .mockImplementation((paramName: string) => {
          switch (paramName) {
            case 'operation':
              return 'monitorComments';
            case 'mediaId':
              return '18025823451234567';
            case 'advancedOptions':
              return { language: 'de' };
            case 'performanceTracking':
              return {};
            default:
              return undefined;
          }
        });

      const result = await instagramClient.execute.call(mockExecuteFunctions);
      
      expect(utils.logInfo).toHaveBeenCalledWith(
        'Monitoring Instagram comments',
        expect.objectContaining({ language: 'de' })
      );
    });

    test('should support multiple EU languages', async () => {
      const languages = ['de', 'en', 'nl', 'fr'];
      
      for (const lang of languages) {
        mockExecuteFunctions.getNodeParameter
          .mockImplementation((paramName: string) => {
            switch (paramName) {
              case 'operation':
                return 'monitorComments';
              case 'mediaId':
                return '18025823451234567';
              case 'advancedOptions':
                return { language: lang };
              case 'performanceTracking':
                return {};
              default:
                return undefined;
            }
          });

        const result = await instagramClient.execute.call(mockExecuteFunctions);
        const outputData = result[0][0].json;
        
        expect(outputData.success).toBe(true);
        
        jest.clearAllMocks();
        (utils.getSalonData as jest.Mock).mockResolvedValue(mockSalonData);
        (utils.validateNodeExecutionContext as jest.Mock).mockReturnValue({});
        (utils.startPerformanceTimer as jest.Mock).mockReturnValue('timer-123');
        (utils.endPerformanceTimer as jest.Mock).mockReturnValue(150);
      }
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
              return 'getRecentPosts';
            default:
              return undefined;
          }
        });

      await instagramClient.execute.call(mockExecuteFunctions);
      
      expect(utils.initializeDatabase).toHaveBeenCalled();
    });

    test('should not initialize database if already initialized', async () => {
      (utils.isDatabaseInitialized as jest.Mock).mockReturnValue(true);
      
      mockExecuteFunctions.getInputData.mockReturnValue([{ json: {} }]);
      mockExecuteFunctions.getNodeParameter
        .mockImplementation((paramName: string) => {
          switch (paramName) {
            case 'operation':
              return 'getRecentPosts';
            default:
              return undefined;
          }
        });

      await instagramClient.execute.call(mockExecuteFunctions);
      
      expect(utils.initializeDatabase).not.toHaveBeenCalled();
    });
  });
});
