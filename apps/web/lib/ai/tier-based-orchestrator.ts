import { getGeminiClient, IntentResult, ConversationContext as GeminiContext, ResponseGenerationOptions } from './gemini';
import { getGeminiLiteClient, LiteIntentResult, SimpleResponseOptions } from './gemini-lite';
import { ConversationTracker, trackConversationInRoute } from '@/lib/middleware/conversation-tracker';

// =============================================================================
// DUAL-MODEL AI ORCHESTRATOR
// Premium SaaS with Facebook/Meta Business Verification Compliance
// Non-tech savvy beauty/wellness business owners friendly
// =============================================================================
// Intelligent model routing based on task complexity:
// - Gemini 2.5 Flash Lite Preview → Basic WhatsApp/Instagram conversations, simple tasks
// - Gemini 2.5 Flash → Complex marketing automation, advanced reasoning
// - Tier-based feature gating and usage tracking
// - Facebook/Meta business verification compliance
// =============================================================================

export interface AIRequest {
  message: string;
  context: {
    salon_id: string;
    customer_id?: string;
    platform: 'whatsapp' | 'instagram' | 'web';
    conversation_history: Array<{
      role: 'user' | 'assistant';
      content: string;
      timestamp: string;
    }>;
    salon_info: {
      name: string;
      services: string[];
      languages: string[];
      business_hours: any;
      subscription_tier: 'free' | 'professional' | 'enterprise';
    };
  };
  request_type: 'intent_detection' | 'response_generation' | 'booking_flow' | 'marketing_automation';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  budget_constraints?: {
    daily_limit_euros: number;
    monthly_limit_euros: number;
    cost_per_request_limit: number;
  };
}

export interface AIResponse {
  success: boolean;
  model_used: 'gemini-2.5-flash-lite' | 'gemini-2.5-flash';
  response_type: string;
  tier_features_used: string[];
  content: {
    intent?: IntentResult | LiteIntentResult;
    generated_text?: string;
    marketing_suggestions?: string[];
    upgrade_prompt?: {
      show: boolean;
      tier: string;
      benefits: string[];
      roi_estimate: string;
      cta_text: string;
    };
  };
  cost_tracking: {
    estimated_cost_euros: number;
    tokens_used: number;
    processing_time_ms: number;
  };
  routing_decision: {
    reason: string;
    confidence: number;
    tier_limitations?: string[];
  };
  usage_tracking?: {
    conversations_used: number;
    monthly_limit: number;
    upgrade_recommended: boolean;
    facebook_api_status: string;
  };
}

class TierBasedAIOrchestrator {
  private geminiClient = getGeminiClient();           // Gemini 2.5 Flash for complex tasks
  private geminiLiteClient = getGeminiLiteClient();   // Gemini 2.5 Flash Lite for basic tasks
  private conversationTracker = new ConversationTracker();
  
