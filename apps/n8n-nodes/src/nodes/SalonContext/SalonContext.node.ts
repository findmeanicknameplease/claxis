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
// SALON CONTEXT NODE IMPLEMENTATION
// =============================================================================

export class SalonContext implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Salon Context',
    name: 'salonContext',
    icon: 'file:salonContext.svg',
    group: ['transform'],
    version: 1,
    description: 'Fetches salon-specific context, settings, and business rules for workflow execution',
    defaults: {
      name: 'Salon Context',
    },
    inputs: ['main'],
    outputs: ['main'],
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
            name: 'Get Salon Data',
            value: 'getSalonData',
            description: 'Retrieve complete salon information and settings',
            action: 'Get salon data',
          },
          {
            name: 'Get Business Hours',
            value: 'getBusinessHours',
            description: 'Get salon business hours for specific day or current status',
            action: 'Get business hours',
          },
          {
            name: 'Get WhatsApp Settings',
            value: 'getWhatsAppSettings',
            description: 'Retrieve WhatsApp Business API configuration',
            action: 'Get WhatsApp settings',
          },
          {
            name: 'Get AI Settings',
            value: 'getAISettings',
            description: 'Retrieve AI model preferences and budget settings',
            action: 'Get AI settings',
          },
          {
            name: 'Check Salon Status',
            value: 'checkSalonStatus',
            description: 'Check if salon is currently open and operational',
            action: 'Check salon status',
          },
        ],
        default: 'getSalonData',
      },
      {
        displayName: 'Salon ID',
        name: 'salonId',
        type: 'string',
        required: true,
        default: '',
        placeholder: '12345678-1234-1234-1234-123456789012',
        description: 'UUID of the salon to fetch context for',
        displayOptions: {
          show: {
            operation: [
              'getSalonData',
              'getBusinessHours', 
              'getWhatsAppSettings',
              'getAISettings',
              'checkSalonStatus',
            ],
          },
        },
      },
      {
        displayName: 'Target Date',
        name: 'targetDate',
        type: 'dateTime',
        default: '',
        description: 'Specific date to check business hours for (defaults to current date)',
        displayOptions: {
          show: {
            operation: ['getBusinessHours', 'checkSalonStatus'],
          },
        },
      },
      {
        displayName: 'Include Sensitive Data',
        name: 'includeSensitive',
        type: 'boolean',
        default: false,
        description: 'Whether to include sensitive information like API keys (use with caution)',
        displayOptions: {
          show: {
            operation: ['getSalonData', 'getWhatsAppSettings', 'getAISettings'],
          },
        },
      },
      {
        displayName: 'Cache Duration (minutes)',
        name: 'cacheDuration',
        type: 'number',
        default: 5,
        description: 'How long to cache salon data to improve performance (0 to disable)',
        typeOptions: {
          minValue: 0,
          maxValue: 60,
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
      const timer = startPerformanceTimer('SalonContext');
      
      try {
        // Extract parameters
        const operation = this.getNodeParameter('operation', i) as string;
        const salonId = this.getNodeParameter('salonId', i) as string;
        // const _targetDate = this.getNodeParameter('targetDate', i, new Date().toISOString()) as string;
        const includeSensitive = this.getNodeParameter('includeSensitive', i, false) as boolean;

        // Create execution context
        const executionContext: NodeExecutionContext = {
          salon_id: salonId,
          execution_id: this.getExecutionId(),
          timestamp: new Date().toISOString(),
          debug_mode: this.getMode() === 'manual',
        };

        // Validate inputs
        const validation = validateNodeExecutionContext(executionContext);
        if (!validation.valid) {
          throw new NodeOperationError(
            this.getNode(), 
            `Invalid execution context: ${validation.errors.join(', ')}`,
            { itemIndex: i }
          );
        }

        logInfo('SalonContext node execution started', {
          operation,
          salon_id: salonId,
        }, salonId, executionContext.execution_id);

        // Get salon data
        const salonData = await getSalonData(salonId);
        
        if (!salonData) {
          throw new NodeOperationError(
            this.getNode(),
            `Salon not found or access denied: ${salonId}`,
            { itemIndex: i }
          );
        }

        // Execute the requested operation - simplified implementation
        let result: Record<string, unknown>;

        switch (operation) {
          case 'getSalonData':
            // TODO: Implement full data redaction based on 'includeSensitive' parameter
            const processedSalonData = includeSensitive ? salonData : redactSensitiveData(salonData);
            
            result = {
              operation_completed: 'getSalonData',
              salon_data: processedSalonData,
            };
            break;
          
          case 'getBusinessHours':
            const targetDate = this.getNodeParameter('targetDate', i, new Date().toISOString()) as string;
            const businessHours = calculateBusinessHoursForDate(salonData, targetDate);
            
            result = {
              operation_completed: 'getBusinessHours',
              ...businessHours, // Contract: tests expect direct properties
            };
            break;
          
          case 'getWhatsAppSettings':
            const whatsappSettings = includeSensitive 
              ? salonData.settings?.whatsapp_settings 
              : redactSensitiveData({ whatsapp_settings: salonData.settings?.whatsapp_settings }).whatsapp_settings;
            
            result = {
              operation_completed: 'getWhatsAppSettings',
              whatsapp_configured: !!whatsappSettings?.enabled,
              whatsapp_enabled: whatsappSettings?.enabled || false,
              whatsapp_settings: whatsappSettings,
            };
            break;
          
          case 'getAISettings':
            const aiSettings = salonData.settings?.ai_settings;
            
            result = {
              operation_completed: 'getAISettings',
              ai_configured: !!aiSettings,
              available_models: {
                gemini_flash: aiSettings?.gemini_enabled || false,
                deepseek_r1: aiSettings?.deepseek_enabled || false,
                elevenlabs: aiSettings?.elevenlabs_enabled || false,
              },
              ai_settings: aiSettings,
            };
            break;
          
          case 'checkSalonStatus':
            const targetDate2 = this.getNodeParameter('targetDate', i, new Date().toISOString()) as string;
            const statusCheck = calculateSalonStatus(salonData, targetDate2);
            
            result = {
              operation_completed: 'checkSalonStatus',
              ...statusCheck, // Contract: tests expect direct properties
            };
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

        logInfo('SalonContext node execution completed successfully', {
          operation,
          result_keys: Object.keys(result),
        }, salonId, executionContext.execution_id);

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        logError('SalonContext node execution failed', error as Error, {
          operation: this.getNodeParameter('operation', i),
          salon_id: this.getNodeParameter('salonId', i),
        });

        // Create error response
        const errorResponse: ErrorResponse = {
          error: true,
          error_code: 'SALON_CONTEXT_ERROR',
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
          node_name: 'SalonContext',
          salon_id: this.getNodeParameter('salonId', i) as string,
        });
      }
    }

    return [returnData];
  }

}

