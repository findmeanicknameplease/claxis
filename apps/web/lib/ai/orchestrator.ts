import { getGeminiClient, IntentResult, ConversationContext as GeminiContext } from './gemini';
import { getGeminiAdvancedClient, ReasoningResult, BookingFlow } from './gemini-advanced';

// =============================================================================
// AI ORCHESTRATOR - PHASE 3 UPGRADE
// =============================================================================
// Intelligent routing between Gemini Flash and Gemini 2.5 Flash based on complexity
// - Simple requests → Gemini Flash (fast, cost-effective)
// - Complex reasoning → Gemini 2.5 Flash (advanced reasoning, optimized cost)
// - Budget optimization and cost tracking per salon
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
      subscription_tier: 'professional' | 'enterprise';
    };
  };
  request_type: 'intent_detection' | 'response_generation' | 'complex_reasoning' | 'booking_flow';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  budget_constraints: {
    daily_limit_euros: number;
    monthly_limit_euros: number;
    cost_per_request_limit: number;
  };
}

export interface AIResponse {
  success: boolean;
  model_used: 'gemini-flash' | 'gemini-2.5-flash';
  response_type: string;
  content: {
    intent?: IntentResult;
    generated_text?: string;
    reasoning?: ReasoningResult;
    booking_flow?: BookingFlow;
  };
  cost_tracking: {
    estimated_cost_euros: number;
    tokens_used: number;
    processing_time_ms: number;
  };
  routing_decision: {
    reason: string;
    confidence: number;
    alternative_model?: string;
  };
}

class AIOrchestrator {
  private geminiClient = getGeminiClient();
  private geminiAdvancedClient = getGeminiAdvancedClient();
  
  async processRequest(request: AIRequest): Promise<AIResponse> {
    const startTime = Date.now();
    
    try {
      // 1. Analyze request complexity and route to appropriate model
      const routingDecision = await this.analyzeAndRoute(request);
      
      // 2. Check budget constraints
      const budgetCheck = await this.validateBudget(request, routingDecision.estimated_cost);
      if (!budgetCheck.approved) {
        return this.createBudgetExceededResponse(budgetCheck.reason || 'Budget exceeded', startTime);
      }
      
      // 3. Process with selected model
      let response: AIResponse;
      
      switch (routingDecision.selected_model) {
        case 'gemini-flash':
          response = await this.processWithGemini(request, routingDecision);
          break;
        case 'gemini-2.5-flash':
          response = await this.processWithGeminiAdvanced(request, routingDecision);
          break;
        default:
          throw new Error(`Unknown model: ${routingDecision.selected_model}`);
      }
      
      // 4. Add timing and routing information
      response.cost_tracking.processing_time_ms = Date.now() - startTime;
      response.routing_decision = {
        reason: routingDecision.reason,
        confidence: routingDecision.confidence,
        alternative_model: routingDecision.alternative_model,
      };
      
      // 5. Track usage for analytics
      await this.trackUsage(request.context.salon_id, response);
      
      return response;
      
    } catch (error) {
      console.error('Error in AI orchestration:', error);
      return this.createErrorResponse(error, startTime);
    }
  }
  
  // =============================================================================
  // INTELLIGENT ROUTING
  // =============================================================================
  
  private async analyzeAndRoute(request: AIRequest): Promise<{
    selected_model: 'gemini-flash' | 'gemini-2.5-flash';
    reason: string;
    confidence: number;
    estimated_cost: number;
    alternative_model?: string;
  }> {
    const complexity = this.assessComplexity(request);
    
    // Simple requests → Gemini Flash (fast, cheap)
    if (complexity.score < 0.5) {
      return {
        selected_model: 'gemini-flash',
        reason: `Low complexity (${complexity.score.toFixed(2)}): ${complexity.factors.join(', ')}`,
        confidence: 0.9,
        estimated_cost: 0.001, // ~€0.001 for simple requests
        alternative_model: 'gemini-2.5-flash'
      };
    }
    
    // Complex requests → Gemini 2.5 Flash (advanced reasoning)
    if (complexity.score > 0.7) {
      return {
        selected_model: 'gemini-2.5-flash',
        reason: `High complexity (${complexity.score.toFixed(2)}): ${complexity.factors.join(', ')}`,
        confidence: 0.85,
        estimated_cost: 0.003, // ~€0.003 for complex requests (Gemini 2.5 Flash optimized)
        alternative_model: 'gemini-flash'
      };
    }
    
    // Medium complexity → Choose based on subscription tier
    const useAdvanced = request.context.salon_info.subscription_tier === 'enterprise';
    
    if (useAdvanced) {
      return {
        selected_model: 'gemini-2.5-flash',
        reason: `Medium complexity (${complexity.score.toFixed(2)}) + Enterprise tier`,
        confidence: 0.75,
        estimated_cost: 0.003,
        alternative_model: 'gemini-flash'
      };
    } else {
      return {
        selected_model: 'gemini-flash',
        reason: `Medium complexity (${complexity.score.toFixed(2)}) + Professional tier`,
        confidence: 0.7,
        estimated_cost: 0.001,
        alternative_model: 'gemini-2.5-flash'
      };
    }
  }
  
