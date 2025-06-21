import { GoogleGenerativeAI } from '@google/generative-ai';
import { getUpstashClient } from '@/lib/redis/upstash-client';
import { config } from '@/lib/config';

// =============================================================================
// ADVANCED INTENT RECOGNITION ENGINE - ENTERPRISE NLP INTELLIGENCE
// =============================================================================
// Multi-turn conversation intent tracking with sophisticated business logic
// Service upselling detection, appointment optimization, and complaint handling
// Multilingual intent classification with confidence scoring and fallback
// =============================================================================

export interface IntentRecognitionResult {
  primaryIntent: string;
  confidence: number; // 0-1
  subIntents: string[];
  
  // Business intelligence
  businessCategory: 'booking' | 'service_inquiry' | 'support' | 'complaint' | 'upsell_opportunity';
  urgencyLevel: 'low' | 'medium' | 'high' | 'critical';
  emotionalTone: 'positive' | 'neutral' | 'negative' | 'frustrated' | 'excited';
  
  // Extracted entities
  extractedEntities: {
    services: string[];
    dateTime: {
      preferredDate?: string;
      preferredTime?: string;
      flexibility?: 'rigid' | 'flexible' | 'very_flexible';
    };
    customerInfo: {
      name?: string;
      phone?: string;
      previousCustomer?: boolean;
    };
    preferences: {
      practitioner?: string;
      location?: string;
      priceRange?: 'budget' | 'standard' | 'premium';
    };
  };

  // Conversation flow
  conversationStage: 'greeting' | 'needs_assessment' | 'information_gathering' | 'decision_making' | 'closing';
  nextRecommendedAction: string;
  suggestedResponses: string[];
  
  // Upselling intelligence
  upsellOpportunities: {
    opportunity: string;
    confidence: number;
    suggestedServices: string[];
    businessJustification: string;
  }[];
}

export interface ConversationContext {
  sessionId: string;
  turnNumber: number;
  previousIntents: string[];
  conversationHistory: {
    speaker: 'user' | 'agent';
    text: string;
    intent?: string;
    timestamp: Date;
  }[];
  customerProfile?: {
    previousServices: string[];
    communicationStyle: string;
    loyaltyLevel: string;
  };
}

export interface ServiceMapping {
  [key: string]: {
    aliases: string[];
    category: 'hair' | 'nails' | 'skin' | 'massage' | 'wellness';
    duration: number;
    price: number;
    upsellServices: string[];
    prerequisites?: string[];
  };
}

class AdvancedIntentEngine {
  private genAI: GoogleGenerativeAI;
  private model: any;
  private redis: ReturnType<typeof getUpstashClient>;
  private serviceMapping: ServiceMapping;

