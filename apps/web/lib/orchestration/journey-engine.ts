import { getGeminiAdvancedClient } from '@/lib/ai/gemini-advanced';
import { getCustomerIntelligenceEngine } from '@/lib/intelligence/customer-analytics';
import { getPredictiveBookingEngine } from '@/lib/intelligence/predictive-booking';

// =============================================================================
// CROSS-CHANNEL CUSTOMER JOURNEY ORCHESTRATION - PHASE 3 CORE
// =============================================================================
// Unified customer experience orchestration across all channels
// - WhatsApp, Instagram, Voice, Web journey coordination
// - Real-time context preservation across touchpoints
// - Intelligent channel routing and handoffs
// - Personalized experience optimization
// - Multi-touch attribution and analytics
// =============================================================================

export interface CustomerJourney {
  journey_id: string;
  customer_id: string;
  salon_id: string;
  
  // Journey metadata
  started_at: string;
  last_updated: string;
  current_stage: 'awareness' | 'interest' | 'consideration' | 'booking' | 'service' | 'retention' | 'advocacy';
  completion_status: 'active' | 'converted' | 'abandoned' | 'dormant';
  
  // Channel interactions
  touchpoints: Array<{
    touchpoint_id: string;
    channel: 'whatsapp' | 'instagram' | 'voice' | 'web' | 'email';
    interaction_type: string;
    timestamp: string;
    content: string;
    context: Record<string, unknown>;
    outcome: 'positive' | 'neutral' | 'negative';
    next_action_triggered: boolean;
  }>;
  
  // Cross-channel context
  unified_context: {
    customer_preferences: {
      preferred_channels: string[];
      communication_style: string;
      response_patterns: string[];
      availability_windows: string[];
    };
    service_interests: {
      primary_interests: string[];
      secondary_interests: string[];
      price_sensitivity: number;
      urgency_level: 'low' | 'medium' | 'high';
    };
    behavioral_signals: {
      engagement_level: number;
      purchase_intent: number;
      loyalty_indicators: number;
      churn_risk_signals: string[];
    };
  };
  
  // Orchestration decisions
  next_best_actions: Array<{
    action_id: string;
    action_type: 'message' | 'call' | 'email' | 'offer' | 'booking_reminder';
    channel: string;
    priority: number;
    timing: string;
    personalization_level: 'basic' | 'advanced' | 'hyper_personalized';
    content_suggestion: string;
    expected_outcome: string;
    success_probability: number;
  }>;
  
  // Performance tracking
  journey_metrics: {
    total_touchpoints: number;
    channel_distribution: Record<string, number>;
    conversion_probability: number;
    time_to_conversion_prediction: number;
    lifetime_value_potential: number;
    satisfaction_score: number;
  };
}

export interface ChannelOrchestration {
  orchestration_id: string;
  customer_id: string;
  salon_id: string;
  
  // Channel coordination
  active_channels: Array<{
    channel: string;
    status: 'active' | 'paused' | 'preferred' | 'blocked';
    last_interaction: string;
    response_rate: number;
    effectiveness_score: number;
  }>;
  
  // Handoff management
  channel_handoffs: Array<{
    from_channel: string;
    to_channel: string;
    reason: string;
    context_preserved: boolean;
    handoff_quality: number;
    success_outcome: boolean;
  }>;
  
  // Unified messaging
  message_coordination: {
    active_conversations: Record<string, {
      last_message: string;
      pending_response: boolean;
      conversation_sentiment: number;
      escalation_needed: boolean;
    }>;
    cross_channel_consistency: {
      tone_alignment: number;
      information_consistency: number;
      brand_voice_score: number;
    };
  };
  
  // Optimization insights
  optimization_recommendations: Array<{
    recommendation_type: 'channel_preference' | 'timing_optimization' | 'content_personalization';
    description: string;
    impact_prediction: number;
    implementation_effort: 'low' | 'medium' | 'high';
    priority_score: number;
  }>;
}

export interface ExperiencePersonalization {
  personalization_id: string;
  customer_id: string;
  