  private assessComplexity(request: AIRequest): { score: number; factors: string[] } {
    let score = 0;
    const factors: string[] = [];
    
    // Request type complexity
    const typeComplexity = {
      'intent_detection': 0.2,
      'response_generation': 0.4,
      'booking_flow': 0.6,
      'complex_reasoning': 0.9,
    };
    
    score += typeComplexity[request.request_type] || 0.5;
    factors.push(`${request.request_type} (${typeComplexity[request.request_type]})`);
    
    // Message length and complexity
    const wordCount = request.message.split(' ').length;
    if (wordCount > 50) {
      score += 0.2;
      factors.push('long message');
    }
    
    // Conversation history length
    const historyLength = request.context.conversation_history.length;
    if (historyLength > 5) {
      score += 0.1;
      factors.push('long conversation');
    }
    
    // Priority level
    const priorityWeight = {
      'low': 0,
      'medium': 0.1,
      'high': 0.2,
      'urgent': 0.3,
    };
    
    score += priorityWeight[request.priority];
    if (priorityWeight[request.priority] > 0) {
      factors.push(`${request.priority} priority`);
    }
    
    // Multi-language complexity
    if (request.context.salon_info.languages.length > 2) {
      score += 0.1;
      factors.push('multi-language');
    }
    
    return { score: Math.min(score, 1.0), factors };
  }
  
  // =============================================================================
  // MODEL-SPECIFIC PROCESSING
  // =============================================================================
  
  private async processWithGemini(
    request: AIRequest,
    routing: any
  ): Promise<AIResponse> {
    const response: AIResponse = {
      success: true,
      model_used: 'gemini-flash',
      response_type: request.request_type,
      content: {},
      cost_tracking: {
        estimated_cost_euros: routing.estimated_cost,
        tokens_used: 0,
        processing_time_ms: 0,
      },
      routing_decision: {
        reason: routing.reason,
        confidence: routing.confidence,
      },
    };
    
    try {
      switch (request.request_type) {
        case 'intent_detection':
          const geminiContext: GeminiContext = {
            salon_id: request.context.salon_id,
            customer_id: request.context.customer_id,
            platform: request.context.platform,
            conversation_history: request.context.conversation_history,
            salon_info: request.context.salon_info,
          };
          
          response.content.intent = await this.geminiClient.processIntent(
            request.message,
            geminiContext
          );
          break;
          
        case 'response_generation':
          response.content.generated_text = await this.geminiClient.generateResponse({
            language: this.detectLanguage(request.message),
            tone: 'professional',
            include_booking_cta: true,
            max_length: 300,
            context: {
              salon_id: request.context.salon_id,
              customer_id: request.context.customer_id,
              platform: request.context.platform,
              conversation_history: request.context.conversation_history,
              salon_info: request.context.salon_info,
            },
          });
          break;
          
        default:
          throw new Error(`Gemini Flash cannot handle ${request.request_type}`);
      }
      
      // Estimate actual token usage
      const tokenEstimate = await this.geminiClient.estimateTokenCost(request.message);
      response.cost_tracking.tokens_used = tokenEstimate.inputTokens;
      response.cost_tracking.estimated_cost_euros = tokenEstimate.estimatedCost;
      
    } catch (error) {
      response.success = false;
      console.error('Error processing with Gemini:', error);
    }
    
    return response;
  }
  
