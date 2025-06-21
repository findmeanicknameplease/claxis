import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { config } from '@/lib/config';

// =============================================================================
// GEMINI 2.5 FLASH AI CLIENT
// =============================================================================
// Advanced Gemini 2.5 Flash integration for complex salon automation tasks
// - Advanced intent detection and classification
// - Complex multi-step reasoning and booking flows
// - Marketing automation and customer intelligence
// - Image analysis for Instagram posts and customer content
// - Used for Professional/Enterprise tier complex tasks
// =============================================================================

export interface IntentResult {
  intent: 'booking' | 'question' | 'complaint' | 'compliment' | 'other';
  confidence: number;
  entities: {
    service?: string;
    datetime?: string;
    customer_name?: string;
    phone_number?: string;
    email?: string;
  };
  language: 'de' | 'en' | 'nl' | 'fr';
  suggested_response?: string;
  requires_human?: boolean;
}

export interface ImageAnalysis {
  description: string;
  services_detected: string[];
  quality_score: number; // 0-1
  booking_potential: 'low' | 'medium' | 'high';
  hashtag_suggestions: string[];
  caption_suggestions: {
    de: string;
    en: string;
    nl: string;
    fr: string;
  };
}

export interface ConversationContext {
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
    booking_url?: string;
  };
}

export interface ResponseGenerationOptions {
  language: 'de' | 'en' | 'nl' | 'fr';
  tone: 'professional' | 'friendly' | 'casual';
  include_booking_cta: boolean;
  max_length: number;
  context: ConversationContext;
}

class GeminiAdvancedClient {
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;
  private visionModel: GenerativeModel;
  
