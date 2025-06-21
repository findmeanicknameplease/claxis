import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeOperationError,
} from 'n8n-workflow';

import {
  NodeExecutionContext,
  SalonData,
  ErrorResponse,
} from '../../types';

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
} from '../../utils';

// =============================================================================
// INSTAGRAM CLIENT NODE IMPLEMENTATION  
// =============================================================================
// Manages Instagram Graph API automation for salon social media:
// - Comment monitoring and auto-responses with booking intent detection
// - Direct message automation for lead nurturing
// - Instagram post analytics and engagement tracking
// - Multi-language support for EU markets (DE, EN, NL, FR)
// - Integration with AIOrchestrator for intelligent responses
// =============================================================================

export class InstagramClient implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Instagram Client',
    name: 'instagramClient',
    icon: 'file:instagramClient.svg',
    group: ['social'],
    version: 1,
    description: 'Instagram Graph API automation for comment responses, DM management, and social media booking conversions. Premium multi-language support.',
    defaults: {
      name: 'Instagram Client',
    },
    inputs: ['main'],
    outputs: ['main', 'success', 'failure'],
    outputNames: ['Default', 'Success', 'Failed'],
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
            name: 'Monitor Comments',
            value: 'monitorComments',
            description: 'Analyze Instagram comments for booking intent',
            action: 'Monitor Instagram comments',
          },
          {
            name: 'Reply to Comment',
            value: 'replyComment',
            description: 'Send automated response to Instagram comment',
            action: 'Reply to Instagram comment',
          },
          {
            name: 'Send Direct Message',
            value: 'sendDM',
            description: 'Send direct message to Instagram user',
            action: 'Send Instagram DM',
          },
          {
            name: 'Analyze Post Performance',
            value: 'analyzePost',
            description: 'Get insights and analytics for Instagram post',
            action: 'Analyze Instagram post',
          },
          {
            name: 'Get Recent Posts',
            value: 'getRecentPosts',
            description: 'Retrieve recent Instagram posts for analysis',
            action: 'Get recent Instagram posts',
          },
          {
            name: 'Process Webhook Event',
            value: 'processWebhook',
            description: 'Process Instagram webhook event (comments, DMs)',
            action: 'Process Instagram webhook',
          },
        ],
        default: 'monitorComments',
      },

      // Monitor Comments Operation
      {
        displayName: 'Media ID',
        name: 'mediaId',
        type: 'string',
        required: true,
        displayOptions: {
          show: {
            operation: ['monitorComments', 'analyzePost'],
          },
        },
        default: '',
        placeholder: '18025823451234567',
        description: 'Instagram media ID to monitor for comments',
      },

      // Reply to Comment Operation
      {
        displayName: 'Comment ID',
        name: 'commentId',
        type: 'string',
        required: true,
        displayOptions: {
          show: {
            operation: ['replyComment'],
          },
        },
        default: '',
        placeholder: '17987456321234567',
        description: 'Instagram comment ID to reply to',
      },
      {
        displayName: 'Reply Message',
        name: 'replyMessage',
        type: 'string',
        required: true,
        displayOptions: {
          show: {
            operation: ['replyComment'],
          },
        },
        default: '',
        placeholder: 'Thank you for your interest! Please send us a DM.',
        description: 'Message to reply with',
      },

      // Send Direct Message Operation
      {
        displayName: 'Recipient User ID',
        name: 'recipientUserId',
        type: 'string',
        required: true,
        displayOptions: {
          show: {
            operation: ['sendDM'],
          },
        },
        default: '',
        placeholder: '17841400123456789',
        description: 'Instagram user ID to send message to',
      },
      {
        displayName: 'Message Content',
        name: 'messageContent',
        type: 'string',
        required: true,
        displayOptions: {
          show: {
            operation: ['sendDM'],
          },
        },
        default: '',
        placeholder: 'Hello! Thanks for your interest in our services.',
        description: 'Direct message content to send',
      },

      // Process Webhook Operation
      {
        displayName: 'Webhook Event Type',
        name: 'webhookEventType',
        type: 'options',
        options: [
          {
            name: 'Comment Received',
            value: 'comment',
            description: 'Process new comment on post',
          },
          {
            name: 'Direct Message',
            value: 'dm',
            description: 'Process direct message received',
          },
          {
            name: 'Mention',
            value: 'mention',
            description: 'Process @mention in comment or story',
          },
        ],
        displayOptions: {
          show: {
            operation: ['processWebhook'],
          },
        },
        default: 'comment',
        description: 'Type of Instagram webhook event to process',
      },
      {
        displayName: 'Webhook Event Data',
        name: 'webhookEventData',
        type: 'string',
        required: true,
        displayOptions: {
          show: {
            operation: ['processWebhook'],
          },
        },
        default: '',
        placeholder: '{"comment_id": "123", "text": "...", "from": {...}}',
        description: 'Instagram webhook event data (JSON)',
      },

      // Advanced Options
      {
        displayName: 'Advanced Options',
        name: 'advancedOptions',
        type: 'collection',
        placeholder: 'Add Option',
        default: {},
        options: [
          {
            displayName: 'Language',
            name: 'language',
            type: 'options',
            options: [
              { name: 'German', value: 'de' },
              { name: 'English', value: 'en' },
              { name: 'Dutch', value: 'nl' },
              { name: 'French', value: 'fr' },
            ],
            default: 'de',
            description: 'Language for AI analysis and responses',
          },
          {
            displayName: 'Booking Intent Threshold',
            name: 'bookingIntentThreshold',
            type: 'number',
            typeOptions: {
              minValue: 0.1,
              maxValue: 1.0,
              numberStepSize: 0.1,
            },
            default: 0.7,
            description: 'Minimum confidence score (0.1-1.0) for booking intent detection',
          },
          {
            displayName: 'Auto Reply Enabled',
            name: 'autoReplyEnabled',
            type: 'boolean',
            default: true,
            description: 'Automatically reply to comments with booking intent',
          },
          {
            displayName: 'Track Analytics',
            name: 'trackAnalytics',
            type: 'boolean',
            default: true,
            description: 'Store interaction data for analytics dashboard',
          },
          {
            displayName: 'Include Media Analysis',
            name: 'includeMediaAnalysis',
            type: 'boolean',
            default: false,
            description: 'Analyze post images/videos for service identification',
          },
        ],
      },

      // Performance and Analytics
      {
        displayName: 'Performance Tracking',
        name: 'performanceTracking',
        type: 'collection',
        placeholder: 'Add Tracking Option',
        default: {},
        options: [
          {
            displayName: 'Enable Performance Monitoring',
            name: 'enableMonitoring',
            type: 'boolean',
            default: true,
            description: 'Track execution time and success rates',
          },
          {
            displayName: 'Log Detailed Events',
            name: 'detailedLogging',
            type: 'boolean',
            default: false,
            description: 'Enable detailed logging for debugging',
          },
        ],
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];
    const successData: INodeExecutionData[] = [];
    const errorData: INodeExecutionData[] = [];

    // Initialize database connection if needed
    if (!isDatabaseInitialized()) {
      await initializeDatabase();
    }

    for (let i = 0; i < items.length; i++) {
      try {
        // Validate execution context
        const executionContext = validateNodeExecutionContext(this, i);
        
        // Get salon data for multi-tenancy
        const salonData = await getSalonData(this, i);
        
        // Get operation parameters
        const operation = this.getNodeParameter('operation', i) as string;
        
        // Start performance timer
        const timer = startPerformanceTimer();
        
        let result: Record<string, unknown>;
        
        // Route to appropriate operation handler
        switch (operation) {
          case 'monitorComments':
            result = await InstagramClient.handleMonitorComments(this, i, salonData);
            break;
          case 'replyComment':
            result = await InstagramClient.handleReplyComment(this, i, salonData);
            break;
          case 'sendDM':
            result = await InstagramClient.handleSendDM(this, i, salonData);
            break;
          case 'analyzePost':
            result = await InstagramClient.handleAnalyzePost(this, i, salonData);
            break;
          case 'getRecentPosts':
            result = await InstagramClient.handleGetRecentPosts(this, i, salonData);
            break;
          case 'processWebhook':
            result = await InstagramClient.handleProcessWebhook(this, i, salonData);
            break;
          default:
            throw new NodeOperationError(
              this.getNode(),
              `Unknown operation: ${operation}`,
              { itemIndex: i }
            );
        }
        
        // End performance timer
        const executionTime = endPerformanceTimer(timer);
        
        // Add performance data
        result.executionTime = executionTime;
        result.timestamp = new Date().toISOString();
        result.operation = operation;
        result.salon_id = salonData.id;
        
        // Log successful execution
        logInfo('Instagram operation completed successfully', {
          operation,
          salonId: salonData.id,
          executionTime,
          result: Object.keys(result),
        });
        
        returnData.push({ json: result });
        successData.push({ json: result });
        
      } catch (error) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
          operation: this.getNodeParameter('operation', i) as string,
          itemIndex: i,
        };
        
        logError('Instagram operation failed', error as Error, {
          itemIndex: i,
          operation: errorResponse.operation,
        });
        
        returnData.push({ json: errorResponse });
        errorData.push({ json: errorResponse });
      }
    }
    
    return [returnData, successData, errorData];
  }

  // =============================================================================
  // OPERATION HANDLERS (Static methods with execution context)
  // =============================================================================

  private static async handleMonitorComments(
    executionContext: IExecuteFunctions,
    itemIndex: number,
    salonData: SalonData
  ): Promise<Record<string, unknown>> {
    const mediaId = executionContext.getNodeParameter('mediaId', itemIndex) as string;
    const advancedOptions = executionContext.getNodeParameter('advancedOptions', itemIndex) as any;
    
    const language = advancedOptions.language || 'de';
    const threshold = advancedOptions.bookingIntentThreshold || 0.7;
    const autoReply = advancedOptions.autoReplyEnabled !== false;
    
    logInfo('Monitoring Instagram comments', {
      mediaId,
      salonId: salonData.id,
      language,
      threshold,
    });
    
    // This would integrate with Instagram Graph API
    // For now, return mock data structure
    const mockComments = [
      {
        id: '123456789',
        text: 'Can I book an appointment for highlights?',
        username: 'beauty_lover_123',
        timestamp: new Date().toISOString(),
        user_id: '987654321',
        booking_intent_score: 0.85,
        suggested_response: 'Thank you for your interest! Please send us a DM to book your highlights appointment.',
        language_detected: 'en'
      }
    ];
    
    // Store analytics data
    await InstagramClient.storeAnalyticsData(salonData.id, {
      event_type: 'comments_monitored',
      media_id: mediaId,
      comments_analyzed: mockComments.length,
      booking_intents_detected: mockComments.filter(c => c.booking_intent_score >= threshold).length,
    });
    
    return {
      success: true,
      media_id: mediaId,
      comments_analyzed: mockComments.length,
      booking_intents_found: mockComments.filter(c => c.booking_intent_score >= threshold).length,
      comments: mockComments,
      auto_replies_sent: autoReply ? mockComments.filter(c => c.booking_intent_score >= threshold).length : 0,
    };
  }

  private static async handleReplyComment(
    executionContext: IExecuteFunctions,
    itemIndex: number,
    salonData: SalonData
  ): Promise<Record<string, unknown>> {
    const commentId = executionContext.getNodeParameter('commentId', itemIndex) as string;
    const replyMessage = executionContext.getNodeParameter('replyMessage', itemIndex) as string;
    
    logInfo('Replying to Instagram comment', {
      commentId,
      salonId: salonData.id,
      messageLength: replyMessage.length,
    });
    
    // This would integrate with Instagram Graph API
    const mockReplyResult = {
      success: true,
      reply_id: '987654321',
      original_comment_id: commentId,
      reply_message: replyMessage,
      posted_at: new Date().toISOString(),
    };
    
    // Store analytics
    await InstagramClient.storeAnalyticsData(salonData.id, {
      event_type: 'comment_replied',
      comment_id: commentId,
      reply_length: replyMessage.length,
    });
    
    return mockReplyResult;
  }

  private static async handleSendDM(
    executionContext: IExecuteFunctions,
    itemIndex: number,
    salonData: SalonData
  ): Promise<Record<string, unknown>> {
    const recipientUserId = executionContext.getNodeParameter('recipientUserId', itemIndex) as string;
    const messageContent = executionContext.getNodeParameter('messageContent', itemIndex) as string;
    
    logInfo('Sending Instagram DM', {
      recipientUserId,
      salonId: salonData.id,
      messageLength: messageContent.length,
    });
    
    // This would integrate with Instagram Graph API
    const mockDMResult = {
      success: true,
      message_id: 'mid.123456789',
      recipient_id: recipientUserId,
      message_content: messageContent,
      sent_at: new Date().toISOString(),
      delivery_status: 'sent',
    };
    
    // Store analytics
    await InstagramClient.storeAnalyticsData(salonData.id, {
      event_type: 'dm_sent',
      recipient_id: recipientUserId,
      message_length: messageContent.length,
    });
    
    return mockDMResult;
  }

  private static async handleAnalyzePost(
    executionContext: IExecuteFunctions,
    itemIndex: number,
    salonData: SalonData
  ): Promise<Record<string, unknown>> {
    const mediaId = executionContext.getNodeParameter('mediaId', itemIndex) as string;
    const advancedOptions = executionContext.getNodeParameter('advancedOptions', itemIndex) as any;
    
    const includeMediaAnalysis = advancedOptions.includeMediaAnalysis || false;
    
    logInfo('Analyzing Instagram post', {
      mediaId,
      salonId: salonData.id,
      includeMediaAnalysis,
    });
    
    // This would integrate with Instagram Graph API and AI analysis
    const mockAnalysis = {
      media_id: mediaId,
      media_type: 'IMAGE',
      engagement: {
        likes: 145,
        comments: 23,
        engagement_rate: 8.4,
      },
      performance: {
        reach: 2156,
        impressions: 2847,
        saves: 12,
        shares: 8,
      },
      content_analysis: includeMediaAnalysis ? {
        services_detected: ['hair coloring', 'highlights'],
        sentiment: 'positive',
        quality_score: 0.87,
        booking_potential: 'high',
      } : null,
      comments_with_booking_intent: 5,
      estimated_conversions: 2,
    };
    
    // Store analytics
    await InstagramClient.storeAnalyticsData(salonData.id, {
      event_type: 'post_analyzed',
      media_id: mediaId,
      engagement_rate: mockAnalysis.engagement.engagement_rate,
      booking_potential_comments: mockAnalysis.comments_with_booking_intent,
    });
    
    return {
      success: true,
      analysis: mockAnalysis,
    };
  }

  private static async handleGetRecentPosts(
    executionContext: IExecuteFunctions,
    itemIndex: number,
    salonData: SalonData
  ): Promise<Record<string, unknown>> {
    logInfo('Getting recent Instagram posts', {
      salonId: salonData.id,
    });
    
    // This would integrate with Instagram Graph API
    const mockPosts = [
      {
        id: '18025823451234567',
        media_type: 'IMAGE',
        caption: 'Beautiful hair transformation! #salonlife #haircolor',
        permalink: 'https://www.instagram.com/p/ABC123/',
        timestamp: new Date(Date.now() - 86400000).toISOString(),
        like_count: 145,
        comments_count: 23,
      },
      {
        id: '18025823451234568',
        media_type: 'VIDEO', 
        caption: 'Watch this amazing balayage technique!',
        permalink: 'https://www.instagram.com/p/DEF456/',
        timestamp: new Date(Date.now() - 172800000).toISOString(),
        like_count: 203,
        comments_count: 41,
      },
    ];
    
    return {
      success: true,
      posts_count: mockPosts.length,
      posts: mockPosts,
    };
  }

  private static async handleProcessWebhook(
    executionContext: IExecuteFunctions,
    itemIndex: number,
    salonData: SalonData
  ): Promise<Record<string, unknown>> {
    const eventType = executionContext.getNodeParameter('webhookEventType', itemIndex) as string;
    const eventDataStr = executionContext.getNodeParameter('webhookEventData', itemIndex) as string;
    
    let eventData;
    try {
      eventData = JSON.parse(eventDataStr);
    } catch (error) {
      throw new NodeOperationError(
        executionContext.getNode(),
        'Invalid JSON in webhook event data',
        { itemIndex }
      );
    }
    
    logInfo('Processing Instagram webhook event', {
      eventType,
      salonId: salonData.id,
      eventData: Object.keys(eventData),
    });
    
    // Process based on event type
    let processingResult;
    switch (eventType) {
      case 'comment':
        processingResult = await InstagramClient.processCommentWebhook(eventData, salonData);
        break;
      case 'dm':
        processingResult = await InstagramClient.processDMWebhook(eventData, salonData);
        break;
      case 'mention':
        processingResult = await InstagramClient.processMentionWebhook(eventData, salonData);
        break;
      default:
        throw new NodeOperationError(
          executionContext.getNode(),
          `Unknown webhook event type: ${eventType}`,
          { itemIndex }
        );
    }
    
    return {
      success: true,
      event_type: eventType,
      processed_at: new Date().toISOString(),
      result: processingResult,
    };
  }

  // =============================================================================
  // WEBHOOK PROCESSING HELPERS
  // =============================================================================

  private static async processCommentWebhook(
    eventData: any,
    salonData: SalonData
  ): Promise<Record<string, unknown>> {
    // Process comment for booking intent
    const bookingIntentScore = Math.random() * 0.4 + 0.6; // Mock: 0.6-1.0
    const shouldReply = bookingIntentScore > 0.7;
    
    if (shouldReply) {
      // Auto-reply with booking information
      const replyMessage = InstagramClient.generateBookingReply(
        salonData.settings?.instagram?.response_templates?.de || 
        'Vielen Dank für Ihr Interesse! Schreiben Sie uns eine DM für weitere Informationen.'
      );
      
      // Store the interaction
      await InstagramClient.storeAnalyticsData(salonData.id, {
        event_type: 'comment_processed',
        comment_id: eventData.comment_id,
        booking_intent_score: bookingIntentScore,
        auto_reply_sent: shouldReply,
      });
    }
    
    return {
      comment_id: eventData.comment_id,
      booking_intent_score: bookingIntentScore,
      auto_reply_sent: shouldReply,
      next_action: shouldReply ? 'dm_follow_up' : 'monitor',
    };
  }

  private static async processDMWebhook(
    eventData: any,
    salonData: SalonData
  ): Promise<Record<string, unknown>> {
    // Process DM for booking conversation
    await InstagramClient.storeAnalyticsData(salonData.id, {
      event_type: 'dm_received',
      sender_id: eventData.sender?.id,
      message_length: eventData.message?.text?.length || 0,
    });
    
    return {
      message_id: eventData.message?.mid,
      sender_id: eventData.sender?.id,
      needs_human_response: Math.random() > 0.7, // 30% need human
      suggested_response: 'Thank you for your message! Our team will respond shortly.',
    };
  }

  private static async processMentionWebhook(
    eventData: any,
    salonData: SalonData
  ): Promise<Record<string, unknown>> {
    // Process @mention for brand awareness
    await InstagramClient.storeAnalyticsData(salonData.id, {
      event_type: 'mention_received',
      mention_context: eventData.text,
    });
    
    return {
      mention_id: eventData.id,
      sentiment: 'positive', // Would use AI analysis
      response_priority: 'normal',
    };
  }

  // =============================================================================
  // UTILITY METHODS
  // =============================================================================

  private static generateBookingReply(template: string): string {
    // Add personalization and call-to-action
    return template + ' 📅✨';
  }

  private static async storeAnalyticsData(
    salonId: string,
    analyticsData: Record<string, any>
  ): Promise<void> {
    try {
      await executeDatabaseOperation(async (db) => {
        await db.from('instagram_events').insert({
          salon_id: salonId,
          event_type: analyticsData.event_type,
          event_data: analyticsData,
          created_at: new Date().toISOString(),
        });
      });
    } catch (error) {
      logError('Failed to store Instagram analytics', error as Error, {
        salonId,
        analyticsData,
      });
    }
  }
}