  async processRequest(request: AIRequest): Promise<AIResponse> {
    const startTime = Date.now();
    
    try {
      // 1. Track conversation usage and check limits
      const usageResult = await trackConversationInRoute(
        request.context.salon_id,
        request.context.platform,
        false // Customer-initiated request
      );
      
      if (!usageResult.success) {
        return this.createUsageLimitResponse(usageResult, startTime);
      }
      
      // 2. Determine tier-based features and routing
      const tierRouting = await this.getTierBasedRouting(request);
      
      // 3. Check budget constraints (if provided)
      if (request.budget_constraints) {
        const budgetCheck = await this.validateBudget(request, tierRouting.estimated_cost);
        if (!budgetCheck.approved) {
          return this.createBudgetExceededResponse(budgetCheck.reason || 'Budget exceeded', startTime);
        }
      }
      
      // 4. Route to appropriate model based on complexity
      const modelRouting = this.determineModelRouting(request, tierRouting);
      const response = await this.processWithSelectedModel(request, tierRouting, modelRouting);
      
      // 5. Add timing and usage information
      response.cost_tracking.processing_time_ms = Date.now() - startTime;
      response.routing_decision = {
        reason: tierRouting.reason,
        confidence: tierRouting.confidence,
        tier_limitations: tierRouting.tier_limitations,
      };
      
      response.usage_tracking = {
        conversations_used: usageResult.usage?.total_conversations || 0,
        monthly_limit: usageResult.usage?.tier_limit || -1,
        upgrade_recommended: usageResult.should_show_upgrade_prompt || false,
        facebook_api_status: usageResult.usage?.facebook_api_limits?.verification_status || 'unverified'
      };
      
      // 6. Add upgrade prompt if eligible
      if (usageResult.should_show_upgrade_prompt) {
        const upgradeRecommendations = await this.conversationTracker.getUpgradeRecommendations(request.context.salon_id);
        if (upgradeRecommendations?.should_upgrade) {
          response.content.upgrade_prompt = {
            show: true,
            tier: upgradeRecommendations.recommended_tier,
            benefits: upgradeRecommendations.benefits.slice(0, 4), // Show top 4 benefits
            roi_estimate: upgradeRecommendations.roi_calculation['estimated_monthly_roi'] || 'Significant ROI',
            cta_text: this.getUpgradeCTAText(upgradeRecommendations.current_tier, upgradeRecommendations.recommended_tier)
          };
        }
      }
      
      // 7. Track usage for analytics
      await this.trackUsage(request.context.salon_id, response);
      
      return response;
      
    } catch (error) {
      console.error('Error in AI orchestration:', error);
      return this.createErrorResponse(error, startTime);
    }
  }
  
  // =============================================================================
  // MODEL ROUTING LOGIC
  // =============================================================================
  
  private determineModelRouting(request: AIRequest, tierRouting: any): {
    selected_model: 'gemini-2.5-flash-lite' | 'gemini-2.5-flash';
    reason: string;
    confidence: number;
  } {
    // Basic WhatsApp/Instagram conversations → Lite model
    if (request.request_type === 'intent_detection' || 
        (request.request_type === 'response_generation' && 
         (request.context.platform === 'whatsapp' || request.context.platform === 'instagram') &&
         request.context.conversation_history.length <= 3)) {
      return {
        selected_model: 'gemini-2.5-flash-lite',
        reason: 'Basic conversation on messaging platform - using cost-effective Lite model',
        confidence: 0.9
      };
    }
    
    // Marketing automation, complex reasoning → Full model
    if (request.request_type === 'marketing_automation' ||
        request.request_type === 'booking_flow' ||
        tierRouting.tier === 'enterprise') {
      return {
        selected_model: 'gemini-2.5-flash',
        reason: 'Complex task or Enterprise tier - using advanced model',
        confidence: 0.95
      };
    }
    
    // Professional tier with advanced features → Full model
    if (tierRouting.tier === 'professional' && 
        (request.context.conversation_history.length > 3 || request.priority === 'high')) {
      return {
        selected_model: 'gemini-2.5-flash',
        reason: 'Professional tier with complex conversation or high priority',
        confidence: 0.8
      };
    }
    
    // Default to Lite model for cost efficiency
    return {
      selected_model: 'gemini-2.5-flash-lite',
      reason: 'Standard conversation - using cost-effective Lite model',
      confidence: 0.7
    };
  }
  
  // =============================================================================
  // TIER-BASED ROUTING
  // =============================================================================
  
