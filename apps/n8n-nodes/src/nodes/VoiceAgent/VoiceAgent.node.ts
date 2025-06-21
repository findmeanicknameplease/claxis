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
  executeDatabaseOperation,
} from '@/utils';

// =============================================================================
// VOICE AGENT NODE IMPLEMENTATION
// =============================================================================
// Manages premium voice agent features for Enterprise tier customers:
// - Outbound call campaigns (reactivation, follow-up, reviews)
// - Missed call auto-callback with spam protection
// - Voice agent analytics and performance tracking
// - Integration with Voice Gateway Service for real-time calls
// =============================================================================

export class VoiceAgent implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Voice Agent',
    name: 'voiceAgent',
    icon: 'file:voiceAgent.svg',
    group: ['ai'],
    version: 1,
    description: 'Premium voice agent for outbound calls, callbacks, and conversational AI. Enterprise tier feature for automated customer retention and acquisition.',
    defaults: {
      name: 'Voice Agent',
    },
    inputs: ['main'],
    outputs: ['main', 'success', 'failure'],
    outputNames: ['Default', 'Call Success', 'Call Failed'],
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
            name: 'Initiate Outbound Call',
            value: 'initiateCall',
            description: 'Start an automated voice call campaign',
            action: 'Initiate outbound call',
          },
          {
            name: 'Process Missed Call Callback',
            value: 'processMissedCall',
            description: 'Handle missed call with spam protection and auto-callback',
            action: 'Process missed call callback',
          },
          {
            name: 'Manage Campaign',
            value: 'manageCampaign',
            description: 'Create, update, or monitor voice agent campaigns',
            action: 'Manage campaign',
          },
          {
            name: 'Check Voice Agent Status',
            value: 'checkStatus',
            description: 'Verify Voice Gateway Service availability and performance',
            action: 'Check voice agent status',
          },
          {
            name: 'Get Voice Analytics',
            value: 'getAnalytics',
            description: 'Retrieve voice agent performance metrics and ROI data',
            action: 'Get voice analytics',
          },
        ],
        default: 'initiateCall',
      },
      {
        displayName: 'Salon ID',
        name: 'salonId',
        type: 'string',
        required: true,
        default: '',
        placeholder: '12345678-1234-1234-1234-123456789012',
        description: 'UUID of the salon for voice agent operations',
      },
      {
        displayName: 'Voice Gateway URL',
        name: 'voiceGatewayUrl',
        type: 'string',
        default: 'http://localhost:3001',
        description: 'Voice Gateway Service base URL',
      },
      
      // Initiate Call Parameters
      {
        displayName: 'Phone Number',
        name: 'phoneNumber',
        type: 'string',
        required: true,
        default: '',
        placeholder: '+31612345678',
        description: 'Customer phone number to call (international format)',
        displayOptions: {
          show: {
            operation: ['initiateCall'],
          },
        },
      },
      {
        displayName: 'Campaign Type',
        name: 'campaignType',
        type: 'options',
        options: [
          {
            name: 'Reactivation Call',
            value: 'reactivation',
            description: 'Re-engage dormant customers with personalized offers',
          },
          {
            name: 'Follow-up Call',
            value: 'followup',
            description: 'Post-appointment follow-up and rebooking',
          },
          {
            name: 'Review Request',
            value: 'review_request',
            description: 'Request voice review from satisfied customers',
          },
          {
            name: 'Appointment Reminder',
            value: 'appointment_reminder',
            description: 'Automated appointment confirmation and reminders',
          },
          {
            name: 'Promotion Call',
            value: 'promotion',
            description: 'Promotional offers and special deals',
          },
        ],
        default: 'reactivation',
        description: 'Type of outbound call campaign',
        displayOptions: {
          show: {
            operation: ['initiateCall'],
          },
        },
      },
      {
        displayName: 'Customer Context',
        name: 'customerContext',
        type: 'json',
        default: '{}',
        description: 'Customer data and context for personalized conversation (JSON format)',
        placeholder: '{"last_visit": "2024-01-15", "preferred_service": "haircut", "name": "Maria"}',
        displayOptions: {
          show: {
            operation: ['initiateCall'],
          },
        },
      },
      {
        displayName: 'Schedule Call Time',
        name: 'scheduledTime',
        type: 'dateTime',
        default: '',
        description: 'Schedule call for later (leave empty for immediate call)',
        displayOptions: {
          show: {
            operation: ['initiateCall'],
          },
        },
      },

      // Missed Call Parameters
      {
        displayName: 'Missed Call Phone Number',
        name: 'missedCallPhone',
        type: 'string',
        required: true,
        default: '',
        placeholder: '+31612345678',
        description: 'Phone number that missed the call',
        displayOptions: {
          show: {
            operation: ['processMissedCall'],
          },
        },
      },
      {
        displayName: 'Enable Spam Protection',
        name: 'enableSpamProtection',
        type: 'boolean',
        default: true,
        description: 'Use Twilio Lookup API to verify phone number before callback',
        displayOptions: {
          show: {
            operation: ['processMissedCall'],
          },
        },
      },
      {
        displayName: 'Callback Delay Minutes',
        name: 'callbackDelayMinutes',
        type: 'number',
        default: 2,
        description: 'Minutes to wait before attempting callback',
        displayOptions: {
          show: {
            operation: ['processMissedCall'],
          },
        },
      },

      // Campaign Management Parameters
      {
        displayName: 'Campaign Action',
        name: 'campaignAction',
        type: 'options',
        options: [
          {
            name: 'Create Campaign',
            value: 'create',
            description: 'Create new voice agent campaign',
          },
          {
            name: 'Start Campaign',
            value: 'start',
            description: 'Activate existing campaign',
          },
          {
            name: 'Pause Campaign',
            value: 'pause',
            description: 'Temporarily pause campaign',
          },
          {
            name: 'Stop Campaign',
            value: 'stop',
            description: 'End campaign permanently',
          },
          {
            name: 'Get Campaign Status',
            value: 'status',
            description: 'Check campaign performance',
          },
        ],
        default: 'create',
        description: 'Campaign management action',
        displayOptions: {
          show: {
            operation: ['manageCampaign'],
          },
        },
      },
      {
        displayName: 'Campaign Configuration',
        name: 'campaignConfig',
        type: 'json',
        default: '{"name": "Reactivation Campaign", "target_criteria": {"last_visit_days_ago": 90}}',
        description: 'Campaign configuration (JSON format)',
        displayOptions: {
          show: {
            operation: ['manageCampaign'],
            campaignAction: ['create'],
          },
        },
      },
      {
        displayName: 'Campaign ID',
        name: 'campaignId',
        type: 'string',
        default: '',
        description: 'Existing campaign ID for management operations',
        displayOptions: {
          show: {
            operation: ['manageCampaign'],
            campaignAction: ['start', 'pause', 'stop', 'status'],
          },
        },
      },

      // Analytics Parameters
      {
        displayName: 'Analytics Period',
        name: 'analyticsPeriod',
        type: 'options',
        options: [
          {
            name: 'Today',
            value: 'today',
            description: 'Today\'s voice agent performance',
          },
          {
            name: 'Last 7 Days',
            value: 'week',
            description: 'Weekly performance summary',
          },
          {
            name: 'Last 30 Days',
            value: 'month',
            description: 'Monthly performance and ROI',
          },
          {
            name: 'Custom Range',
            value: 'custom',
            description: 'Specify custom date range',
          },
        ],
        default: 'week',
        description: 'Time period for analytics',
        displayOptions: {
          show: {
            operation: ['getAnalytics'],
          },
        },
      },
      {
        displayName: 'Start Date',
        name: 'startDate',
        type: 'dateTime',
        default: '',
        description: 'Start date for custom analytics range',
        displayOptions: {
          show: {
            operation: ['getAnalytics'],
            analyticsPeriod: ['custom'],
          },
        },
      },
      {
        displayName: 'End Date',
        name: 'endDate',
        type: 'dateTime',
        default: '',
        description: 'End date for custom analytics range',
        displayOptions: {
          show: {
            operation: ['getAnalytics'],
            analyticsPeriod: ['custom'],
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
      const timer = startPerformanceTimer('VoiceAgent');
      
      try {
        // Extract parameters
        const operation = this.getNodeParameter('operation', i) as string;
        const salonId = this.getNodeParameter('salonId', i) as string;
        const voiceGatewayUrl = this.getNodeParameter('voiceGatewayUrl', i, 'http://localhost:3001') as string;

        // Create execution context
        const executionContext: NodeExecutionContext = {
          salon_id: salonId,
          execution_id: this.getExecutionId(),
          timestamp: new Date().toISOString(),
          debug_mode: this.getMode() === 'manual',
        };

        logInfo('VoiceAgent node execution started', {
          operation,
          salon_id: salonId,
        }, salonId, executionContext.execution_id);

        // Validate salon access and Enterprise tier
        const salonData = await getSalonData(salonId);
        if (!salonData) {
          throw new NodeOperationError(
            this.getNode(),
            `Salon not found or access denied: ${salonId}`,
            { itemIndex: i }
          );
        }

        // Check if voice agent is enabled and salon has Enterprise tier
        if (!salonData.settings?.voice_agent_settings?.enabled) {
          throw new NodeOperationError(
            this.getNode(),
            'Voice Agent is not enabled for this salon. Upgrade to Enterprise tier to access premium voice features.',
            { itemIndex: i }
          );
        }

        let result: Record<string, unknown>;

        switch (operation) {
          case 'initiateCall':
            result = await VoiceAgent.handleInitiateCall(this, i, salonData, voiceGatewayUrl);
            break;

          case 'processMissedCall':
            result = await VoiceAgent.handleProcessMissedCall(this, i, salonData, voiceGatewayUrl);
            break;

          case 'manageCampaign':
            result = await VoiceAgent.handleManageCampaign(this, i, salonData);
            break;

          case 'checkStatus':
            result = await VoiceAgent.handleCheckStatus(this, voiceGatewayUrl);
            break;

          case 'getAnalytics':
            result = await VoiceAgent.handleGetAnalytics(this, i, salonData);
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

        logInfo('VoiceAgent node execution completed successfully', {
          operation,
          result_keys: Object.keys(result),
        }, salonId, executionContext.execution_id);

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        logError('VoiceAgent node execution failed', error as Error, {
          operation: this.getNodeParameter('operation', i),
          salon_id: this.getNodeParameter('salonId', i),
        });

        // Create error response
        const errorResponse: ErrorResponse = {
          error: true,
          error_code: 'VOICE_AGENT_ERROR',
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
          node_name: 'VoiceAgent',
          salon_id: this.getNodeParameter('salonId', i) as string,
        });
      }
    }

    return [returnData, [], []]; // Default, success, failure outputs
  }

  /**
   * Handle outbound call initiation
   */
  private static async handleInitiateCall(
    executionContext: IExecuteFunctions,
    itemIndex: number,
    salonData: any,
    voiceGatewayUrl: string
  ): Promise<Record<string, unknown>> {
    const phoneNumber = executionContext.getNodeParameter('phoneNumber', itemIndex) as string;
    const campaignType = executionContext.getNodeParameter('campaignType', itemIndex) as string;
    const customerContextStr = executionContext.getNodeParameter('customerContext', itemIndex, '{}') as string;
    const scheduledTime = executionContext.getNodeParameter('scheduledTime', itemIndex, '') as string;

    // Validate phone number format
    if (!phoneNumber.match(/^\+[1-9]\d{1,14}$/)) {
      throw new NodeOperationError(
        executionContext.getNode(),
        'Invalid phone number format. Use international format (e.g., +31612345678)',
        { itemIndex }
      );
    }

    // Parse customer context
    let customerContext;
    try {
      customerContext = JSON.parse(customerContextStr);
    } catch (error) {
      throw new NodeOperationError(
        executionContext.getNode(),
        'Invalid customer context JSON format',
        { itemIndex }
      );
    }

    // Check daily call budget
    const dailyBudget = salonData.settings.voice_agent_settings?.cost_budget_daily_euros || 50;
    const todaysCost = await VoiceAgent.getTodaysVoiceCost(salonData.id);
    
    if (todaysCost >= dailyBudget) {
      throw new NodeOperationError(
        executionContext.getNode(),
        `Daily voice budget of €${dailyBudget} exceeded. Current usage: €${todaysCost.toFixed(2)}`,
        { itemIndex }
      );
    }

    // Call Voice Gateway to initiate call
    const callPayload = {
      salon_id: salonData.id,
      phone_number: phoneNumber,
      campaign_type: campaignType,
      customer_context: customerContext,
      scheduled_time: scheduledTime || null,
    };

    try {
      const response = await executionContext.helpers.httpRequest({
        method: 'POST',
        url: `${voiceGatewayUrl}/calls/initiate`,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.VOICE_GATEWAY_API_KEY || 'test-key-123',
        },
        body: callPayload,
        timeout: 10000,
      });

      return {
        call_initiated: true,
        call_sid: response.call_sid,
        phone_number: phoneNumber,
        campaign_type: campaignType,
        scheduled: !!scheduledTime,
        estimated_cost_euros: 0.5, // Approximate cost per call
        voice_gateway_response: response,
      };

    } catch (error) {
      throw new NodeOperationError(
        executionContext.getNode(),
        `Failed to initiate call via Voice Gateway: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { itemIndex }
      );
    }
  }

  /**
   * Handle missed call processing with spam protection
   */
  private static async handleProcessMissedCall(
    executionContext: IExecuteFunctions,
    itemIndex: number,
    salonData: any,
    voiceGatewayUrl: string
  ): Promise<Record<string, unknown>> {
    const phoneNumber = executionContext.getNodeParameter('missedCallPhone', itemIndex) as string;
    const enableSpamProtection = executionContext.getNodeParameter('enableSpamProtection', itemIndex, true) as boolean;
    const callbackDelayMinutes = executionContext.getNodeParameter('callbackDelayMinutes', itemIndex, 2) as number;

    // Validate phone number
    if (!phoneNumber.match(/^\+[1-9]\d{1,14}$/)) {
      throw new NodeOperationError(
        executionContext.getNode(),
        'Invalid phone number format for missed call processing',
        { itemIndex }
      );
    }

    let lookupResult = { is_safe: true, details: 'Spam protection disabled' };

    // Perform Twilio Lookup for spam protection
    if (enableSpamProtection) {
      try {
        const lookupResponse = await executionContext.helpers.httpRequest({
          method: 'GET',
          url: `https://lookups.twilio.com/v2/PhoneNumbers/${encodeURIComponent(phoneNumber)}?Fields=line_type_intelligence,caller_name`,
          headers: {
            'Authorization': `Basic ${Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')}`,
          },
          timeout: 5000,
        });

        // Analyze lookup results
        const lineType = lookupResponse.line_type_intelligence?.type;
        const errorCode = lookupResponse.line_type_intelligence?.error_code;
        
        lookupResult = {
          is_safe: !errorCode && ['mobile', 'landline'].includes(lineType),
          details: lookupResponse,
          line_type: lineType,
          carrier: lookupResponse.line_type_intelligence?.carrier_name,
        };

        if (!lookupResult.is_safe) {
          return {
            callback_queued: false,
            reason: 'Phone number failed spam protection checks',
            phone_number: phoneNumber,
            lookup_result: lookupResult,
            safety_status: 'blocked',
          };
        }

      } catch (error) {
        logError('Twilio Lookup failed', error as Error, {
          phone_number: phoneNumber,
          salon_id: salonData.id,
        });
        
        // If lookup fails, proceed but log the warning
        lookupResult = {
          is_safe: true, // Fail open for better customer experience
          details: 'Lookup service unavailable',
          warning: 'Could not verify phone number safety',
        };
      }
    }

    // Add to callback queue
    const queueEntry = {
      salon_id: salonData.id,
      phone_number: phoneNumber,
      campaign_type: 'missed_call_callback',
      customer_context: { missed_call: true },
      process_after: new Date(Date.now() + (callbackDelayMinutes * 60 * 1000)).toISOString(),
      twilio_lookup_response: lookupResult.details,
      is_verified_safe: lookupResult.is_safe,
    };

    const dbResult = await executeDatabaseOperation(
      'INSERT INTO callback_queue (salon_id, phone_number, campaign_type, customer_context, process_after, twilio_lookup_response, is_verified_safe) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
      [
        queueEntry.salon_id,
        queueEntry.phone_number,
        queueEntry.campaign_type,
        JSON.stringify(queueEntry.customer_context),
        queueEntry.process_after,
        JSON.stringify(queueEntry.twilio_lookup_response),
        queueEntry.is_verified_safe,
      ]
    );

    return {
      callback_queued: true,
      queue_id: dbResult.data[0]?.id,
      phone_number: phoneNumber,
      callback_scheduled_for: queueEntry.process_after,
      delay_minutes: callbackDelayMinutes,
      spam_protection_enabled: enableSpamProtection,
      lookup_result: lookupResult,
      safety_status: lookupResult.is_safe ? 'verified_safe' : 'blocked',
    };
  }

  /**
   * Handle campaign management operations
   */
  private static async handleManageCampaign(
    executionContext: IExecuteFunctions,
    itemIndex: number,
    salonData: any
  ): Promise<Record<string, unknown>> {
    const campaignAction = executionContext.getNodeParameter('campaignAction', itemIndex) as string;
    const campaignId = executionContext.getNodeParameter('campaignId', itemIndex, '') as string;
    const campaignConfigStr = executionContext.getNodeParameter('campaignConfig', itemIndex, '{}') as string;

    switch (campaignAction) {
      case 'create':
        let campaignConfig;
        try {
          campaignConfig = JSON.parse(campaignConfigStr);
        } catch (error) {
          throw new NodeOperationError(
            executionContext.getNode(),
            'Invalid campaign configuration JSON format',
            { itemIndex }
          );
        }

        const createResult = await executeDatabaseOperation(
          `INSERT INTO voice_agent_campaigns 
           (salon_id, name, campaign_type, status, target_criteria, start_date, created_by) 
           VALUES ($1, $2, $3, $4, $5, $6, $7) 
           RETURNING id, name, campaign_type, status`,
          [
            salonData.id,
            campaignConfig.name || 'New Voice Campaign',
            campaignConfig.campaign_type || 'reactivation',
            'draft',
            JSON.stringify(campaignConfig.target_criteria || {}),
            campaignConfig.start_date || new Date().toISOString(),
            executionContext.execution_id, // Use execution_id as created_by for now
          ]
        );

        return {
          campaign_created: true,
          campaign_id: createResult.data[0]?.id,
          campaign_name: createResult.data[0]?.name,
          campaign_type: createResult.data[0]?.campaign_type,
          status: createResult.data[0]?.status,
        };

      case 'start':
      case 'pause':
      case 'stop':
        if (!campaignId) {
          throw new NodeOperationError(
            executionContext.getNode(),
            'Campaign ID is required for this action',
            { itemIndex }
          );
        }

        const newStatus = campaignAction === 'start' ? 'active' : 
                         campaignAction === 'pause' ? 'paused' : 'completed';

        const updateResult = await executeDatabaseOperation(
          'UPDATE voice_agent_campaigns SET status = $1, updated_at = now() WHERE id = $2 AND salon_id = $3 RETURNING name, status',
          [newStatus, campaignId, salonData.id]
        );

        if (!updateResult.data.length) {
          throw new NodeOperationError(
            executionContext.getNode(),
            'Campaign not found or access denied',
            { itemIndex }
          );
        }

        return {
          campaign_updated: true,
          campaign_id: campaignId,
          action: campaignAction,
          new_status: newStatus,
          campaign_name: updateResult.data[0]?.name,
        };

      case 'status':
        if (!campaignId) {
          throw new NodeOperationError(
            executionContext.getNode(),
            'Campaign ID is required for status check',
            { itemIndex }
          );
        }

        const statusResult = await executeDatabaseOperation(
          `SELECT name, campaign_type, status, total_targets, calls_initiated, 
                  calls_completed, successful_outcomes, total_cost_euros, 
                  created_at, start_date, end_date
           FROM voice_agent_campaigns 
           WHERE id = $1 AND salon_id = $2`,
          [campaignId, salonData.id]
        );

        if (!statusResult.data.length) {
          throw new NodeOperationError(
            executionContext.getNode(),
            'Campaign not found or access denied',
            { itemIndex }
          );
        }

        const campaign = statusResult.data[0];
        return {
          campaign_id: campaignId,
          campaign_status: campaign.status,
          campaign_name: campaign.name,
          campaign_type: campaign.campaign_type,
          performance: {
            total_targets: campaign.total_targets || 0,
            calls_initiated: campaign.calls_initiated || 0,
            calls_completed: campaign.calls_completed || 0,
            successful_outcomes: campaign.successful_outcomes || 0,
            success_rate: campaign.calls_completed > 0 ? 
              (campaign.successful_outcomes / campaign.calls_completed * 100).toFixed(1) : '0.0',
            total_cost_euros: parseFloat(campaign.total_cost_euros || '0'),
          },
          dates: {
            created_at: campaign.created_at,
            start_date: campaign.start_date,
            end_date: campaign.end_date,
          },
        };

      default:
        throw new NodeOperationError(
          executionContext.getNode(),
          `Unsupported campaign action: ${campaignAction}`,
          { itemIndex }
        );
    }
  }

  /**
   * Handle Voice Gateway status check
   */
  private static async handleCheckStatus(
    executionContext: IExecuteFunctions,
    voiceGatewayUrl: string
  ): Promise<Record<string, unknown>> {
    try {
      const response = await executionContext.helpers.httpRequest({
        method: 'GET',
        url: `${voiceGatewayUrl}/health`,
        timeout: 5000,
      });

      return {
        voice_gateway_available: true,
        service_status: 'healthy',
        service_response: response,
        checked_at: new Date().toISOString(),
        active_calls: response.active_calls || 0,
        uptime_seconds: response.uptime || 0,
      };

    } catch (error) {
      return {
        voice_gateway_available: false,
        service_status: 'unavailable',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        checked_at: new Date().toISOString(),
      };
    }
  }

  /**
   * Handle voice analytics retrieval
   */
  private static async handleGetAnalytics(
    executionContext: IExecuteFunctions,
    itemIndex: number,
    salonData: any
  ): Promise<Record<string, unknown>> {
    const analyticsPeriod = executionContext.getNodeParameter('analyticsPeriod', itemIndex) as string;
    const startDate = executionContext.getNodeParameter('startDate', itemIndex, '') as string;
    const endDate = executionContext.getNodeParameter('endDate', itemIndex, '') as string;

    let dateFilter = '';
    let periodLabel = '';

    switch (analyticsPeriod) {
      case 'today':
        dateFilter = "AND created_at >= CURRENT_DATE";
        periodLabel = 'Today';
        break;
      case 'week':
        dateFilter = "AND created_at >= CURRENT_DATE - INTERVAL '7 days'";
        periodLabel = 'Last 7 Days';
        break;
      case 'month':
        dateFilter = "AND created_at >= CURRENT_DATE - INTERVAL '30 days'";
        periodLabel = 'Last 30 Days';
        break;
      case 'custom':
        if (!startDate || !endDate) {
          throw new NodeOperationError(
            executionContext.getNode(),
            'Start date and end date are required for custom analytics period',
            { itemIndex }
          );
        }
        dateFilter = `AND created_at >= '${startDate}' AND created_at <= '${endDate}'`;
        periodLabel = `${startDate} to ${endDate}`;
        break;
    }

    // Get comprehensive voice analytics
    const analyticsResult = await executeDatabaseOperation(
      `SELECT 
         COUNT(*) as total_calls,
         COUNT(*) FILTER (WHERE direction = 'inbound') as inbound_calls,
         COUNT(*) FILTER (WHERE direction = 'outbound') as outbound_calls,
         COUNT(*) FILTER (WHERE call_status = 'completed') as completed_calls,
         COUNT(*) FILTER (WHERE call_status = 'no-answer') as missed_calls,
         AVG(duration_seconds) as avg_duration_seconds,
         SUM(duration_seconds) as total_talk_time_seconds,
         SUM(cost_usd) as total_cost_usd,
         COUNT(*) FILTER (WHERE outcome->>'type' = 'booking_created') as bookings_created,
         COUNT(*) FILTER (WHERE campaign_type = 'reactivation') as reactivation_calls
       FROM call_logs 
       WHERE salon_id = $1 ${dateFilter}`,
      [salonData.id]
    );

    const analytics = analyticsResult.data[0] || {};

    // Calculate performance metrics
    const completionRate = analytics.total_calls > 0 ? 
      (analytics.completed_calls / analytics.total_calls * 100).toFixed(1) : '0.0';
    
    const bookingConversionRate = analytics.completed_calls > 0 ?
      (analytics.bookings_created / analytics.completed_calls * 100).toFixed(1) : '0.0';

    const costPerBookingEuros = analytics.bookings_created > 0 ?
      ((parseFloat(analytics.total_cost_usd || '0') * 0.92) / analytics.bookings_created).toFixed(2) : '0.00';

    return {
      analytics_period: periodLabel,
      period_type: analyticsPeriod,
      salon_id: salonData.id,
      salon_name: salonData.business_name,
      
      call_volume: {
        total_calls: parseInt(analytics.total_calls || '0'),
        inbound_calls: parseInt(analytics.inbound_calls || '0'),
        outbound_calls: parseInt(analytics.outbound_calls || '0'),
        completed_calls: parseInt(analytics.completed_calls || '0'),
        missed_calls: parseInt(analytics.missed_calls || '0'),
      },
      
      performance_metrics: {
        completion_rate_percent: parseFloat(completionRate),
        avg_call_duration_minutes: analytics.avg_duration_seconds ? 
          (analytics.avg_duration_seconds / 60).toFixed(1) : '0.0',
        total_talk_time_hours: analytics.total_talk_time_seconds ?
          (analytics.total_talk_time_seconds / 3600).toFixed(1) : '0.0',
      },
      
      business_outcomes: {
        bookings_created: parseInt(analytics.bookings_created || '0'),
        booking_conversion_rate_percent: parseFloat(bookingConversionRate),
        reactivation_calls: parseInt(analytics.reactivation_calls || '0'),
      },
      
      cost_analysis: {
        total_cost_usd: parseFloat(analytics.total_cost_usd || '0'),
        total_cost_euros: (parseFloat(analytics.total_cost_usd || '0') * 0.92).toFixed(2), // Approximate EUR conversion
        cost_per_call_euros: analytics.total_calls > 0 ?
          ((parseFloat(analytics.total_cost_usd || '0') * 0.92) / analytics.total_calls).toFixed(2) : '0.00',
        cost_per_booking_euros: costPerBookingEuros,
      },
      
      generated_at: new Date().toISOString(),
    };
  }

  /**
   * Get today's voice cost for budget checking
   */
  private static async getTodaysVoiceCost(salonId: string): Promise<number> {
    try {
      const result = await executeDatabaseOperation(
        `SELECT COALESCE(SUM(cost_usd * 0.92), 0) as total_cost_euros 
         FROM call_logs 
         WHERE salon_id = $1 AND created_at >= CURRENT_DATE`,
        [salonId]
      );
      
      return parseFloat(result.data[0]?.total_cost_euros || '0');
    } catch (error) {
      logError('Failed to get today\'s voice cost', error as Error, { salon_id: salonId });
      return 0;
    }
  }
}
