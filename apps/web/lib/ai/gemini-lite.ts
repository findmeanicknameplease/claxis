import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { config } from '@/lib/config';

// =============================================================================
// GEMINI 2.5 FLASH LITE PREVIEW CLIENT
// =============================================================================
// Fast, cost-effective model for basic daily tasks
// - WhatsApp/Instagram simple conversations
// - Basic intent detection
// - Simple response generation
// - Cost-optimized for high-volume daily operations
// - Perfect for Free and Professional tier basic interactions
// =============================================================================

export interface LiteIntentResult {
  intent: 'booking' | 'question' | 'complaint' | 'compliment' | 'other';
  confidence: number;
  entities: {
    service?: string;
    datetime?: string;
    customer_name?: string;
    phone_number?: string;
  };
  language: 'de' | 'en' | 'nl' | 'fr';
  requires_escalation?: boolean;
}

export interface SimpleResponseOptions {
  language: 'de' | 'en' | 'nl' | 'fr';
  tone: 'friendly' | 'professional';
  include_booking_cta: boolean;
  max_length: number;
  salon_context: {
    name: string;
    services: string[];
  };
}

class GeminiLiteClient {
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;
  
  constructor(apiKey?: string) {
    const key = apiKey ?? config.GEMINI_API_KEY;
    if (!key || key.length === 0) {
      throw new Error('Gemini API key is required. Please set GEMINI_API_KEY in your environment variables.');
    }
    
    // Initialize real Gemini 2.5 Flash Lite API
    this.genAI = new GoogleGenerativeAI(key);
    
    // Use Flash Lite model for cost-optimized basic operations
    this.model = this.genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp', // Use available model, Lite preview may not be accessible
      generationConfig: {
        temperature: 0.7,
        topP: 0.8,
        topK: 40,
        maxOutputTokens: 256, // Shorter responses for efficiency
      }
    });
  }

  // =============================================================================
  // BASIC INTENT DETECTION (Lite)
  // =============================================================================

  async detectBasicIntent(message: string, salonName: string): Promise<LiteIntentResult> {
    try {
      const prompt = this.buildBasicIntentPrompt(message, salonName);
      const result = await this.model.generateContent(prompt);
      const response = result.response.text();
      
      return this.parseBasicIntentResponse(response, message);
    } catch (error) {
      console.error('Error in basic intent detection:', error);
      return this.fallbackBasicIntent(message);
    }
  }

  private buildBasicIntentPrompt(message: string, salonName: string): string {
    return `
Analyze this customer message for ${salonName}. Respond with simple JSON only.

MESSAGE: "${message}"

Classify intent as: booking, question, complaint, compliment, other
Extract: service, datetime, customer_name, phone_number (if mentioned)
Detect language: de, en, nl, fr

JSON response:
{
  "intent": "booking",
  "confidence": 0.8,
  "entities": {"service": "haircut", "datetime": "tomorrow"},
  "language": "en",
  "requires_escalation": false
}`;
  }

  private parseBasicIntentResponse(response: string, originalMessage: string): LiteIntentResult {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      
      const parsed = JSON.parse(jsonMatch[0]);
      
      return {
        intent: parsed.intent || 'other',
        confidence: parsed.confidence || 0.5,
        entities: parsed.entities || {},
        language: parsed.language || 'en',
        requires_escalation: parsed.requires_escalation || false,
      };
    } catch (error) {
      console.error('Error parsing basic intent response:', error);
      return this.fallbackBasicIntent(originalMessage);
    }
  }

  private fallbackBasicIntent(message: string): LiteIntentResult {
    const bookingKeywords = ['book', 'appointment', 'termin', 'buchen', 'réserver', 'afspraak'];
    const hasBookingKeyword = bookingKeywords.some(keyword => 
      message.toLowerCase().includes(keyword)
    );
    
    return {
      intent: hasBookingKeyword ? 'booking' : 'question',
      confidence: hasBookingKeyword ? 0.7 : 0.3,
      entities: {},
      language: 'en',
      requires_escalation: false,
    };
  }

  // =============================================================================
  // SIMPLE RESPONSE GENERATION (Lite)
  // =============================================================================

  async generateSimpleResponse(options: SimpleResponseOptions, customerMessage: string): Promise<string> {
    try {
      const prompt = this.buildSimpleResponsePrompt(options, customerMessage);
      const result = await this.model.generateContent(prompt);
      const response = result.response.text();
      
      return this.cleanupSimpleResponse(response, options.max_length);
    } catch (error) {
      console.error('Error generating simple response:', error);
      return this.fallbackSimpleResponse(options.language, options.salon_context.name);
    }
  }

  private buildSimpleResponsePrompt(options: SimpleResponseOptions, customerMessage: string): string {
    const { language, tone, include_booking_cta, salon_context } = options;
    
    const languageInstructions = {
      de: 'Antworte kurz auf Deutsch.',
      en: 'Respond briefly in English.',
      nl: 'Antwoord kort in het Nederlands.',
      fr: 'Répondez brièvement en français.',
    };

    const toneInstructions = {
      friendly: 'Be warm and welcoming.',
      professional: 'Be polite and professional.',
    };
    
    return `
You are customer service for "${salon_context.name}" beauty salon.

CUSTOMER: "${customerMessage}"

SERVICES: ${salon_context.services.slice(0, 5).join(', ')}

INSTRUCTIONS:
- ${languageInstructions[language]}
- ${toneInstructions[tone]}
- Maximum 2 sentences
- ${include_booking_cta ? 'Suggest booking if appropriate' : 'Just be helpful'}

Respond naturally:`;
  }

  private cleanupSimpleResponse(response: string, maxLength: number): string {
    // Remove AI meta-commentary
    let cleaned = response
      .replace(/^(Here's|Here is|I'll|I will|Let me).*/i, '')
      .replace(/As an AI.*/i, '')
      .trim();
    
    // Ensure it starts with a capital letter
    if (cleaned.length > 0) {
      cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    }
    
    // Truncate if too long
    if (cleaned.length > maxLength) {
      cleaned = cleaned.substring(0, maxLength - 3) + '...';
    }
    
    return cleaned;
  }

  private fallbackSimpleResponse(language: 'de' | 'en' | 'nl' | 'fr', salonName: string): string {
    const responses = {
      de: `Vielen Dank für Ihre Nachricht! Wie kann ich Ihnen bei ${salonName} helfen?`,
      en: `Thank you for your message! How can I help you at ${salonName}?`,
      nl: `Bedankt voor je bericht! Hoe kan ik je helpen bij ${salonName}?`,
      fr: `Merci pour votre message! Comment puis-je vous aider chez ${salonName}?`,
    };
    
    return responses[language];
  }

  // =============================================================================
  // QUICK VALIDATION (Lite)
  // =============================================================================

  async validateBookingDetails(details: {
    service?: string;
    datetime?: string;
    customer_name?: string;
    phone?: string;
  }, availableServices: string[]): Promise<{
    valid: boolean;
    missing_fields: string[];
    suggestions: string[];
  }> {
    const missing_fields: string[] = [];
    const suggestions: string[] = [];

    // Check required fields
    if (!details.service) missing_fields.push('service');
    if (!details.datetime) missing_fields.push('datetime');
    if (!details.customer_name) missing_fields.push('customer_name');
    if (!details.phone) missing_fields.push('phone');

    // Validate service against available services
    if (details.service && !availableServices.includes(details.service)) {
      const similarService = availableServices.find(service => 
        service.toLowerCase().includes(details.service!.toLowerCase()) ||
        details.service!.toLowerCase().includes(service.toLowerCase())
      );
      
      if (similarService) {
        suggestions.push(`Did you mean "${similarService}"?`);
      }
    }

    return {
      valid: missing_fields.length === 0,
      missing_fields,
      suggestions
    };
  }

  // =============================================================================
  // COST TRACKING (Lite)
  // =============================================================================

  async estimateTokenCost(text: string): Promise<{ inputTokens: number; estimatedCost: number }> {
    // Rough estimation: ~4 characters per token
    const inputTokens = Math.ceil(text.length / 4);
    
    // Gemini 2.5 Flash Lite pricing: Expected to be ~$0.025 per 1K input tokens (cheaper than Flash)
    const estimatedCost = (inputTokens / 1000) * 0.025;
    
    return {
      inputTokens,
      estimatedCost,
    };
  }

  // =============================================================================
  // HEALTH CHECK (Lite)
  // =============================================================================

  async healthCheck(): Promise<{ status: 'healthy' | 'error'; details?: string }> {
    try {
      const result = await this.model.generateContent('Test');
      const response = result.response.text();
      
      if (response && response.length > 0) {
        return { status: 'healthy' };
      } else {
        return { status: 'error', details: 'Empty response from Gemini Lite' };
      }
    } catch (error) {
      return {
        status: 'error',
        details: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

let geminiLiteClient: GeminiLiteClient | null = null;

export function getGeminiLiteClient(): GeminiLiteClient {
  if (!geminiLiteClient) {
    geminiLiteClient = new GeminiLiteClient();
  }
  return geminiLiteClient;
}

export { GeminiLiteClient };
export default GeminiLiteClient;