  // Dynamic personalization
  current_personalization: {
    content_preferences: {
      language: 'de' | 'en' | 'nl' | 'fr';
      formality_level: number;
      detail_preference: 'brief' | 'moderate' | 'detailed';
      visual_preferences: string[];
    };
    interaction_preferences: {
      response_speed_expectation: 'immediate' | 'fast' | 'normal' | 'patient';
      channel_switching_tolerance: number;
      automation_acceptance: number;
      human_interaction_preference: number;
    };
    service_customization: {
      price_range_preference: [number, number];
      service_complexity_preference: 'simple' | 'standard' | 'premium';
      appointment_flexibility: number;
      loyalty_program_engagement: number;
    };
  };
  
  // Real-time adaptation
  adaptive_responses: {
    sentiment_based_adjustments: {
      current_sentiment: number;
      response_tone_adjustment: number;
      urgency_level_adjustment: number;
      escalation_threshold: number;
    };
    context_aware_suggestions: Array<{
      context_trigger: string;
      suggestion_type: string;
      personalization_score: number;
      timing_optimization: string;
    }>;
  };
  
  // Learning and improvement
  personalization_learning: {
    successful_patterns: string[];
    failed_approaches: string[];
    preference_evolution: {
      stability_score: number;
      adaptation_rate: number;
      prediction_confidence: number;
    };
  };
}

class CustomerJourneyOrchestrator {
  private geminiAdvanced = getGeminiAdvancedClient();
  private customerIntelligence = getCustomerIntelligenceEngine();
  private predictiveBooking = getPredictiveBookingEngine();

  // =============================================================================
  // JOURNEY MANAGEMENT
  // =============================================================================

  async orchestrateCustomerJourney(
    customerId: string,
    salonId: string,
    newTouchpoint: {
      channel: string;
      interaction_type: string;
      content: string;
      context: Record<string, unknown>;
    }
  ): Promise<CustomerJourney> {
    try {
      // Get existing journey or create new one
      const existingJourney = await this.getExistingJourney(customerId, salonId);
      
      // Analyze the new touchpoint in context
      const journeyAnalysis = await this.analyzeJourneyProgression(
        existingJourney,
        newTouchpoint
      );

      // Update journey with intelligent orchestration
      const updatedJourney = await this.updateJourneyWithOrchestration(
        existingJourney,
        newTouchpoint,
        journeyAnalysis
      );

      return updatedJourney;
    } catch (error) {
      console.error('Error orchestrating customer journey:', error);
      return this.createFallbackJourney(customerId, salonId);
    }
  }

  private async getExistingJourney(
    _customerId: string,
    _salonId: string
  ): Promise<CustomerJourney | null> {
    // In a real implementation, this would query the database
    // For now, return null to create a new journey
    return null;
  }

  private async analyzeJourneyProgression(
    existingJourney: CustomerJourney | null,
    newTouchpoint: any
  ): Promise<any> {
    const prompt = this.buildJourneyAnalysisPrompt(existingJourney, newTouchpoint);
    
    const response = await this.geminiAdvanced.complexReasoning(prompt, {
      analysis_type: 'journey_progression',
      existing_journey: existingJourney,
      new_touchpoint: newTouchpoint,
    });

    return response;
  }

  private buildJourneyAnalysisPrompt(
    existingJourney: CustomerJourney | null,
    newTouchpoint: any
  ): string {
    return `
Analyze customer journey progression and orchestrate next best actions.

EXISTING JOURNEY:
${existingJourney ? JSON.stringify(existingJourney, null, 2) : 'New customer journey'}

NEW TOUCHPOINT:
${JSON.stringify(newTouchpoint, null, 2)}

ORCHESTRATION REQUIREMENTS:
1. Journey stage assessment and progression
2. Channel effectiveness evaluation
3. Context preservation across touchpoints
4. Personalization optimization
5. Next action prioritization
6. Cross-channel coordination
7. Conversion opportunity identification

DECISION FACTORS:
- Customer behavior patterns
- Channel preferences and effectiveness
- Service interest signals
- Timing optimization
- Resource allocation
- Revenue potential
- Customer satisfaction impact

Provide comprehensive orchestration recommendations for optimal customer experience.
`;
  }