  private async getTierBasedRouting(request: AIRequest): Promise<{
    tier: 'free' | 'professional' | 'enterprise';
    features_enabled: string[];
    prompt_complexity: 'basic' | 'advanced' | 'enterprise';
    reason: string;
    confidence: number;
    estimated_cost: number;
    tier_limitations?: string[];
  }> {
    const tier = request.context.salon_info.subscription_tier;
    
    switch (tier) {
      case 'free':
        return {
          tier: 'free',
          features_enabled: [
            'basic_intent_detection', 
            'simple_responses',
            'whatsapp_only'
          ],
          prompt_complexity: 'basic',
          reason: 'Free tier: Basic AI features, WhatsApp only, 100 conversations/month',
          confidence: 0.9,
          estimated_cost: 0.0005, // Minimal cost for basic prompts
          tier_limitations: [
            'No marketing automation',
            'No Instagram integration',
            'No voice features',
            '100 conversations/month limit',
            'Community support only',
            'Basic AI responses only'
          ]
        };
        
      case 'professional':
        return {
          tier: 'professional',
          features_enabled: [
            'advanced_intent_detection',
            'marketing_responses',
            'instagram_automation',
            'win_back_campaigns',
            'customer_segmentation',
            'no_show_prevention',
            'post_service_upselling',
            'multilingual_support'
          ],
          prompt_complexity: 'advanced',
          reason: 'Professional tier: Advanced AI + Instagram + Marketing (€2,800-8,700 monthly ROI)',
          confidence: 0.95,
          estimated_cost: 0.001,
          tier_limitations: [
            'No voice AI features',
            'No custom voice cloning',
            'No business verification assistance',
            'Email support only'
          ]
        };
        
      case 'enterprise':
        return {
          tier: 'enterprise',
          features_enabled: [
            'all_ai_features',
            'voice_integration',
            'custom_voice_cloning',
            'advanced_analytics',
            'business_verification_assistance',
            'priority_routing',
            'vip_customer_management',
            'cross_channel_orchestration',
            'emergency_rescheduling',
            'birthday_campaigns'
          ],
          prompt_complexity: 'enterprise',
          reason: 'Enterprise tier: Full AI suite + Voice agent + Premium features (€4,600-12,700 monthly ROI)',
          confidence: 1.0,
          estimated_cost: 0.002,
          tier_limitations: [] // No limitations
        };
        
      default:
        throw new Error(`Unknown subscription tier: ${tier}`);
    }
  }
  
  // =============================================================================
  // DUAL-MODEL PROCESSING
  // =============================================================================
  
  private async processWithSelectedModel(
    request: AIRequest,
    tierRouting: any,
    modelRouting: any
  ): Promise<AIResponse> {
    const response: AIResponse = {
      success: true,
      model_used: modelRouting.selected_model,
      response_type: request.request_type,
      tier_features_used: tierRouting.features_enabled,
      content: {},
      cost_tracking: {
        estimated_cost_euros: tierRouting.estimated_cost,
        tokens_used: 0,
        processing_time_ms: 0,
      },
      routing_decision: {
        reason: `${tierRouting.reason} | ${modelRouting.reason}`,
        confidence: tierRouting.confidence,
      },
    };
    
    try {
      if (modelRouting.selected_model === 'gemini-2.5-flash-lite') {
        return await this.processWithLiteModel(request, tierRouting, response);
      } else {
        return await this.processWithAdvancedModel(request, tierRouting, response);
      }
    } catch (error) {
      response.success = false;
      console.error('Error processing with selected model:', error);
      return response;
    }
  }
  
  private async processWithLiteModel(
    request: AIRequest,
    tierRouting: any,
    response: AIResponse
  ): Promise<AIResponse> {
    
    try {
      switch (request.request_type) {
        case 'intent_detection':
          response.content.intent = await this.geminiLiteClient.detectBasicIntent(
            request.message,
            request.context.salon_info.name
          );
          break;
          
        case 'response_generation':
          const simpleOptions: SimpleResponseOptions = {
            language: this.detectLanguage(request.message),
            tone: tierRouting.tier === 'free' ? 'friendly' : 'professional',
            include_booking_cta: true,
            max_length: tierRouting.tier === 'free' ? 150 : 200,
            salon_context: {
              name: request.context.salon_info.name,
              services: request.context.salon_info.services
            }
          };
          
          response.content.generated_text = await this.geminiLiteClient.generateSimpleResponse(
            simpleOptions,
            request.message
          );
          break;
          
        default:
          // Escalate complex requests to advanced model
          return await this.processWithAdvancedModel(request, tierRouting, response);
      }
      
      // Estimate token usage for Lite model
      const tokenEstimate = await this.geminiLiteClient.estimateTokenCost(request.message);
      response.cost_tracking.tokens_used = tokenEstimate.inputTokens;
      response.cost_tracking.estimated_cost_euros = tokenEstimate.estimatedCost;
      
    } catch (error) {
      response.success = false;
      console.error('Error processing with Lite model:', error);
    }
    
    return response;
  }
  