  private async processWithGeminiAdvanced(
    request: AIRequest,
    routing: any
  ): Promise<AIResponse> {
    const response: AIResponse = {
      success: true,
      model_used: 'gemini-2.5-flash',
      response_type: request.request_type,
      content: {},
      cost_tracking: {
        estimated_cost_euros: routing.estimated_cost,
        tokens_used: 0,
        processing_time_ms: 0,
      },
      routing_decision: {
        reason: routing.reason,
        confidence: routing.confidence,
      },
    };
    
    try {
      switch (request.request_type) {
        case 'complex_reasoning':
          response.content.reasoning = await this.geminiAdvancedClient.complexReasoning(
            request.message,
            request.context
          );
          break;
          
        case 'booking_flow':
          response.content.booking_flow = await this.geminiAdvancedClient.multiStepBooking(
            request.context,
            request.message
          );
          break;
          
        default:
          throw new Error(`Gemini 2.5 Flash cannot handle ${request.request_type}`);
      }
      
      // Estimate actual token usage
      const tokenEstimate = await this.geminiAdvancedClient.estimateTokenCost(request.message);
      response.cost_tracking.tokens_used = tokenEstimate.inputTokens;
      response.cost_tracking.estimated_cost_euros = tokenEstimate.estimatedCost;
      
    } catch (error) {
      response.success = false;
      console.error('Error processing with Gemini 2.5 Flash:', error);
    }
    
    return response;
  }
  
  // =============================================================================
  // BUDGET MANAGEMENT
  // =============================================================================
  
  private async validateBudget(
    request: AIRequest,
    estimatedCost: number
  ): Promise<{ approved: boolean; reason?: string }> {
    // Check per-request limit
    if (estimatedCost > request.budget_constraints.cost_per_request_limit) {
      return {
        approved: false,
        reason: `Cost (€${estimatedCost.toFixed(4)}) exceeds per-request limit (€${request.budget_constraints.cost_per_request_limit})`,
      };
    }
    
    // TODO: Check daily and monthly limits from database
    // For now, always approve if under per-request limit
    return { approved: true };
  }
  
  private createBudgetExceededResponse(reason: string, startTime: number): AIResponse {
    return {
      success: false,
      model_used: 'gemini-flash',
      response_type: 'budget_exceeded',
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
      model_used: 'gemini-flash',
      response_type: 'error',
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
    const germanWords = ['und', 'der', 'die', 'das', 'ich', 'ist'];
    const dutchWords = ['en', 'van', 'het', 'de', 'een', 'is'];
    const frenchWords = ['et', 'le', 'la', 'les', 'un', 'une'];
    
    const lowerText = text.toLowerCase();
    
    if (germanWords.some(word => lowerText.includes(word))) return 'de';
    if (dutchWords.some(word => lowerText.includes(word))) return 'nl';
    if (frenchWords.some(word => lowerText.includes(word))) return 'fr';
    
    return 'en'; // Default to English
  }
  
  private async trackUsage(salonId: string, response: AIResponse): Promise<void> {
    try {
      // TODO: Store usage analytics in database
      console.log('AI Usage:', {
        salon_id: salonId,
        model: response.model_used,
        cost: response.cost_tracking.estimated_cost_euros,
        tokens: response.cost_tracking.tokens_used,
        processing_time: response.cost_tracking.processing_time_ms,
        success: response.success,
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
      'gemini-flash': { status: 'healthy' | 'error'; details?: string };
      'gemini-2.5-flash': { status: 'healthy' | 'error'; details?: string };
    };
  }> {
    const [geminiHealth, geminiAdvancedHealth] = await Promise.all([
      this.geminiClient.healthCheck(),
      this.geminiAdvancedClient.healthCheck(),
    ]);
    
    const overallStatus = 
      geminiHealth.status === 'healthy' && geminiAdvancedHealth.status === 'healthy'
        ? 'healthy'
        : geminiHealth.status === 'healthy' || geminiAdvancedHealth.status === 'healthy'
        ? 'degraded'
        : 'error';
    
    return {
      overall_status: overallStatus,
      services: {
        'gemini-flash': geminiHealth,
        'gemini-2.5-flash': geminiAdvancedHealth,
      },
    };
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

let aiOrchestrator: AIOrchestrator | null = null;

export function getAIOrchestrator(): AIOrchestrator {
  if (!aiOrchestrator) {
    aiOrchestrator = new AIOrchestrator();
  }
  return aiOrchestrator;
}

export { AIOrchestrator };
export default AIOrchestrator;