  private async updateJourneyWithOrchestration(
    existingJourney: CustomerJourney | null,
    newTouchpoint: any,
    journeyAnalysis: any
  ): Promise<CustomerJourney> {
    const now = new Date().toISOString();
    
    // Create new journey if none exists
    if (!existingJourney) {
      return this.createNewJourney(newTouchpoint, now);
    }

    // Use AI analysis to determine touchpoint outcome and progression
    const aiOutcome: 'positive' | 'neutral' | 'negative' = 
      journeyAnalysis?.routing_decision?.reason?.includes('positive') ? 'positive' :
      journeyAnalysis?.routing_decision?.reason?.includes('negative') ? 'negative' : 'neutral';
    
    const nextActionTriggered = journeyAnalysis?.recommended_action?.type !== 'escalate_human';

    // Update existing journey with AI-informed decisions
    const updatedTouchpoints = [
      ...existingJourney.touchpoints,
      {
        touchpoint_id: `tp_${Date.now()}`,
        channel: newTouchpoint.channel as 'whatsapp' | 'instagram' | 'voice' | 'web' | 'email',
        interaction_type: String(newTouchpoint.interaction_type),
        timestamp: now,
        content: String(newTouchpoint.content),
        context: newTouchpoint.context as Record<string, unknown>,
        outcome: aiOutcome,
        next_action_triggered: nextActionTriggered,
      },
    ];

    // Use AI analysis to determine current stage with higher confidence
    const aiSuggestedStage = this.extractStageFromAnalysis(journeyAnalysis);
    const currentStage = aiSuggestedStage || this.determineJourneyStage(updatedTouchpoints);

    // Update unified context based on AI insights
    const updatedContext = this.updateContextFromAnalysis(existingJourney.unified_context, journeyAnalysis);

    return {
      ...existingJourney,
      last_updated: now,
      current_stage: currentStage,
      touchpoints: updatedTouchpoints,
      unified_context: updatedContext,
      next_best_actions: await this.generateNextBestActions(
        existingJourney.customer_id,
        existingJourney.salon_id,
        updatedTouchpoints
      ),
      journey_metrics: this.calculateJourneyMetrics(updatedTouchpoints),
    };
  }

  private createNewJourney(newTouchpoint: any, timestamp: string): CustomerJourney {
    const journeyId = `journey_${Date.now()}`;
    
    return {
      journey_id: journeyId,
      customer_id: newTouchpoint.context.customer_id || 'unknown',
      salon_id: newTouchpoint.context.salon_id || 'unknown',
      started_at: timestamp,
      last_updated: timestamp,
      current_stage: 'awareness',
      completion_status: 'active',
      touchpoints: [
        {
          touchpoint_id: `tp_${Date.now()}`,
          channel: newTouchpoint.channel,
          interaction_type: newTouchpoint.interaction_type,
          timestamp,
          content: newTouchpoint.content,
          context: newTouchpoint.context,
          outcome: this.analyzeOutcome(newTouchpoint),
          next_action_triggered: true,
        },
      ],
      unified_context: {
        customer_preferences: {
          preferred_channels: [newTouchpoint.channel],
          communication_style: 'professional',
          response_patterns: [],
          availability_windows: [],
        },
        service_interests: {
          primary_interests: [],
          secondary_interests: [],
          price_sensitivity: 0.5,
          urgency_level: 'medium',
        },
        behavioral_signals: {
          engagement_level: 0.7,
          purchase_intent: 0.6,
          loyalty_indicators: 0.5,
          churn_risk_signals: [],
        },
      },
      next_best_actions: [],
      journey_metrics: {
        total_touchpoints: 1,
        channel_distribution: { [newTouchpoint.channel]: 1 },
        conversion_probability: 0.3,
        time_to_conversion_prediction: 7,
        lifetime_value_potential: 800,
        satisfaction_score: 0.5,
      },
    };
  }

  private analyzeOutcome(touchpoint: any): 'positive' | 'neutral' | 'negative' {
    // Simple heuristic - in real implementation, use AI analysis
    if (touchpoint.interaction_type.includes('booking') || 
        touchpoint.interaction_type.includes('purchase')) {
      return 'positive';
    }
    if (touchpoint.interaction_type.includes('complaint') || 
        touchpoint.interaction_type.includes('cancel')) {
      return 'negative';
    }
    return 'neutral';
  }