  constructor(apiKey?: string) {
    const key = apiKey ?? config.GEMINI_API_KEY;
    if (!key || key.length === 0) {
      throw new Error('Gemini API key is required. Please set GEMINI_API_KEY in your environment variables.');
    }
    
    // Initialize real Gemini 2.5 Flash API
    this.genAI = new GoogleGenerativeAI(key);
    
    // Text generation model for complex reasoning and conversation
    this.model = this.genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp', // Use available Gemini 2.0 Flash model
      generationConfig: {
        temperature: 0.8,
        topP: 0.9,
        topK: 50,
        maxOutputTokens: 1024, // Higher for complex tasks
      }
    });
    
    // Vision model for image analysis (Instagram content analysis)
    this.visionModel = this.genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp', // Use available model with vision capabilities
      generationConfig: {
        temperature: 0.7,
        topP: 0.8,
        topK: 40,
        maxOutputTokens: 512,
      }
    });
  }

  // =============================================================================
  // INTENT DETECTION AND CLASSIFICATION
  // =============================================================================

  async processIntent(message: string, context?: Partial<ConversationContext>): Promise<IntentResult> {
    try {
      const prompt = this.buildIntentPrompt(message, context);
      const result = await this.model.generateContent(prompt);
      const response = result.response.text();
      
      return this.parseIntentResponse(response, message);
    } catch (error) {
      console.error('Error processing intent:', error);
      return this.fallbackIntentResult(message);
    }
  }

  private buildIntentPrompt(message: string, context?: Partial<ConversationContext>): string {
    const languages = context?.salon_info?.languages || ['de', 'en'];
    const services = context?.salon_info?.services || [];
    
    return `
You are an AI assistant for a premium European beauty salon. Analyze this customer message and extract booking intent.

CUSTOMER MESSAGE: "${message}"

SALON CONTEXT:
- Languages: ${languages.join(', ')}
- Services: ${services.join(', ')}
- Platform: ${context?.platform || 'unknown'}

INSTRUCTIONS:
1. Classify the intent: booking, question, complaint, compliment, other
2. Extract entities: service, datetime, customer_name, phone_number, email
3. Detect language: de, en, nl, fr
4. Assign confidence score 0.0-1.0
5. Determine if human assistance is needed

Respond in this exact JSON format:
{
  "intent": "booking|question|complaint|compliment|other",
  "confidence": 0.85,
  "entities": {
    "service": "haircut",
    "datetime": "tomorrow 2pm",
    "customer_name": "Maria",
    "phone_number": "+49...",
    "email": "maria@email.com"
  },
  "language": "de",
  "requires_human": false
}

Only include entities that are explicitly mentioned. Use null for missing entities.
`;
  }

  private parseIntentResponse(response: string, originalMessage: string): IntentResult {
    try {
      // Extract JSON from response
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
        requires_human: parsed.requires_human || false,
      };
    } catch (error) {
      console.error('Error parsing intent response:', error);
      return this.fallbackIntentResult(originalMessage);
    }
  }

  private fallbackIntentResult(message: string): IntentResult {
    // Basic keyword-based fallback
    const bookingKeywords = ['book', 'appointment', 'termin', 'buchen', 'réserver', 'afspraak'];
    const hasBookingKeyword = bookingKeywords.some(keyword => 
      message.toLowerCase().includes(keyword)
    );
    
    return {
      intent: hasBookingKeyword ? 'booking' : 'question',
      confidence: hasBookingKeyword ? 0.7 : 0.3,
      entities: {},
      language: 'en',
      requires_human: true,
    };
  }

  // =============================================================================
  // RESPONSE GENERATION
  // =============================================================================

  async generateResponse(options: ResponseGenerationOptions): Promise<string> {
    try {
      const prompt = this.buildResponsePrompt(options);
      const result = await this.model.generateContent(prompt);
      const response = result.response.text();
      
      return this.cleanupResponse(response, options.max_length);
    } catch (error) {
      console.error('Error generating response:', error);
      return this.fallbackResponse(options.language);
    }
  }

  private buildResponsePrompt(options: ResponseGenerationOptions): string {
    const { language, tone, include_booking_cta, context } = options;
    const lastMessage = context.conversation_history[context.conversation_history.length - 1];
    
    const languageInstructions = {
      de: 'Antworte auf Deutsch, professionell und höflich.',
      en: 'Respond in English, professionally and politely.',
      nl: 'Antwoord in het Nederlands, professioneel en beleefd.',
      fr: 'Répondez en français, de manière professionnelle et polie.',
    };
    
    return `
You are a customer service AI for "${context.salon_info.name}", a premium European beauty salon.

CUSTOMER'S LAST MESSAGE: "${lastMessage?.content || ''}"

CONVERSATION HISTORY:
${context.conversation_history.slice(-3).map(msg => 
  `${msg.role}: ${msg.content}`
).join('\n')}

SALON INFORMATION:
- Services: ${context.salon_info.services.join(', ')}
- Business Hours: ${JSON.stringify(context.salon_info.business_hours)}
- Booking URL: ${context.salon_info.booking_url || 'N/A'}

INSTRUCTIONS:
- ${languageInstructions[language]}
- Tone: ${tone}
- Maximum length: ${options.max_length} characters
- ${include_booking_cta ? 'Include a clear call-to-action for booking' : 'Do not push for booking'}
- Focus on being helpful and answering their specific question
- If they want to book, guide them to the booking process
- Mention specific services when relevant

Respond naturally and conversationally:
`;
  }

  private cleanupResponse(response: string, maxLength: number): string {
    // Remove any AI meta-commentary
    let cleaned = response
      .replace(/^(Here's|Here is|I'll|I will|Let me).*/i, '')
      .replace(/As an AI.*/i, '')
      .trim();
    
    // Truncate if too long
    if (cleaned.length > maxLength) {
      cleaned = cleaned.substring(0, maxLength - 3) + '...';
    }
    
    return cleaned;
  }

  private fallbackResponse(language: 'de' | 'en' | 'nl' | 'fr'): string {
    const responses = {
      de: 'Vielen Dank für Ihre Nachricht! Unser Team wird Ihnen bald antworten.',
      en: 'Thank you for your message! Our team will respond to you soon.',
      nl: 'Bedankt voor je bericht! Ons team zal je snel antwoorden.',
      fr: 'Merci pour votre message! Notre équipe vous répondra bientôt.',
    };
    
    return responses[language];
  }

  // =============================================================================
  // IMAGE ANALYSIS
  // =============================================================================

  async analyzeImage(imageUrl: string, context?: { salon_services?: string[] }): Promise<ImageAnalysis> {
    try {
      const prompt = this.buildImageAnalysisPrompt(context?.salon_services || []);
      
      // Convert image URL to base64 or use direct URL
      const imagePart = {
        inlineData: {
          data: await this.imageUrlToBase64(imageUrl),
          mimeType: 'image/jpeg'
        }
      };
      
      const result = await this.visionModel.generateContent([prompt, imagePart]);
      const response = result.response.text();
      
      return this.parseImageAnalysis(response);
    } catch (error) {
      console.error('Error analyzing image:', error);
      return this.fallbackImageAnalysis();
    }
  }

  private buildImageAnalysisPrompt(salonServices: string[]): string {
    return `
Analyze this beauty salon image. Identify:

1. What beauty services are shown or could be promoted?
2. Overall image quality and professional appearance (0-1 score)
3. Potential for generating booking inquiries (low/medium/high)
4. Relevant hashtags for social media
5. Caption suggestions in German, English, Dutch, and French

SALON SERVICES CONTEXT: ${salonServices.join(', ')}

Respond in this JSON format:
{
  "description": "Beautiful hair transformation with highlights",
  "services_detected": ["hair coloring", "highlights"],
  "quality_score": 0.85,
  "booking_potential": "high",
  "hashtag_suggestions": ["#haircolor", "#highlights", "#salonlife"],
  "caption_suggestions": {
    "de": "Wunderschöne Haartransformation! Buchen Sie Ihren Termin.",
    "en": "Beautiful hair transformation! Book your appointment.",
    "nl": "Prachtige haartransformatie! Boek je afspraak.",
    "fr": "Belle transformation capillaire! Réservez votre rendez-vous."
  }
}
`;
  }

  private async imageUrlToBase64(url: string): Promise<string> {
    try {
      const response = await fetch(url);
      const buffer = await response.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');
      return base64;
    } catch (error) {
      console.error('Error converting image to base64:', error);
      throw error;
    }
  }

  private parseImageAnalysis(response: string): ImageAnalysis {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in image analysis response');
      }
      
      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.error('Error parsing image analysis:', error);
      return this.fallbackImageAnalysis();
    }
  }

  private fallbackImageAnalysis(): ImageAnalysis {
    return {
      description: 'Beauty salon image',
      services_detected: [],
      quality_score: 0.5,
      booking_potential: 'medium',
      hashtag_suggestions: ['#beauty', '#salon'],
      caption_suggestions: {
        de: 'Schönheit und Pflege in unserem Salon!',
        en: 'Beauty and care at our salon!',
        nl: 'Schoonheid en verzorging in onze salon!',
        fr: 'Beauté et soins dans notre salon!',
      },
    };
  }

  // =============================================================================
  // COST TRACKING AND ANALYTICS
  // =============================================================================

  async estimateTokenCost(text: string): Promise<{ inputTokens: number; estimatedCost: number }> {
    // Rough estimation: ~4 characters per token
    const inputTokens = Math.ceil(text.length / 4);
    
    // Gemini 2.5 Flash pricing: ~$0.075 per 1K input tokens (same as Flash)
    const estimatedCost = (inputTokens / 1000) * 0.075;
    
    return {
      inputTokens,
      estimatedCost,
    };
  }

  // =============================================================================
  // HEALTH CHECK
  // =============================================================================

  async healthCheck(): Promise<{ status: 'healthy' | 'error'; details?: string }> {
    try {
      const result = await this.model.generateContent('Hello');
      const response = result.response.text();
      
      if (response && response.length > 0) {
        return { status: 'healthy' };
      } else {
        return { status: 'error', details: 'Empty response from Gemini' };
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

let geminiAdvancedClient: GeminiAdvancedClient | null = null;

export function getGeminiClient(): GeminiAdvancedClient {
  if (!geminiAdvancedClient) {
    geminiAdvancedClient = new GeminiAdvancedClient();
  }
  return geminiAdvancedClient;
}

// Keep legacy export for compatibility
export { GeminiAdvancedClient, GeminiAdvancedClient as GeminiFlashClient };
export default GeminiAdvancedClient;