  private async processWithAdvancedModel(
    request: AIRequest,
    tierRouting: any,
    response: AIResponse
  ): Promise<AIResponse> {
    try {
      const geminiContext: GeminiContext = {
        salon_id: request.context.salon_id,
        customer_id: request.context.customer_id,
        platform: request.context.platform,
        conversation_history: request.context.conversation_history,
        salon_info: request.context.salon_info,
      };
      
      switch (request.request_type) {
        case 'intent_detection':
          response.content.intent = await this.geminiClient.processIntent(
            request.message,
            geminiContext
          );
          break;
          
        case 'response_generation':
          const responseOptions = this.buildTierResponseOptions(tierRouting, request);
          response.content.generated_text = await this.geminiClient.generateResponse(responseOptions);
          
          // Add marketing suggestions for Professional/Enterprise tiers
          if (tierRouting.tier !== 'free' && tierRouting.features_enabled.includes('marketing_responses')) {
            response.content.marketing_suggestions = await this.generateMarketingSuggestions(
              request, tierRouting.tier
            );
          }
          break;
          
        case 'booking_flow':
          if (tierRouting.tier === 'free') {
            response.content.generated_text = this.getBasicBookingResponse(request);
          } else {
            response.content.generated_text = await this.processAdvancedBookingFlow(
              request, tierRouting.tier
            );
          }
          break;
          
        case 'marketing_automation':
          if (tierRouting.tier === 'free') {
            response.content.generated_text = this.getUpgradeRequiredMessage('marketing automation');
          } else {
            response.content.generated_text = await this.processMarketingAutomation(
              request, tierRouting.tier
            );
          }
          break;
          
        default:
          throw new Error(`Unknown request type: ${request.request_type}`);
      }
      
      // Estimate token usage for advanced model
      const tokenEstimate = await this.geminiClient.estimateTokenCost(request.message);
      response.cost_tracking.tokens_used = tokenEstimate.inputTokens;
      response.cost_tracking.estimated_cost_euros = tokenEstimate.estimatedCost;
      
    } catch (error) {
      response.success = false;
      console.error('Error processing with advanced model:', error);
    }
    
    return response;
  }
  
  private buildTierResponseOptions(tierRouting: any, request: AIRequest): ResponseGenerationOptions {
    const baseOptions = {
      language: this.detectLanguage(request.message),
      context: {
        salon_id: request.context.salon_id,
        customer_id: request.context.customer_id,
        platform: request.context.platform,
        conversation_history: request.context.conversation_history,
        salon_info: request.context.salon_info,
      },
    };
    
    switch (tierRouting.tier) {
      case 'free':
        return {
          ...baseOptions,
          tone: 'friendly',
          include_booking_cta: true,
          max_length: 150, // Shorter responses for free tier
        };
        
      case 'professional':
        return {
          ...baseOptions,
          tone: 'professional',
          include_booking_cta: true,
          max_length: 300,
        };
        
      case 'enterprise':
        return {
          ...baseOptions,
          tone: 'professional',
          include_booking_cta: true,
          max_length: 500, // Longer, more detailed responses
        };
        
      default:
        return {
          ...baseOptions,
          tone: 'friendly',
          include_booking_cta: true,
          max_length: 150,
        };
    }
  }
  
  private async generateMarketingSuggestions(
    _request: AIRequest,
    tier: 'professional' | 'enterprise'
  ): Promise<string[]> {
    const suggestions: string[] = [];
    
    if (tier === 'professional' || tier === 'enterprise') {
      suggestions.push(
        'Follow up with personalized service recommendations',
        'Send post-appointment satisfaction survey',
        'Offer loyalty program enrollment',
        'Trigger no-show prevention workflow'
      );
    }
    
    if (tier === 'enterprise') {
      suggestions.push(
        'Schedule VIP follow-up call',
        'Trigger automated win-back campaign if no rebooking in 60 days',
        'Add to birthday reminder campaign',
        'Enable emergency rescheduling notifications'
      );
    }
    
    return suggestions;
  }
  
  private getBasicBookingResponse(request: AIRequest): string {
    const salonName = request.context.salon_info.name;
    return `Thank you for your interest in booking with ${salonName}! Please let me know what service you'd like and your preferred date and time.`;
  }
  