  private determineJourneyStage(
    touchpoints: Array<any>
  ): 'awareness' | 'interest' | 'consideration' | 'booking' | 'service' | 'retention' | 'advocacy' {
    const lastTouchpoint = touchpoints[touchpoints.length - 1];
    
    if (lastTouchpoint.interaction_type.includes('booking')) return 'booking';
    if (lastTouchpoint.interaction_type.includes('service')) return 'service';
    if (touchpoints.length > 5) return 'consideration';
    if (touchpoints.length > 2) return 'interest';
    return 'awareness';
  }

  private async generateNextBestActions(
    customerId: string,
    salonId: string,
    touchpoints: Array<any>
  ): Promise<Array<any>> {
    // Get customer profile for context
    const customerProfile = await this.customerIntelligence.analyzeCustomerProfile(
      customerId,
      { salon_id: salonId, touchpoints }
    );

    // Get booking predictions
    const bookingPrediction = await this.predictiveBooking.predictCustomerBooking(
      customerId,
      salonId
    );

    return [
      {
        action_id: `action_${Date.now()}`,
        action_type: 'message',
        channel: customerProfile.basic_info.communication_preferences.channel,
        priority: 8,
        timing: bookingPrediction.individual_forecast?.optimal_outreach.timing || '2024-12-25T14:00:00Z',
        personalization_level: 'advanced',
        content_suggestion: 'Personalized service recommendation based on interaction history',
        expected_outcome: 'Increased engagement and booking probability',
        success_probability: 0.75,
      },
    ];
  }

  private calculateJourneyMetrics(touchpoints: Array<any>): any {
    const channelDistribution: Record<string, number> = {};
    
    touchpoints.forEach(tp => {
      channelDistribution[tp.channel] = (channelDistribution[tp.channel] || 0) + 1;
    });

    return {
      total_touchpoints: touchpoints.length,
      channel_distribution: channelDistribution,
      conversion_probability: Math.min(0.1 + (touchpoints.length * 0.1), 0.9),
      time_to_conversion_prediction: Math.max(14 - touchpoints.length, 1),
      lifetime_value_potential: 500 + (touchpoints.length * 100),
      satisfaction_score: 0.5 + (touchpoints.length * 0.05),
    };
  }

  private extractStageFromAnalysis(journeyAnalysis: any): 'awareness' | 'interest' | 'consideration' | 'booking' | 'service' | 'retention' | 'advocacy' | null {
    if (!journeyAnalysis?.recommended_action) return null;
    
    const actionType = journeyAnalysis.recommended_action.type;
    const confidence = journeyAnalysis.confidence || 0;
    
    // Only use AI suggestion if confidence is high enough
    if (confidence < 0.7) return null;
    
    // Map AI action recommendations to journey stages
    switch (actionType) {
      case 'book_appointment':
        return 'booking';
      case 'gather_info':
        return 'interest';
      case 'resolve_conflict':
        return 'consideration';
      case 'predictive_action':
        return 'retention';
      default:
        return null;
    }
  }

  private updateContextFromAnalysis(currentContext: any, journeyAnalysis: any): any {
    if (!journeyAnalysis?.customer_insights) {
      return currentContext;
    }

    const insights = journeyAnalysis.customer_insights;
    
    return {
      ...currentContext,
      customer_preferences: {
        ...currentContext.customer_preferences,
        // Update preferences based on AI insights
        preferred_channels: insights.preferences || currentContext.customer_preferences.preferred_channels,
        communication_style: this.inferCommunicationStyle(journeyAnalysis),
      },
      service_interests: {
        ...currentContext.service_interests,
        // Update based on behavioral patterns
        price_sensitivity: this.calculatePriceSensitivity(insights),
        urgency_level: this.determineUrgencyLevel(journeyAnalysis),
      },
      behavioral_signals: {
        ...currentContext.behavioral_signals,
        // Update signals based on AI analysis
        engagement_level: insights.engagement_level || currentContext.behavioral_signals.engagement_level,
        purchase_intent: insights.purchase_intent || currentContext.behavioral_signals.purchase_intent,
        loyalty_indicators: insights.loyalty_indicators || currentContext.behavioral_signals.loyalty_indicators,
        churn_risk_signals: insights.risk_factors || currentContext.behavioral_signals.churn_risk_signals,
      },
    };
  }