// =============================================================================
// HELPER FUNCTIONS FOR BUSINESS LOGIC
// =============================================================================

/**
 * TODO: Implement full data redaction logic based on includeSensitive parameter
 * For now, returns data as-is (sensitive info included)
 */
function redactSensitiveData(salonData: any): any {
  // Basic implementation - just redact access tokens
  const redacted = JSON.parse(JSON.stringify(salonData)); // Deep clone
  
  // Handle full salon data structure
  if (redacted.settings?.whatsapp_settings) {
    redacted.settings.whatsapp_settings.access_token = '[REDACTED]';
    redacted.settings.whatsapp_settings.webhook_verify_token = '[REDACTED]';
  }
  
  // Handle whatsapp_settings passed directly (for getWhatsAppSettings operation)
  if (redacted.whatsapp_settings) {
    redacted.whatsapp_settings.access_token = '[REDACTED]';
    redacted.whatsapp_settings.webhook_verify_token = '[REDACTED]';
  }
  
  return redacted;
}

/**
 * TODO: Implement full business hours calculation with timezone handling
 * For now, returns basic day-of-week calculation
 */
function calculateBusinessHoursForDate(salonData: any, targetDate: string): any {
  const date = new Date(targetDate);
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayOfWeek = dayNames[date.getDay()];
  
  const businessHours = salonData.settings?.business_hours?.[dayOfWeek];
  
  return {
    day_of_week: dayOfWeek,
    is_configured: !!businessHours,
    is_open: businessHours?.is_open || false,
    open_time: businessHours?.open_time || null,
    close_time: businessHours?.close_time || null,
    timezone: salonData.timezone,
  };
}

/**
 * TODO: Implement full salon status calculation with business hours logic
 * For now, returns basic operational status
 */
function calculateSalonStatus(salonData: any, targetDate: string): any {
  const date = new Date(targetDate);
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayOfWeek = dayNames[date.getDay()];
  
  const businessHours = salonData.settings?.business_hours?.[dayOfWeek];
  const isOpenToday = businessHours?.is_open || false;
  const isSubscriptionActive = salonData.subscription_status === 'active';
  
  // TODO: Add time-of-day checking for is_within_hours
  const isWithinHours = isOpenToday; // Simplified for now
  const isOperational = isSubscriptionActive && isOpenToday && isWithinHours;
  
  return {
    is_operational: isOperational,
    is_subscription_active: isSubscriptionActive,
    is_open_today: isOpenToday,
    is_within_hours: isWithinHours,
    day_of_week: dayOfWeek,
    subscription_tier: salonData.subscription_tier,
    reason: isOperational ? null : `Salon is closed on ${dayOfWeek}`,
  };
}