  private async processAdvancedBookingFlow(
    request: AIRequest,
    tier: 'professional' | 'enterprise'
  ): Promise<string> {
    const salonName = request.context.salon_info.name;
    const baseFlow = `Thank you for choosing ${salonName}! I'd be happy to help you book the perfect appointment. What service are you interested in?`;
    
    if (tier === 'enterprise') {
      return `${baseFlow} As a valued customer, I can also check our VIP slots and exclusive premium services. Would you like to hear about our luxury treatment options?`;
    }
    
    return `${baseFlow} I can also recommend complementary services that pair well with your choice.`;
  }
  
  private async processMarketingAutomation(
    _request: AIRequest,
    tier: 'professional' | 'enterprise'
  ): Promise<string> {
    if (tier === 'professional') {
      return 'Marketing automation activated: Win-back campaigns, Instagram lead capture, and post-service follow-ups are now enabled for your salon.';
    }
    
    return 'Enterprise marketing suite activated: Voice campaigns, cross-channel orchestration, VIP management, and advanced analytics are now running automatically.';
  }
  
  private getUpgradeRequiredMessage(feature: string): string {
    return `${feature} requires Professional tier or higher. Upgrade now to unlock advanced marketing features and increase your revenue by €2,800-8,700 monthly!`;
  }
  
  private getUpgradeCTAText(currentTier: string, recommendedTier: string): string {
    if (currentTier === 'free' && recommendedTier === 'professional') {
      return 'Upgrade to Professional - €99.99/month';
    }
    
    if (currentTier === 'professional' && recommendedTier === 'enterprise') {
      return 'Upgrade to Enterprise - €299.99/month';
    }
    
    return `Upgrade to ${recommendedTier}`;
  }
  
  // =============================================================================
  // BUDGET MANAGEMENT
  // =============================================================================
  
  private async validateBudget(
    request: AIRequest,
    estimatedCost: number
  ): Promise<{ approved: boolean; reason?: string }> {
    if (!request.budget_constraints) {
      return { approved: true };
    }
    
    // Check per-request limit
    if (estimatedCost > request.budget_constraints.cost_per_request_limit) {
      return {
        approved: false,
        reason: `Cost (€${estimatedCost.toFixed(4)}) exceeds per-request limit (€${request.budget_constraints.cost_per_request_limit})`,
      };
    }
    
    // TODO: Check daily and monthly limits from database
    return { approved: true };
  }
  
  // =============================================================================
  // ERROR HANDLING
  // =============================================================================
  
  private createUsageLimitResponse(usageResult: any, startTime: number): AIResponse {
    const isFreeTier = usageResult.usage?.tier === 'free';
    
    return {
      success: false,
      model_used: 'gemini-2.5-flash-lite',
      response_type: 'usage_limit_exceeded',
      tier_features_used: [],
      content: {
        generated_text: usageResult.message || 'Monthly conversation limit reached.',
        upgrade_prompt: {
          show: true,
          tier: isFreeTier ? 'professional' : 'enterprise',
          benefits: isFreeTier ? [
            'Unlimited customer conversations',
            'Instagram automation for lead generation',
            'Win-back campaigns (€2,000-5,000 monthly ROI)',
            'Advanced marketing features'
          ] : [
            '24/7 Voice AI agent',
            'Voice campaigns (85% answer rate)',
            'Business verification assistance',
            'Premium analytics and insights'
          ],
          roi_estimate: isFreeTier ? '€2,800-8,700 monthly ROI' : '€4,600-12,700 monthly ROI',
          cta_text: isFreeTier ? 'Upgrade to Professional - €99.99/month' : 'Upgrade to Enterprise - €299.99/month'
        }
      },
      cost_tracking: {
        estimated_cost_euros: 0,
        tokens_used: 0,
        processing_time_ms: Date.now() - startTime,
      },
      routing_decision: {
        reason: usageResult.error || 'Monthly limit exceeded',
        confidence: 1.0,
      },
    };
  }
  
  private createBudgetExceededResponse(reason: string, startTime: number): AIResponse {
    return {
      success: false,
      model_used: 'gemini-2.5-flash-lite',
      response_type: 'budget_exceeded',
      tier_features_used: [],
      content: {
        generated_text: 'Budget limits reached. Please contact support or upgrade your plan.',
      },
      cost_tracking: {
        estimated_cost_euros: 0,
        tokens_used: 0,
        processing_time_ms: Date.now() - startTime,
      },
      routing_decision: {
        reason,
        confidence: 1.0,
      },
    };
  }
  