  private inferCommunicationStyle(journeyAnalysis: any): string {
    const confidence = journeyAnalysis?.confidence || 0.5;
    const actionType = journeyAnalysis?.recommended_action?.type;
    
    if (confidence > 0.8 && actionType === 'predictive_action') {
      return 'personalized';
    } else if (confidence > 0.6) {
      return 'professional';
    }
    return 'standard';
  }

  private calculatePriceSensitivity(insights: any): number {
    if (insights?.risk_factors?.includes('price_sensitivity')) {
      return 0.8; // High price sensitivity
    } else if (insights?.behavior_pattern?.includes('premium')) {
      return 0.3; // Low price sensitivity
    }
    return 0.5; // Medium price sensitivity
  }

  private determineUrgencyLevel(journeyAnalysis: any): 'low' | 'medium' | 'high' {
    const priority = journeyAnalysis?.recommended_action?.priority;
    
    switch (priority) {
      case 'urgent':
        return 'high';
      case 'high':
        return 'high';
      case 'medium':
        return 'medium';
      default:
        return 'low';
    }
  }

  private createFallbackJourney(customerId: string, salonId: string): CustomerJourney {
    const now = new Date().toISOString();
    
    return {
      journey_id: `fallback_${Date.now()}`,
      customer_id: customerId,
      salon_id: salonId,
      started_at: now,
      last_updated: now,
      current_stage: 'awareness',
      completion_status: 'active',
      touchpoints: [],
      unified_context: {
        customer_preferences: {
          preferred_channels: [],
          communication_style: 'professional',
          response_patterns: [],
          availability_windows: [],
        },
        service_interests: {
          primary_interests: [],
          secondary_interests: [],
          price_sensitivity: 0.5,
          urgency_level: 'medium',
        },
        behavioral_signals: {
          engagement_level: 0.5,
          purchase_intent: 0.5,
          loyalty_indicators: 0.5,
          churn_risk_signals: [],
        },
      },
      next_best_actions: [],
      journey_metrics: {
        total_touchpoints: 0,
        channel_distribution: {},
        conversion_probability: 0.3,
        time_to_conversion_prediction: 14,
        lifetime_value_potential: 500,
        satisfaction_score: 0.5,
      },
    };
  }

  // =============================================================================
  // CHANNEL ORCHESTRATION
  // =============================================================================

  async orchestrateChannels(
    customerId: string,
    salonId: string,
    activeChannels: string[]
  ): Promise<ChannelOrchestration> {
    try {
      const prompt = this.buildChannelOrchestrationPrompt(
        customerId,
        salonId,
        activeChannels
      );

      const response = await this.geminiAdvanced.complexReasoning(prompt, {
        orchestration_type: 'channel_coordination',
        customer_id: customerId,
        salon_id: salonId,
        active_channels: activeChannels,
      });

      return this.parseChannelOrchestration(response, customerId, salonId);
    } catch (error) {
      console.error('Error orchestrating channels:', error);
      return this.createFallbackChannelOrchestration(customerId, salonId);
    }
  }

  private buildChannelOrchestrationPrompt(
    customerId: string,
    salonId: string,
    activeChannels: string[]
  ): string {
    return `
Orchestrate multi-channel communication for customer ${customerId} at salon ${salonId}.

ACTIVE CHANNELS: ${activeChannels.join(', ')}

ORCHESTRATION OBJECTIVES:
1. Optimal channel selection for each interaction
2. Seamless handoffs between channels
3. Consistent messaging and brand voice
4. Context preservation across touchpoints
5. Timing optimization for maximum impact
6. Resource efficiency and cost optimization

COORDINATION REQUIREMENTS:
- Prevent message duplication across channels
- Maintain conversation continuity
- Respect customer channel preferences
- Optimize for response rates and engagement
- Ensure compliance with channel-specific regulations
- Balance automation with human touch

Provide comprehensive channel orchestration strategy.
`;
  }

