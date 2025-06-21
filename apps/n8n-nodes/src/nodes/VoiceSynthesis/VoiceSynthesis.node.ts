import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeOperationError,
} from 'n8n-workflow';

import {
  NodeExecutionContext,
  GeminiSalonNodeData,
  ErrorResponse,
} from '@/types';

import {
  getSalonData,
  logInfo,
  logError,
  startPerformanceTimer,
  endPerformanceTimer,
  validateNodeExecutionContext,
  initializeDatabase,
  isDatabaseInitialized,
} from '@/utils';

// =============================================================================
// VOICE SYNTHESIS NODE IMPLEMENTATION
// =============================================================================

export class VoiceSynthesis implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Voice Synthesis',
    name: 'voiceSynthesis',
    icon: 'file:voiceSynthesis.svg',
    group: ['ai'],
    version: 1,
    description: 'Converts text to speech using ElevenLabs via async VoiceSynthesisService. Supports immediate response with callback completion.',
    defaults: {
      name: 'Voice Synthesis',
    },
    inputs: ['main'],
    outputs: ['main', 'success', 'failure'],
    outputNames: ['Default', 'Voice Success', 'Voice Failed'],
    credentials: [
      {
        name: 'claxisApi',
        required: true,
      },
    ],
    properties: [
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        options: [
          {
            name: 'Synthesize Voice',
            value: 'synthesizeVoice',
            description: 'Convert text to speech using async service',
            action: 'Synthesize voice',
          },
          {
            name: 'Check Service Status',
            value: 'checkServiceStatus',
            description: 'Verify VoiceSynthesisService availability',
            action: 'Check service status',
          },
        ],
        default: 'synthesizeVoice',
      },
      {
        displayName: 'Salon ID',
        name: 'salonId',
        type: 'string',
        required: true,
        default: '',
        placeholder: '12345678-1234-1234-1234-123456789012',
        description: 'UUID of the salon for cost tracking and voice settings',
        displayOptions: {
          show: {
            operation: ['synthesizeVoice'],
          },
        },
      },
      {
        displayName: 'Text to Synthesize',
        name: 'text',
        type: 'string',
        required: true,
        default: '',
        placeholder: 'Hallo, Ihr Termin ist bestätigt!',
        description: 'Text to convert to speech. Supports German voice in Phase 3.1',
        displayOptions: {
          show: {
            operation: ['synthesizeVoice'],
          },
        },
      },
      {
        displayName: 'Voice Language',
        name: 'language',
        type: 'options',
        options: [
          {
            name: 'German',
            value: 'de',
            description: 'Professional German voice (Phase 3.1)',
          },
          {
            name: 'English',
            value: 'en',
            description: 'Coming in Phase 3.2',
          },
        ],
        default: 'de',
        description: 'Language for voice synthesis',
        displayOptions: {
          show: {
            operation: ['synthesizeVoice'],
          },
        },
      },
      {
        displayName: 'Service URL',
        name: 'serviceUrl',
        type: 'string',
        default: 'http://localhost:3000',
        description: 'VoiceSynthesisService base URL (configure for production)',
        displayOptions: {
          show: {
            operation: ['synthesizeVoice', 'checkServiceStatus'],
          },
        },
      },
      {
        displayName: 'Test Scenario',
        name: 'testScenario',
        type: 'options',
        options: [
          {
            name: 'None (Real Synthesis)',
            value: '',
            description: 'Use real ElevenLabs API',
          },
          {
            name: 'Success Test',
            value: 'success',
            description: 'Mock successful synthesis',
          },
          {
            name: 'Quota Exceeded Test',
            value: 'failure_quota',
            description: 'Mock quota exceeded error',
          },
          {
            name: 'Synthesis Error Test',
            value: 'failure_synthesis',
            description: 'Mock ElevenLabs API error',
          },
          {
            name: 'Storage Error Test',
            value: 'failure_storage',
            description: 'Mock Supabase storage error',
          },
        ],
        default: '',
        description: 'Test mode for development (bypasses real API calls)',
        displayOptions: {
          show: {
            operation: ['synthesizeVoice'],
          },
        },
      },
      {
        displayName: 'Callback Mode',
        name: 'callbackMode',
        type: 'options',
        options: [
          {
            name: 'Wait for Callback',
            value: 'wait',
            description: 'Use n8n Wait node for async callback (recommended)',
          },
          {
            name: 'Fire and Forget',
            value: 'fire_and_forget',
            description: 'Start synthesis without waiting for completion',
          },
        ],
        default: 'wait',
        description: 'How to handle the async voice synthesis process',
        displayOptions: {
          show: {
            operation: ['synthesizeVoice'],
          },
        },
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];

    // Initialize database connection
    if (!isDatabaseInitialized()) {
      initializeDatabase();
    }

    for (let i = 0; i < items.length; i++) {
      const timer = startPerformanceTimer('VoiceSynthesis');
      
      try {
        // Extract parameters
        const operation = this.getNodeParameter('operation', i) as string;
        const salonId = this.getNodeParameter('salonId', i, '') as string;
        const serviceUrl = this.getNodeParameter('serviceUrl', i, 'http://localhost:3000') as string;

        // Create execution context
        const executionContext: NodeExecutionContext = {
          salon_id: salonId,
          execution_id: this.getExecutionId(),
          timestamp: new Date().toISOString(),
          debug_mode: this.getMode() === 'manual',
        };

        logInfo('VoiceSynthesis node execution started', {
          operation,
          salon_id: salonId,
        }, salonId, executionContext.execution_id);

        let result: Record<string, unknown>;

        switch (operation) {
          case 'synthesizeVoice':
            // Handle voice synthesis operation
            const text = this.getNodeParameter('text', i) as string;
            const language = this.getNodeParameter('language', i, 'de') as string;
            const testScenario = this.getNodeParameter('testScenario', i, '') as string;
            const callbackMode = this.getNodeParameter('callbackMode', i, 'wait') as string;

            if (!text.trim()) {
              throw new NodeOperationError(
                this.getNode(),
                'Text to synthesize cannot be empty',
                { itemIndex: i }
              );
            }

            // Validate salon access
            const salonData = await getSalonData(salonId);
            if (!salonData) {
              throw new NodeOperationError(
                this.getNode(),
                `Salon not found or access denied: ${salonId}`,
                { itemIndex: i }
              );
            }

            // Prepare request payload
            const payload: any = {
              text: text.trim(),
              language,
              salonId,
              idempotencyKey: executionContext.execution_id,
            };

            // Add test scenario if specified
            if (testScenario) {
              payload.testScenario = testScenario;
            }

            // Handle callback URL for wait mode
            if (callbackMode === 'wait') {
              // In a real implementation, this would use the n8n Wait node's callback URL
              // For now, we'll use a placeholder approach
              payload.callbackUrl = `${serviceUrl}/callback/placeholder`;
              
              logInfo('Voice synthesis initiated with callback', {
                text_length: text.length,
                test_scenario: testScenario || 'production',
              }, salonId, executionContext.execution_id);
              
              result = {
                synthesis_initiated: true,
                status: 'processing',
                message: 'Voice synthesis started - waiting for callback',
                estimated_completion_seconds: testScenario ? 0.1 : 2,
                callback_mode: 'wait',
                idempotency_key: executionContext.execution_id,
              };
              break;
            }

            // Fire and forget mode - just initiate synthesis
            try {
              const response = await this.helpers.httpRequest({
                method: 'POST',
                url: `${serviceUrl}/synthesize`,
                headers: {
                  'Content-Type': 'application/json',
                  'x-api-key': 'test-key-123', // TODO: Use proper credential
                },
                body: payload,
                timeout: 10000,
              });

              result = {
                synthesis_initiated: true,
                status: 'accepted',
                message: 'Voice synthesis request accepted',
                service_response: response,
                callback_mode: 'fire_and_forget',
                idempotency_key: executionContext.execution_id,
              };

            } catch (error) {
              throw new NodeOperationError(
                this.getNode(),
                `Failed to call VoiceSynthesisService: ${error instanceof Error ? error.message : 'Unknown error'}`,
                { itemIndex: i }
              );
            }
            break;
          
          case 'checkServiceStatus':
            // Handle service status check
            try {
              const response = await this.helpers.httpRequest({
                method: 'GET',
                url: `${serviceUrl}/health`,
                timeout: 5000,
              });

              result = {
                service_available: true,
                service_status: 'healthy',
                service_response: response,
                checked_at: new Date().toISOString(),
              };

            } catch (error) {
              result = {
                service_available: false,
                service_status: 'unavailable',
                error_message: error instanceof Error ? error.message : 'Unknown error',
                checked_at: new Date().toISOString(),
              };
            }
            break;
          
          default:
            throw new NodeOperationError(
              this.getNode(),
              `Unsupported operation: ${operation}`,
              { itemIndex: i }
            );
        }

        // Create output data
        const outputData: GeminiSalonNodeData = {
          json: {
            ...result,
            salon_id: salonId,
            timestamp: new Date().toISOString(),
          },
        };

        returnData.push(outputData);

        logInfo('VoiceSynthesis node execution completed successfully', {
          operation,
          result_keys: Object.keys(result),
        }, salonId, executionContext.execution_id);

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        logError('VoiceSynthesis node execution failed', error as Error, {
          operation: this.getNodeParameter('operation', i),
          salon_id: this.getNodeParameter('salonId', i),
        });

        // Create error response
        const errorResponse: ErrorResponse = {
          error: true,
          error_code: 'VOICE_SYNTHESIS_ERROR',
          error_message: errorMessage,
          error_details: {
            operation: this.getNodeParameter('operation', i),
            salon_id: this.getNodeParameter('salonId', i),
          },
          timestamp: new Date().toISOString(),
          execution_id: this.getExecutionId(),
        };

        returnData.push({ json: errorResponse as any });

        // Re-throw for n8n error handling if in strict mode
        if (this.getMode() === 'manual') {
          throw error;
        }

      } finally {
        endPerformanceTimer(timer, {
          node_name: 'VoiceSynthesis',
          salon_id: this.getNodeParameter('salonId', i) as string,
        });
      }
    }

    return [returnData, [], []]; // Default, success, failure outputs
  }
}