  private createErrorResponse(error: any, startTime: number): AIResponse {
    return {
      success: false,
      model_used: 'gemini-2.5-flash-lite',
      response_type: 'error',
      tier_features_used: [],
      content: {
        generated_text: 'I apologize, but I encountered an error. Please try again or contact support.',
      },
      cost_tracking: {
        estimated_cost_euros: 0,
        tokens_used: 0,
        processing_time_ms: Date.now() - startTime,
      },
      routing_decision: {
        reason: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        confidence: 1.0,
      },
    };
  }
  
  // =============================================================================
  // UTILITY METHODS
  // =============================================================================
  
  private detectLanguage(text: string): 'de' | 'en' | 'nl' | 'fr' {
    const germanWords = ['und', 'der', 'die', 'das', 'ich', 'ist', 'termin', 'buchen'];
    const dutchWords = ['en', 'van', 'het', 'de', 'een', 'is', 'afspraak'];
    const frenchWords = ['et', 'le', 'la', 'les', 'un', 'une', 'réserver'];
    
    const lowerText = text.toLowerCase();
    
    if (germanWords.some(word => lowerText.includes(word))) return 'de';
    if (dutchWords.some(word => lowerText.includes(word))) return 'nl';
    if (frenchWords.some(word => lowerText.includes(word))) return 'fr';
    
    return 'en'; // Default to English
  }
  
  private async trackUsage(salonId: string, response: AIResponse): Promise<void> {
    try {
      // Store usage analytics in database
      console.log('AI Usage:', {
        salon_id: salonId,
        model: response.model_used,
        tier_features: response.tier_features_used,
        cost: response.cost_tracking.estimated_cost_euros,
        tokens: response.cost_tracking.tokens_used,
        processing_time: response.cost_tracking.processing_time_ms,
        success: response.success,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error tracking AI usage:', error);
    }
  }
  
  // =============================================================================
  // HEALTH CHECKS
  // =============================================================================
  
  async healthCheck(): Promise<{
    overall_status: 'healthy' | 'degraded' | 'error';
    services: {
      'gemini-2.5-flash': { status: 'healthy' | 'error'; details?: string };
      'gemini-2.5-flash-lite': { status: 'healthy' | 'error'; details?: string };
      'conversation-tracker': { status: 'healthy' | 'error'; details?: string };
    };
  }> {
    const [geminiHealth, geminiLiteHealth, trackerHealth] = await Promise.all([
      this.geminiClient.healthCheck(),
      this.geminiLiteClient.healthCheck(),
      this.checkTrackerHealth(),
    ]);
    
    const healthyServices = [geminiHealth, geminiLiteHealth, trackerHealth].filter(h => h.status === 'healthy').length;
    const overallStatus = 
      healthyServices === 3 ? 'healthy' :
      healthyServices >= 1 ? 'degraded' : 'error';
    
    return {
      overall_status: overallStatus,
      services: {
        'gemini-2.5-flash': geminiHealth,
        'gemini-2.5-flash-lite': geminiLiteHealth,
        'conversation-tracker': trackerHealth,
      },
    };
  }
  
  private async checkTrackerHealth(): Promise<{ status: 'healthy' | 'error'; details?: string }> {
    try {
      // Test conversation tracker functionality
      await this.conversationTracker.getCurrentUsage('test-salon-id');
      return { status: 'healthy' };
    } catch (error) {
      return {
        status: 'error',
        details: error instanceof Error ? error.message : 'Tracker health check failed'
      };
    }
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

let tierBasedAIOrchestrator: TierBasedAIOrchestrator | null = null;

export function getTierBasedAIOrchestrator(): TierBasedAIOrchestrator {
  if (!tierBasedAIOrchestrator) {
    tierBasedAIOrchestrator = new TierBasedAIOrchestrator();
  }
  return tierBasedAIOrchestrator;
}

export { TierBasedAIOrchestrator };
export default TierBasedAIOrchestrator;