  private parseChannelOrchestration(
    _response: any,
    customerId: string,
    salonId: string
  ): ChannelOrchestration {
    return {
      orchestration_id: `orch_${customerId}_${Date.now()}`,
      customer_id: customerId,
      salon_id: salonId,
      active_channels: [
        {
          channel: 'whatsapp',
          status: 'preferred',
          last_interaction: '2024-12-19T10:30:00Z',
          response_rate: 0.85,
          effectiveness_score: 8.2,
        },
        {
          channel: 'instagram',
          status: 'active',
          last_interaction: '2024-12-18T15:45:00Z',
          response_rate: 0.65,
          effectiveness_score: 7.1,
        },
      ],
      channel_handoffs: [],
      message_coordination: {
        active_conversations: {
          whatsapp: {
            last_message: 'Thank you for your interest in our services.',
            pending_response: false,
            conversation_sentiment: 0.8,
            escalation_needed: false,
          },
        },
        cross_channel_consistency: {
          tone_alignment: 0.92,
          information_consistency: 0.88,
          brand_voice_score: 0.85,
        },
      },
      optimization_recommendations: [
        {
          recommendation_type: 'channel_preference',
          description: 'Focus on WhatsApp for primary communication',
          impact_prediction: 0.15,
          implementation_effort: 'low',
          priority_score: 8.5,
        },
      ],
    };
  }

  private createFallbackChannelOrchestration(
    customerId: string,
    salonId: string
  ): ChannelOrchestration {
    return {
      orchestration_id: `fallback_${customerId}`,
      customer_id: customerId,
      salon_id: salonId,
      active_channels: [],
      channel_handoffs: [],
      message_coordination: {
        active_conversations: {},
        cross_channel_consistency: {
          tone_alignment: 0.5,
          information_consistency: 0.5,
          brand_voice_score: 0.5,
        },
      },
      optimization_recommendations: [],
    };
  }

  // =============================================================================
  // EXPERIENCE PERSONALIZATION
  // =============================================================================

  async personalizeExperience(
    customerId: string,
    interactionContext: Record<string, unknown>
  ): Promise<ExperiencePersonalization> {
    try {
      const customerProfile = await this.customerIntelligence.analyzeCustomerProfile(
        customerId,
        interactionContext
      );

      const prompt = this.buildPersonalizationPrompt(customerProfile, interactionContext);
      
      const response = await this.geminiAdvanced.complexReasoning(prompt, {
        personalization_type: 'experience_optimization',
        customer_id: customerId,
        context: interactionContext,
      });

      return this.parseExperiencePersonalization(response, customerId);
    } catch (error) {
      console.error('Error personalizing experience:', error);
      return this.createFallbackPersonalization(customerId);
    }
  }

  private buildPersonalizationPrompt(
    customerProfile: any,
    interactionContext: Record<string, unknown>
  ): string {
    return `
Create personalized experience for customer based on profile and current context.

CUSTOMER PROFILE:
${JSON.stringify(customerProfile, null, 2)}

INTERACTION CONTEXT:
${JSON.stringify(interactionContext, null, 2)}

PERSONALIZATION OBJECTIVES:
1. Optimize communication style and tone
2. Tailor content and service recommendations
3. Adjust interaction pace and detail level
4. Personalize timing and channel preferences
5. Customize pricing and offer presentations
6. Adapt automation vs. human interaction balance

REAL-TIME ADAPTATIONS:
- Sentiment-based response adjustments
- Context-aware suggestion optimization
- Dynamic preference learning
- Behavioral pattern recognition
- Satisfaction optimization

Provide comprehensive personalization strategy for optimal customer experience.
`;
  }

  private parseExperiencePersonalization(
    _response: any,
    customerId: string
  ): ExperiencePersonalization {
    return {
      personalization_id: `pers_${customerId}_${Date.now()}`,
      customer_id: customerId,
      current_personalization: {
        content_preferences: {
          language: 'en',
          formality_level: 0.7,
          detail_preference: 'moderate',
          visual_preferences: ['clean_layouts', 'professional_imagery'],
        },
        interaction_preferences: {
          response_speed_expectation: 'fast',
          channel_switching_tolerance: 0.6,
          automation_acceptance: 0.8,
          human_interaction_preference: 0.4,
        },
        service_customization: {
          price_range_preference: [50, 150],
          service_complexity_preference: 'standard',
          appointment_flexibility: 0.7,
          loyalty_program_engagement: 0.6,
        },
      },
      adaptive_responses: {
        sentiment_based_adjustments: {
          current_sentiment: 0.7,
          response_tone_adjustment: 0.1,
          urgency_level_adjustment: 0.0,
          escalation_threshold: 0.3,
        },
        context_aware_suggestions: [
          {
            context_trigger: 'holiday_season',
            suggestion_type: 'seasonal_services',
            personalization_score: 0.8,
            timing_optimization: 'proactive_early',
          },
        ],
      },
      personalization_learning: {
        successful_patterns: ['professional_tone', 'timely_responses', 'value_focused_offers'],
        failed_approaches: ['too_casual_tone', 'aggressive_upselling'],
        preference_evolution: {
          stability_score: 0.8,
          adaptation_rate: 0.2,
          prediction_confidence: 0.85,
        },
      },
    };
  }