  constructor() {
    this.genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY || '');
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    this.redis = getUpstashClient();
    this.serviceMapping = this.initializeServiceMapping();
  }

  // =============================================================================
  // MAIN INTENT RECOGNITION
  // =============================================================================

  async recognizeIntent(
    userInput: string,
    language: 'de' | 'en' | 'nl' | 'fr',
    context: ConversationContext
  ): Promise<IntentRecognitionResult> {
    try {
      console.log(`Recognizing intent for: "${userInput}" (${language})`);

      // Multi-stage intent analysis
      const primaryAnalysis = await this.analyzePrimaryIntent(userInput, language, context);
      const entityExtraction = await this.extractEntities(userInput, language);
      const emotionalAnalysis = await this.analyzeEmotionalTone(userInput, language);
      const businessAnalysis = await this.analyzeBusinessContext(userInput, primaryAnalysis.intent, context);
      const upsellAnalysis = await this.analyzeUpsellOpportunities(userInput, entityExtraction, context);

      // Determine conversation stage
      const conversationStage = this.determineConversationStage(context, primaryAnalysis.intent);
      
      // Generate recommendations
      const nextAction = await this.generateNextAction(primaryAnalysis.intent, conversationStage, context);
      const suggestedResponses = await this.generateSuggestedResponses(
        primaryAnalysis.intent,
        language,
        entityExtraction,
        emotionalAnalysis
      );

      const result: IntentRecognitionResult = {
        primaryIntent: primaryAnalysis.intent,
        confidence: primaryAnalysis.confidence,
        subIntents: primaryAnalysis.subIntents,
        businessCategory: businessAnalysis.category,
        urgencyLevel: businessAnalysis.urgency,
        emotionalTone: emotionalAnalysis,
        extractedEntities: entityExtraction,
        conversationStage,
        nextRecommendedAction: nextAction,
        suggestedResponses,
        upsellOpportunities: upsellAnalysis,
      };

      // Store intent history for learning
      await this.storeIntentHistory(context.sessionId, userInput, result);

      // Update conversation context
      await this.updateConversationContext(context, userInput, result);

      console.log(`Intent recognized: ${result.primaryIntent} (confidence: ${result.confidence})`);
      return result;

    } catch (error) {
      console.error('Error in intent recognition:', error);
      return this.createFallbackResult(userInput, language);
    }
  }

  private async analyzePrimaryIntent(
    userInput: string,
    language: string,
    context: ConversationContext
  ): Promise<{ intent: string; confidence: number; subIntents: string[] }> {
    const conversationHistory = context.conversationHistory
      .slice(-3)
      .map(h => `${h.speaker}: ${h.text}`)
      .join('\n');

    const intentPrompt = `
Analyze this salon customer input for primary intent classification.

Customer input: "${userInput}"
Language: ${language}
Conversation context: ${conversationHistory}
Turn number: ${context.turnNumber}

Available intent categories:
1. BOOKING_INTENT - wants to book/schedule appointment
2. SERVICE_INQUIRY - asking about services, prices, availability
3. MODIFICATION_REQUEST - change/cancel existing appointment
4. COMPLAINT_ISSUE - problem with service, dissatisfaction
5. PRICING_INQUIRY - asking about costs, packages, discounts
6. PRACTITIONER_REQUEST - specific stylist/therapist preference
7. GENERAL_INFORMATION - business hours, location, policies
8. GREETING_SOCIAL - hello, goodbye, small talk
9. URGENT_REQUEST - immediate help, emergency, priority
10. UPSELL_INTEREST - interested in additional services

Consider:
- Previous conversation turns for context
- Implied vs explicit intents
- Cultural communication patterns for ${language}

Return JSON only:
{
  "intent": "PRIMARY_INTENT_NAME",
  "confidence": 0.95,
  "subIntents": ["sub_intent_1", "sub_intent_2"],
  "reasoning": "Brief explanation"
}`;

    try {
      const result = await this.model.generateContent(intentPrompt);
      const response = result.response.text().trim();
      
      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          intent: parsed.intent || 'GENERAL_INFORMATION',
          confidence: Math.min(Math.max(parsed.confidence || 0.5, 0), 1),
          subIntents: parsed.subIntents || [],
        };
      }

      // Fallback pattern matching
      return this.performFallbackIntentDetection(userInput, language);

    } catch (error) {
      console.error('Error in primary intent analysis:', error);
      return this.performFallbackIntentDetection(userInput, language);
    }
  }

  private performFallbackIntentDetection(
    userInput: string,
    language: string
  ): { intent: string; confidence: number; subIntents: string[] } {
    const lowerInput = userInput.toLowerCase();
    
    // Language-specific keywords
    const keywords = this.getIntentKeywords(language);
    
    for (const [intent, words] of Object.entries(keywords)) {
      if (words.some(word => lowerInput.includes(word))) {
        return {
          intent,
          confidence: 0.7,
          subIntents: [],
        };
      }
    }

    return {
      intent: 'GENERAL_INFORMATION',
      confidence: 0.5,
      subIntents: [],
    };
  }

  private getIntentKeywords(language: string): Record<string, string[]> {
    const keywordMaps = {
      de: {
        BOOKING_INTENT: ['termin', 'buchen', 'reservieren', 'appointment', 'verfügbar'],
        SERVICE_INQUIRY: ['service', 'behandlung', 'was', 'welche', 'angebot'],
        PRICING_INQUIRY: ['preis', 'kosten', 'wie viel', 'euro', 'günstig'],
        COMPLAINT_ISSUE: ['problem', 'beschwerde', 'unzufrieden', 'schlecht'],
        URGENT_REQUEST: ['dringend', 'notfall', 'sofort', 'schnell'],
      },
      en: {
        BOOKING_INTENT: ['book', 'appointment', 'schedule', 'reserve', 'available'],
        SERVICE_INQUIRY: ['service', 'treatment', 'what', 'which', 'offer'],
        PRICING_INQUIRY: ['price', 'cost', 'how much', 'dollar', 'cheap'],
        COMPLAINT_ISSUE: ['problem', 'complaint', 'unsatisfied', 'bad'],
        URGENT_REQUEST: ['urgent', 'emergency', 'immediately', 'quickly'],
      },
      nl: {
        BOOKING_INTENT: ['afspraak', 'boeken', 'reserveren', 'inplannen', 'beschikbaar'],
        SERVICE_INQUIRY: ['service', 'behandeling', 'wat', 'welke', 'aanbod'],
        PRICING_INQUIRY: ['prijs', 'kosten', 'hoeveel', 'euro', 'goedkoop'],
        COMPLAINT_ISSUE: ['probleem', 'klacht', 'ontevreden', 'slecht'],
        URGENT_REQUEST: ['urgent', 'noodgeval', 'direct', 'snel'],
      },
      fr: {
        BOOKING_INTENT: ['rendez-vous', 'réserver', 'planifier', 'disponible'],
        SERVICE_INQUIRY: ['service', 'soin', 'quel', 'quelle', 'offre'],
        PRICING_INQUIRY: ['prix', 'coût', 'combien', 'euro', 'pas cher'],
        COMPLAINT_ISSUE: ['problème', 'plainte', 'insatisfait', 'mauvais'],
        URGENT_REQUEST: ['urgent', 'urgence', 'immédiatement', 'rapidement'],
      },
    };

    return keywordMaps[language as keyof typeof keywordMaps] || keywordMaps.en;
  }

  // =============================================================================
  // ENTITY EXTRACTION
  // =============================================================================

  private async extractEntities(
    userInput: string,
    language: string
  ): Promise<IntentRecognitionResult['extractedEntities']> {
    const entityPrompt = `
Extract structured information from this salon customer input:

Input: "${userInput}"
Language: ${language}

Extract and return JSON with:
{
  "services": ["service names mentioned"],
  "dateTime": {
    "preferredDate": "extracted date if mentioned",
    "preferredTime": "extracted time if mentioned", 
    "flexibility": "rigid|flexible|very_flexible based on language"
  },
  "customerInfo": {
    "name": "customer name if provided",
    "phone": "phone number if provided",
    "previousCustomer": true/false if indicated
  },
  "preferences": {
    "practitioner": "specific person requested",
    "location": "location preference",
    "priceRange": "budget|standard|premium based on language cues"
  }
}

Focus on salon services: massage, facial, manicure, pedicure, haircut, coloring, highlights, eyebrows, waxing, wellness treatments.

Return only valid JSON:`;

    try {
      const result = await this.model.generateContent(entityPrompt);
      const response = result.response.text().trim();
      
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        
        // Normalize and validate services
        parsed.services = this.normalizeServices(parsed.services || []);
        
        return {
          services: parsed.services,
          dateTime: {
            preferredDate: parsed.dateTime?.preferredDate,
            preferredTime: parsed.dateTime?.preferredTime,
            flexibility: parsed.dateTime?.flexibility || 'flexible',
          },
          customerInfo: {
            name: parsed.customerInfo?.name,
            phone: parsed.customerInfo?.phone,
            previousCustomer: parsed.customerInfo?.previousCustomer,
          },
          preferences: {
            practitioner: parsed.preferences?.practitioner,
            location: parsed.preferences?.location,
            priceRange: parsed.preferences?.priceRange || 'standard',
          },
        };
      }

    } catch (error) {
      console.error('Error extracting entities:', error);
    }

    // Fallback entity extraction
    return this.performFallbackEntityExtraction(userInput, language);
  }

  private performFallbackEntityExtraction(
    userInput: string,
    language: string
  ): IntentRecognitionResult['extractedEntities'] {
    const lowerInput = userInput.toLowerCase();
    
    // Extract services using mapping
    const services = this.extractServicesFromText(lowerInput, language);
    
    // Simple date/time extraction
    const dateMatch = lowerInput.match(/(\d{1,2})[\.\/\-](\d{1,2})[\.\/\-](\d{4})/);
    const timeMatch = lowerInput.match(/(\d{1,2}):(\d{2})/);
    
    return {
      services,
      dateTime: {
        preferredDate: dateMatch ? dateMatch[0] : undefined,
        preferredTime: timeMatch ? timeMatch[0] : undefined,
        flexibility: 'flexible',
      },
      customerInfo: {
        previousCustomer: undefined,
      },
      preferences: {
        priceRange: 'standard',
      },
    };
  }

  private extractServicesFromText(text: string, language: string): string[] {
    const services: string[] = [];
    
    for (const [serviceKey, serviceData] of Object.entries(this.serviceMapping)) {
      if (serviceData.aliases.some(alias => text.includes(alias.toLowerCase()))) {
        services.push(serviceKey);
      }
    }
    
    return services;
  }

  private normalizeServices(services: string[]): string[] {
    return services
      .map(service => {
        const normalized = service.toLowerCase().trim();
        
        // Map to standard service names
        if (normalized.includes('massage')) return 'massage';
        if (normalized.includes('facial') || normalized.includes('gesicht')) return 'facial';
        if (normalized.includes('manicure') || normalized.includes('maniküre')) return 'manicure';
        if (normalized.includes('pedicure') || normalized.includes('pediküre')) return 'pedicure';
        if (normalized.includes('hair') || normalized.includes('haar')) return 'haircut';
        if (normalized.includes('color') || normalized.includes('färb')) return 'hair_coloring';
        if (normalized.includes('eyebrow') || normalized.includes('augenbraue')) return 'eyebrow_shaping';
        if (normalized.includes('wax') || normalized.includes('wachs')) return 'waxing';
        
        return service;
      })
      .filter(service => service.length > 0);
  }

  // =============================================================================
  // EMOTIONAL TONE ANALYSIS
  // =============================================================================

  private async analyzeEmotionalTone(
    userInput: string,
    language: string
  ): Promise<'positive' | 'neutral' | 'negative' | 'frustrated' | 'excited'> {
    const lowerInput = userInput.toLowerCase();
    
    // Language-specific emotional indicators
    const emotionalMarkers = {
      frustrated: ['angry', 'frustrated', 'annoyed', 'upset', 'disappointed', 'ärgerlich', 'frustriert', 'énervé'],
      excited: ['excited', 'amazing', 'wonderful', 'great', 'fantastic', 'super', 'fantastisch', 'formidable'],
      positive: ['happy', 'pleased', 'satisfied', 'good', 'nice', 'zufrieden', 'gut', 'content'],
      negative: ['bad', 'terrible', 'awful', 'disappointed', 'schlecht', 'schrecklich', 'mauvais'],
    };

    for (const [emotion, markers] of Object.entries(emotionalMarkers)) {
      if (markers.some(marker => lowerInput.includes(marker))) {
        return emotion as any;
      }
    }

    // Check for question marks (neutral curiosity) vs exclamation marks (excited/frustrated)
    if (userInput.includes('!')) {
      return lowerInput.includes('great') || lowerInput.includes('super') ? 'excited' : 'frustrated';
    }

    return 'neutral';
  }

  // =============================================================================
  // BUSINESS CONTEXT ANALYSIS
  // =============================================================================

  private async analyzeBusinessContext(
    userInput: string,
    intent: string,
    context: ConversationContext
  ): Promise<{ category: IntentRecognitionResult['businessCategory']; urgency: IntentRecognitionResult['urgencyLevel'] }> {
    
    // Map intent to business category
    const categoryMapping: Record<string, IntentRecognitionResult['businessCategory']> = {
      'BOOKING_INTENT': 'booking',
      'SERVICE_INQUIRY': 'service_inquiry',
      'PRICING_INQUIRY': 'service_inquiry',
      'MODIFICATION_REQUEST': 'support',
      'COMPLAINT_ISSUE': 'complaint',
      'URGENT_REQUEST': 'support',
      'UPSELL_INTEREST': 'upsell_opportunity',
      'PRACTITIONER_REQUEST': 'booking',
      'GENERAL_INFORMATION': 'service_inquiry',
    };

    const category = categoryMapping[intent] || 'service_inquiry';

    // Determine urgency level
    let urgency: IntentRecognitionResult['urgencyLevel'] = 'low';
    
    const lowerInput = userInput.toLowerCase();
    if (lowerInput.includes('urgent') || lowerInput.includes('emergency') || 
        lowerInput.includes('dringend') || lowerInput.includes('notfall')) {
      urgency = 'critical';
    } else if (lowerInput.includes('soon') || lowerInput.includes('today') || 
               lowerInput.includes('bald') || lowerInput.includes('heute')) {
      urgency = 'high';
    } else if (intent === 'COMPLAINT_ISSUE' || intent === 'MODIFICATION_REQUEST') {
      urgency = 'medium';
    }

    return { category, urgency };
  }

  // =============================================================================
  // UPSELLING OPPORTUNITY ANALYSIS
  // =============================================================================

  private async analyzeUpsellOpportunities(
    userInput: string,
    entities: IntentRecognitionResult['extractedEntities'],
    context: ConversationContext
  ): Promise<IntentRecognitionResult['upsellOpportunities']> {
    const opportunities: IntentRecognitionResult['upsellOpportunities'] = [];
    
    // Analyze requested services for upsell potential
    for (const service of entities.services) {
      const serviceData = this.serviceMapping[service];
      if (serviceData && serviceData.upsellServices.length > 0) {
        
        // Check if customer hasn't already mentioned upsell services
        const availableUpsells = serviceData.upsellServices.filter(
          upsell => !entities.services.includes(upsell)
        );

        if (availableUpsells.length > 0) {
          opportunities.push({
            opportunity: `Complement ${service} with additional treatments`,
            confidence: this.calculateUpsellConfidence(service, entities, context),
            suggestedServices: availableUpsells,
            businessJustification: `Customers who book ${service} often benefit from ${availableUpsells.join(', ')}`,
          });
        }
      }
    }

    // Time-based upselling (if booking for longer slot)
    if (entities.dateTime.preferredTime && entities.services.length === 1) {
      opportunities.push({
        opportunity: 'Extended wellness session',
        confidence: 0.6,
        suggestedServices: ['relaxation_package', 'wellness_combo'],
        businessJustification: 'Single service booking has potential for package upgrade',
      });
    }

    // Customer loyalty-based upselling
    if (context.customerProfile?.loyaltyLevel === 'high') {
      opportunities.push({
        opportunity: 'Premium service upgrade',
        confidence: 0.8,
        suggestedServices: ['premium_treatment', 'luxury_package'],
        businessJustification: 'Loyal customer eligible for premium service recommendations',
      });
    }

    return opportunities.slice(0, 3); // Limit to top 3 opportunities
  }

  private calculateUpsellConfidence(
    baseService: string,
    entities: IntentRecognitionResult['extractedEntities'],
    context: ConversationContext
  ): number {
    let confidence = 0.5; // Base confidence

    // Increase confidence based on service synergy
    const serviceData = this.serviceMapping[baseService];
    if (serviceData?.category === 'wellness' || serviceData?.category === 'massage') {
      confidence += 0.2; // Wellness services have higher upsell potential
    }

    // Increase confidence based on price range preference
    if (entities.preferences.priceRange === 'premium') {
      confidence += 0.3;
    } else if (entities.preferences.priceRange === 'standard') {
      confidence += 0.1;
    }

    // Increase confidence based on conversation context
    if (context.conversationHistory.some(h => h.text.toLowerCase().includes('package'))) {
      confidence += 0.2;
    }

    return Math.min(confidence, 1);
  }

  // =============================================================================
  // CONVERSATION FLOW MANAGEMENT
  // =============================================================================

  private determineConversationStage(
    context: ConversationContext,
    currentIntent: string
  ): IntentRecognitionResult['conversationStage'] {
    
    if (context.turnNumber <= 2) {
      return 'greeting';
    }

    if (currentIntent === 'SERVICE_INQUIRY' || currentIntent === 'PRICING_INQUIRY') {
      return 'needs_assessment';
    }

    if (currentIntent === 'BOOKING_INTENT' && 
        !context.previousIntents.includes('BOOKING_INTENT')) {
      return 'information_gathering';
    }

    if (context.previousIntents.includes('BOOKING_INTENT') && 
        currentIntent === 'BOOKING_INTENT') {
      return 'decision_making';
    }

    if (currentIntent === 'GREETING_SOCIAL' && context.turnNumber > 5) {
      return 'closing';
    }

    return 'needs_assessment';
  }

  private async generateNextAction(
    intent: string,
    stage: IntentRecognitionResult['conversationStage'],
    context: ConversationContext
  ): Promise<string> {
    const actionMap: Record<string, Record<string, string>> = {
      'BOOKING_INTENT': {
        'needs_assessment': 'Ask about preferred services and timing',
        'information_gathering': 'Collect contact details and confirm appointment',
        'decision_making': 'Present available slots and pricing',
        'closing': 'Confirm booking and provide next steps',
      },
      'SERVICE_INQUIRY': {
        'needs_assessment': 'Provide detailed service information',
        'information_gathering': 'Ask about specific needs and preferences',
        'decision_making': 'Suggest most suitable services',
      },
      'COMPLAINT_ISSUE': {
        'greeting': 'Listen actively and show empathy',
        'needs_assessment': 'Gather details about the issue',
        'information_gathering': 'Explore resolution options',
        'decision_making': 'Present compensation or solution',
      },
    };

    return actionMap[intent]?.[stage] || 'Continue natural conversation flow';
  }

  private async generateSuggestedResponses(
    intent: string,
    language: string,
    entities: IntentRecognitionResult['extractedEntities'],
    emotionalTone: string
  ): Promise<string[]> {
    const responses: string[] = [];

    // Language-specific response templates
    const templates = this.getResponseTemplates(language);
    
    if (intent === 'BOOKING_INTENT') {
      responses.push(templates.booking.initial);
      if (entities.services.length > 0) {
        responses.push(templates.booking.withService.replace('{service}', entities.services[0]));
      }
    } else if (intent === 'SERVICE_INQUIRY') {
      responses.push(templates.inquiry.general);
      responses.push(templates.inquiry.detailed);
    } else if (intent === 'COMPLAINT_ISSUE') {
      responses.push(templates.complaint.empathy);
      responses.push(templates.complaint.solution);
    }

    // Adjust for emotional tone
    if (emotionalTone === 'frustrated') {
      responses.unshift(templates.emotional.frustrated);
    } else if (emotionalTone === 'excited') {
      responses.unshift(templates.emotional.excited);
    }

    return responses.slice(0, 3);
  }

  private getResponseTemplates(language: string): any {
    const templates = {
      de: {
        booking: {
          initial: 'Gerne helfe ich Ihnen bei der Terminbuchung. Welche Behandlung interessiert Sie?',
          withService: 'Perfekt! Für {service} habe ich mehrere Termine verfügbar. Wann würde Ihnen am besten passen?',
        },
        inquiry: {
          general: 'Ich erkläre Ihnen gerne unsere Behandlungen. Was interessiert Sie besonders?',
          detailed: 'Lassen Sie mich Ihnen die Details zu unseren Services erklären.',
        },
        complaint: {
          empathy: 'Es tut mir sehr leid, dass Sie unzufrieden sind. Erzählen Sie mir bitte, was passiert ist.',
          solution: 'Ich verstehe Ihr Anliegen. Lassen Sie uns gemeinsam eine Lösung finden.',
        },
        emotional: {
          frustrated: 'Ich merke, dass Sie frustriert sind. Ich bin hier, um Ihnen zu helfen.',
          excited: 'Ich freue mich über Ihre Begeisterung! Lassen Sie uns das perfekte Angebot finden.',
        },
      },
      en: {
        booking: {
          initial: 'I\'d be happy to help you book an appointment. Which treatment are you interested in?',
          withService: 'Perfect! For {service} I have several appointments available. When would work best for you?',
        },
        inquiry: {
          general: 'I\'d be happy to explain our treatments. What are you particularly interested in?',
          detailed: 'Let me give you the details about our services.',
        },
        complaint: {
          empathy: 'I\'m very sorry that you\'re unsatisfied. Please tell me what happened.',
          solution: 'I understand your concern. Let\'s work together to find a solution.',
        },
        emotional: {
          frustrated: 'I can sense your frustration. I\'m here to help you.',
          excited: 'I love your enthusiasm! Let\'s find the perfect service for you.',
        },
      },
    };

    return templates[language as keyof typeof templates] || templates.en;
  }

  // =============================================================================
  // SERVICE MAPPING AND CONFIGURATION
  // =============================================================================

  private initializeServiceMapping(): ServiceMapping {
    return {
      'massage': {
        aliases: ['massage', 'körpermassage', 'entspannung', 'relaxation'],
        category: 'massage',
        duration: 60,
        price: 80,
        upsellServices: ['facial', 'wellness_package'],
      },
      'facial': {
        aliases: ['facial', 'gesichtsbehandlung', 'hautpflege', 'skin care'],
        category: 'skin',
        duration: 75,
        price: 90,
        upsellServices: ['eyebrow_shaping', 'skin_analysis'],
      },
      'manicure': {
        aliases: ['manicure', 'maniküre', 'nagelpflege', 'nail care'],
        category: 'nails',
        duration: 45,
        price: 40,
        upsellServices: ['pedicure', 'nail_art'],
      },
      'pedicure': {
        aliases: ['pedicure', 'pediküre', 'fußpflege', 'foot care'],
        category: 'nails',
        duration: 60,
        price: 50,
        upsellServices: ['manicure', 'foot_massage'],
      },
      'haircut': {
        aliases: ['haircut', 'haarschnitt', 'schneiden', 'trim'],
        category: 'hair',
        duration: 30,
        price: 45,
        upsellServices: ['hair_coloring', 'hair_styling'],
      },
      'hair_coloring': {
        aliases: ['coloring', 'färben', 'highlights', 'tinting'],
        category: 'hair',
        duration: 120,
        price: 120,
        upsellServices: ['haircut', 'hair_treatment'],
        prerequisites: ['haircut'],
      },
    };
  }

  // =============================================================================
  // DATA PERSISTENCE AND LEARNING
  // =============================================================================

  private async storeIntentHistory(
    sessionId: string,
    userInput: string,
    result: IntentRecognitionResult
  ): Promise<void> {
    try {
      const historyEntry = {
        sessionId,
        timestamp: new Date().toISOString(),
        userInput,
        recognizedIntent: result.primaryIntent,
        confidence: result.confidence,
        businessCategory: result.businessCategory,
        extractedEntities: result.extractedEntities,
      };

      await this.redis.lpush(
        `intent:history:${sessionId}`,
        JSON.stringify(historyEntry)
      );

      // Keep last 50 entries
      await this.redis.ltrim(`intent:history:${sessionId}`, 0, 49);
      await this.redis.expire(`intent:history:${sessionId}`, 86400); // 24 hours

    } catch (error) {
      console.error('Error storing intent history:', error);
    }
  }

  private async updateConversationContext(
    context: ConversationContext,
    userInput: string,
    result: IntentRecognitionResult
  ): Promise<void> {
    // Add current turn to history
    context.conversationHistory.push({
      speaker: 'user',
      text: userInput,
      intent: result.primaryIntent,
      timestamp: new Date(),
    });

    // Update previous intents
    context.previousIntents.push(result.primaryIntent);
    if (context.previousIntents.length > 10) {
      context.previousIntents = context.previousIntents.slice(-10);
    }

    context.turnNumber++;
  }

  private createFallbackResult(userInput: string, language: string): IntentRecognitionResult {
    return {
      primaryIntent: 'GENERAL_INFORMATION',
      confidence: 0.3,
      subIntents: [],
      businessCategory: 'service_inquiry',
      urgencyLevel: 'low',
      emotionalTone: 'neutral',
      extractedEntities: {
        services: [],
        dateTime: { flexibility: 'flexible' },
        customerInfo: {},
        preferences: { priceRange: 'standard' },
      },
      conversationStage: 'needs_assessment',
      nextRecommendedAction: 'Provide general assistance',
      suggestedResponses: [
        language === 'de' 
          ? 'Wie kann ich Ihnen heute helfen?'
          : 'How can I help you today?'
      ],
      upsellOpportunities: [],
    };
  }

  // =============================================================================
  // PUBLIC API METHODS
  // =============================================================================

  async getIntentStatistics(sessionId: string): Promise<{
    totalIntents: number;
    intentDistribution: Record<string, number>;
    averageConfidence: number;
  }> {
    try {
      const history = await this.redis.lrange(`intent:history:${sessionId}`, 0, -1);
      const entries = history.map(entry => JSON.parse(entry));

      const intentCounts: Record<string, number> = {};
      let totalConfidence = 0;

      entries.forEach(entry => {
        intentCounts[entry.recognizedIntent] = (intentCounts[entry.recognizedIntent] || 0) + 1;
        totalConfidence += entry.confidence;
      });

      return {
        totalIntents: entries.length,
        intentDistribution: intentCounts,
        averageConfidence: entries.length > 0 ? totalConfidence / entries.length : 0,
      };

    } catch (error) {
      console.error('Error getting intent statistics:', error);
      return { totalIntents: 0, intentDistribution: {}, averageConfidence: 0 };
    }
  }
}

// Create singleton instance
let advancedIntentEngine: AdvancedIntentEngine | null = null;

export function getAdvancedIntentEngine(): AdvancedIntentEngine {
  if (!advancedIntentEngine) {
    advancedIntentEngine = new AdvancedIntentEngine();
  }
  return advancedIntentEngine;
}

export { AdvancedIntentEngine };
export default AdvancedIntentEngine;