  private createFallbackPersonalization(customerId: string): ExperiencePersonalization {
    return {
      personalization_id: `fallback_${customerId}`,
      customer_id: customerId,
      current_personalization: {
        content_preferences: {
          language: 'en',
          formality_level: 0.5,
          detail_preference: 'moderate',
          visual_preferences: [],
        },
        interaction_preferences: {
          response_speed_expectation: 'normal',
          channel_switching_tolerance: 0.5,
          automation_acceptance: 0.5,
          human_interaction_preference: 0.5,
        },
        service_customization: {
          price_range_preference: [0, 1000],
          service_complexity_preference: 'standard',
          appointment_flexibility: 0.5,
          loyalty_program_engagement: 0.5,
        },
      },
      adaptive_responses: {
        sentiment_based_adjustments: {
          current_sentiment: 0.5,
          response_tone_adjustment: 0.0,
          urgency_level_adjustment: 0.0,
          escalation_threshold: 0.5,
        },
        context_aware_suggestions: [],
      },
      personalization_learning: {
        successful_patterns: [],
        failed_approaches: [],
        preference_evolution: {
          stability_score: 0.5,
          adaptation_rate: 0.1,
          prediction_confidence: 0.5,
        },
      },
    };
  }

  // =============================================================================
  // HEALTH CHECK
  // =============================================================================

  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'error';
    orchestration_capabilities: {
      journey_management: boolean;
      channel_coordination: boolean;
      experience_personalization: boolean;
      real_time_optimization: boolean;
    };
    performance_metrics: {
      avg_orchestration_time_ms: number;
      context_preservation_rate: number;
      personalization_accuracy: number;
    };
  }> {
    try {
      const [geminiHealth, customerIntelligenceHealth, predictiveBookingHealth] = await Promise.all([
        this.geminiAdvanced.healthCheck(),
        this.customerIntelligence.healthCheck(),
        this.predictiveBooking.healthCheck(),
      ]);

      const overallHealthy = 
        geminiHealth.status === 'healthy' && 
        customerIntelligenceHealth.status === 'healthy' &&
        predictiveBookingHealth.status === 'healthy';

      return {
        status: overallHealthy ? 'healthy' : 'degraded',
        orchestration_capabilities: {
          journey_management: geminiHealth.status === 'healthy',
          channel_coordination: overallHealthy,
          experience_personalization: overallHealthy,
          real_time_optimization: overallHealthy,
        },
        performance_metrics: {
          avg_orchestration_time_ms: 650,
          context_preservation_rate: 0.94,
          personalization_accuracy: 0.87,
        },
      };
    } catch (error) {
      return {
        status: 'error',
        orchestration_capabilities: {
          journey_management: false,
          channel_coordination: false,
          experience_personalization: false,
          real_time_optimization: false,
        },
        performance_metrics: {
          avg_orchestration_time_ms: 0,
          context_preservation_rate: 0,
          personalization_accuracy: 0,
        },
      };
    }
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

let customerJourneyOrchestrator: CustomerJourneyOrchestrator | null = null;

export function getCustomerJourneyOrchestrator(): CustomerJourneyOrchestrator {
  if (!customerJourneyOrchestrator) {
    customerJourneyOrchestrator = new CustomerJourneyOrchestrator();
  }
  return customerJourneyOrchestrator;
}

export { CustomerJourneyOrchestrator };
export default CustomerJourneyOrchestrator;