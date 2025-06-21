import { WebSocket } from 'ws';
import { getUpstashClient } from '@/lib/redis/upstash-client';
import { config } from '@/lib/config';

// =============================================================================
// ELEVENLABS CONVERSATIONAL AI CLIENT - ENTERPRISE VOICE INTELLIGENCE
// =============================================================================
// Real-time conversational AI with <500ms response for premium tier
// Multilingual support (DE, EN, NL, FR) with cultural context
// Advanced conversation state management and interrupt handling
// =============================================================================

export interface ElevenLabsConfig {
  apiKey: string;
  agentId: string;
  voiceId: string;
  voiceSettings: {
    stability: number;           // 0-1, voice consistency
    similarity_boost: number;    // 0-1, voice matching
    style: number;              // 0-1, speaking style
    use_speaker_boost: boolean;  // Enhanced quality
  };
  conversationConfig: {
    first_message?: string;
    language: 'de' | 'en' | 'nl' | 'fr';
    conversation_style: 'professional_friendly' | 'casual' | 'formal';
    max_conversation_length_seconds: number;
  };
}

export interface ConversationState {
  sessionId: string;
  salonId: string;
  customerPhone: string;
  language: 'de' | 'en' | 'nl' | 'fr';
  startTime: Date;
  lastActivity: Date;
  conversationContext: {
    customerName?: string;
    previousAppointments?: any[];
    currentIntent?: string;
    extractedInfo?: Record<string, any>;
    bookingInProgress?: boolean;
  };
  interruptCount: number;
  totalDuration: number;
  costEstimate: number;
}

export interface ConversationResponse {
  type: 'agent_response' | 'user_transcript' | 'conversation_end' | 'error';
  agent_response?: {
    audio_data: string;          // Base64 encoded audio
    transcript: string;          // What the AI said
    emotion?: string;            // AI emotion state
    confidence?: number;         // Response confidence
  };
  user_transcript?: {
    text: string;                // User's words
    is_final: boolean;           // Complete sentence
    confidence?: number;         // Transcription confidence
  };
  conversation_metadata?: {
    turn_id: string;
    processing_time_ms: number;
    tokens_used?: number;
    cost_estimate?: number;
  };
}

class ElevenLabsConversationalClient {
  private config: ElevenLabsConfig;
  private redis: ReturnType<typeof getUpstashClient>;
  private activeConnections: Map<string, WebSocket>;
  private conversationStates: Map<string, ConversationState>;
  private reconnectAttempts: Map<string, number>;

  constructor(config: ElevenLabsConfig) {
    this.config = config;
    this.redis = getUpstashClient();
    this.activeConnections = new Map();
    this.conversationStates = new Map();
    this.reconnectAttempts = new Map();
  }

  // =============================================================================
  // CONNECTION MANAGEMENT
  // =============================================================================

  async connectToAgent(sessionId: string, salonId: string): Promise<WebSocket> {
    try {
      console.log(`Connecting to ElevenLabs agent for session ${sessionId}`);

      // Create WebSocket connection to ElevenLabs Conversational AI
      const wsUrl = 'wss://api.elevenlabs.io/v1/convai/conversation';
      const ws = new WebSocket(wsUrl, {
        headers: {
          'xi-api-key': this.config.apiKey,
        },
      });

      // Set up connection handlers
      this.setupConnectionHandlers(ws, sessionId, salonId);

      // Wait for connection to establish
      await this.waitForConnection(ws);

      // Initialize conversation
      await this.initializeConversation(ws, sessionId, salonId);

      // Store active connection
      this.activeConnections.set(sessionId, ws);
      this.reconnectAttempts.set(sessionId, 0);

      console.log(`ElevenLabs connection established for session ${sessionId}`);
      return ws;

    } catch (error) {
      console.error(`Failed to connect to ElevenLabs for session ${sessionId}:`, error);
      throw error;
    }
  }

  private setupConnectionHandlers(ws: WebSocket, sessionId: string, salonId: string): void {
    ws.on('open', () => {
      console.log(`ElevenLabs WebSocket opened for session ${sessionId}`);
    });

    ws.on('message', async (data: Buffer) => {
      try {
        await this.handleMessage(sessionId, data);
      } catch (error) {
        console.error(`Error handling ElevenLabs message for session ${sessionId}:`, error);
      }
    });

    ws.on('close', async (code: number, reason: Buffer) => {
      console.log(`ElevenLabs WebSocket closed for session ${sessionId}: ${code} ${reason}`);
      await this.handleConnectionClose(sessionId, code);
    });

    ws.on('error', (error: Error) => {
      console.error(`ElevenLabs WebSocket error for session ${sessionId}:`, error);
    });
  }

  private async waitForConnection(ws: WebSocket, timeout: number = 10000): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, timeout);

      ws.on('open', () => {
        clearTimeout(timer);
        resolve();
      });

      ws.on('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
    });
  }

  private async initializeConversation(ws: WebSocket, sessionId: string, salonId: string): Promise<void> {
    // Get salon configuration for personalized greeting
    const salonConfig = await this.getSalonConfiguration(salonId);
    
    // Create conversation state
    const conversationState: ConversationState = {
      sessionId,
      salonId,
      customerPhone: '', // Will be updated from call context
      language: salonConfig.language || 'de',
      startTime: new Date(),
      lastActivity: new Date(),
      conversationContext: {
        currentIntent: 'greeting',
      },
      interruptCount: 0,
      totalDuration: 0,
      costEstimate: 0,
    };

    this.conversationStates.set(sessionId, conversationState);

    // Initialize ElevenLabs conversation with configuration
    const initMessage = {
      conversation_config: {
        agent_id: this.config.agentId,
        override_agent_settings: {
          language: conversationState.language,
          conversation_style: this.config.conversationConfig.conversation_style,
          voice: {
            voice_id: this.config.voiceId,
            settings: this.config.voiceSettings,
          },
          first_message: this.getLocalizedGreeting(conversationState.language, salonConfig.name),
          max_conversation_length: this.config.conversationConfig.max_conversation_length_seconds,
        },
      },
    };

    ws.send(JSON.stringify(initMessage));

    // Store conversation start in Redis
    await this.trackConversationStart(sessionId, conversationState);
  }

  private getLocalizedGreeting(language: string, salonName: string): string {
    const greetings = {
      de: `Hallo und herzlich willkommen bei ${salonName}! Ich bin Ihr virtueller Assistent. Wie kann ich Ihnen heute helfen? Sie können mir gerne Fragen zu unseren Dienstleistungen stellen oder einen Termin vereinbaren.`,
      en: `Hello and welcome to ${salonName}! I'm your virtual assistant. How can I help you today? Feel free to ask about our services or book an appointment.`,
      nl: `Hallo en welkom bij ${salonName}! Ik ben uw virtuele assistent. Hoe kan ik u vandaag helpen? U kunt gerust vragen stellen over onze diensten of een afspraak maken.`,
      fr: `Bonjour et bienvenue chez ${salonName}! Je suis votre assistant virtuel. Comment puis-je vous aider aujourd'hui? N'hésitez pas à poser des questions sur nos services ou à prendre rendez-vous.`,
    };

    return greetings[language as keyof typeof greetings] || greetings.de;
  }

  // =============================================================================
  // MESSAGE HANDLING
  // =============================================================================

  async handleMessage(sessionId: string, data: Buffer): Promise<void> {
    try {
      const message = JSON.parse(data.toString()) as ConversationResponse;
      const conversationState = this.conversationStates.get(sessionId);

      if (!conversationState) {
        console.warn(`No conversation state found for session ${sessionId}`);
        return;
      }

      // Update last activity
      conversationState.lastActivity = new Date();

      switch (message.type) {
        case 'agent_response':
          await this.handleAgentResponse(sessionId, message, conversationState);
          break;

        case 'user_transcript':
          await this.handleUserTranscript(sessionId, message, conversationState);
          break;

        case 'conversation_end':
          await this.handleConversationEnd(sessionId, conversationState);
          break;

        case 'error':
          await this.handleError(sessionId, message);
          break;
      }

      // Update conversation state
      this.conversationStates.set(sessionId, conversationState);

      // Store conversation progress
      await this.updateConversationProgress(sessionId, conversationState);

    } catch (error) {
      console.error(`Error processing ElevenLabs message for session ${sessionId}:`, error);
    }
  }

  private async handleAgentResponse(
    sessionId: string,
    message: ConversationResponse,
    state: ConversationState
  ): Promise<void> {
    if (!message.agent_response) return;

    console.log(`AI response for ${sessionId}: "${message.agent_response.transcript}"`);

    // Track AI response metrics
    if (message.conversation_metadata) {
      state.costEstimate += message.conversation_metadata.cost_estimate || 0;
      
      // Track processing time for quality monitoring
      await this.redis.lpush(
        `voice:ai_latency:${sessionId}`,
        message.conversation_metadata.processing_time_ms.toString()
      );
      await this.redis.ltrim(`voice:ai_latency:${sessionId}`, 0, 100); // Keep last 100 samples
    }

    // Analyze conversation for business intelligence
    await this.analyzeConversationContent(sessionId, message.agent_response.transcript, 'agent', state);
  }

  private async handleUserTranscript(
    sessionId: string,
    message: ConversationResponse,
    state: ConversationState
  ): Promise<void> {
    if (!message.user_transcript) return;

    const transcript = message.user_transcript;
    console.log(`User transcript for ${sessionId}: "${transcript.text}" (final: ${transcript.is_final})`);

    // Only process final transcripts for intent detection
    if (transcript.is_final) {
      // Analyze for booking intent and extract information
      await this.analyzeConversationContent(sessionId, transcript.text, 'user', state);
      
      // Handle conversation interrupts (when user speaks while AI is speaking)
      if (state.conversationContext.currentIntent === 'ai_speaking') {
        state.interruptCount++;
        console.log(`Conversation interrupt detected for session ${sessionId} (count: ${state.interruptCount})`);
      }
    }
  }

  private async analyzeConversationContent(
    sessionId: string,
    text: string,
    speaker: 'user' | 'agent',
    state: ConversationState
  ): Promise<void> {
    try {
      // Basic intent detection for salon interactions
      const lowerText = text.toLowerCase();
      let detectedIntent = state.conversationContext.currentIntent || 'general';

      // Booking-related keywords
      if (this.containsBookingKeywords(lowerText, state.language)) {
        detectedIntent = 'booking_intent';
        state.conversationContext.bookingInProgress = true;
      }

      // Service inquiry keywords
      if (this.containsServiceKeywords(lowerText, state.language)) {
        detectedIntent = 'service_inquiry';
      }

      // Emergency/urgent keywords
      if (this.containsUrgentKeywords(lowerText, state.language)) {
        detectedIntent = 'urgent_request';
      }

      // Extract booking information
      if (detectedIntent === 'booking_intent') {
        const extractedInfo = await this.extractBookingInfo(text, state.language);
        state.conversationContext.extractedInfo = {
          ...state.conversationContext.extractedInfo,
          ...extractedInfo,
        };
      }

      state.conversationContext.currentIntent = detectedIntent;

      // Store conversation turn for analytics
      await this.storeConversationTurn(sessionId, {
        speaker,
        text,
        intent: detectedIntent,
        timestamp: new Date().toISOString(),
        extractedInfo: state.conversationContext.extractedInfo,
      });

    } catch (error) {
      console.error('Error analyzing conversation content:', error);
    }
  }

  private containsBookingKeywords(text: string, language: string): boolean {
    const keywords = {
      de: ['termin', 'appointment', 'buchen', 'reservieren', 'verfügbar', 'frei', 'datum', 'zeit'],
      en: ['appointment', 'book', 'reserve', 'available', 'schedule', 'date', 'time'],
      nl: ['afspraak', 'boeken', 'reserveren', 'beschikbaar', 'datum', 'tijd'],
      fr: ['rendez-vous', 'réserver', 'disponible', 'date', 'heure'],
    };

    const langKeywords = keywords[language as keyof typeof keywords] || keywords.de;
    return langKeywords.some(keyword => text.includes(keyword));
  }

  private containsServiceKeywords(text: string, language: string): boolean {
    const keywords = {
      de: ['service', 'behandlung', 'massage', 'facial', 'maniküre', 'pediküre', 'preis', 'kosten'],
      en: ['service', 'treatment', 'massage', 'facial', 'manicure', 'pedicure', 'price', 'cost'],
      nl: ['service', 'behandeling', 'massage', 'gezichtsbehandeling', 'manicure', 'pedicure', 'prijs'],
      fr: ['service', 'traitement', 'massage', 'soin', 'manucure', 'pédicure', 'prix'],
    };

    const langKeywords = keywords[language as keyof typeof keywords] || keywords.de;
    return langKeywords.some(keyword => text.includes(keyword));
  }

  private containsUrgentKeywords(text: string, language: string): boolean {
    const keywords = {
      de: ['dringend', 'eilig', 'notfall', 'sofort', 'schnell'],
      en: ['urgent', 'emergency', 'immediately', 'quickly', 'asap'],
      nl: ['urgent', 'spoed', 'direct', 'snel'],
      fr: ['urgent', 'immédiatement', 'rapidement', 'vite'],
    };

    const langKeywords = keywords[language as keyof typeof keywords] || keywords.de;
    return langKeywords.some(keyword => text.includes(keyword));
  }

  private async extractBookingInfo(text: string, language: string): Promise<Record<string, any>> {
    // Basic extraction - in production, this would use advanced NLP
    const extractedInfo: Record<string, any> = {};

    // Extract dates (basic regex patterns)
    const datePatterns = {
      de: /(\d{1,2})\.(\d{1,2})\.(\d{4})/g,
      en: /(\d{1,2})\/(\d{1,2})\/(\d{4})/g,
      nl: /(\d{1,2})-(\d{1,2})-(\d{4})/g,
      fr: /(\d{1,2})\/(\d{1,2})\/(\d{4})/g,
    };

    const datePattern = datePatterns[language as keyof typeof datePatterns];
    const dateMatch = text.match(datePattern);
    if (dateMatch) {
      extractedInfo.preferredDate = dateMatch[0];
    }

    // Extract times
    const timePattern = /(\d{1,2}):(\d{2})/g;
    const timeMatch = text.match(timePattern);
    if (timeMatch) {
      extractedInfo.preferredTime = timeMatch[0];
    }

    // Extract service mentions
    const services = {
      de: ['massage', 'facial', 'maniküre', 'pediküre', 'haarschnitt'],
      en: ['massage', 'facial', 'manicure', 'pedicure', 'haircut'],
      nl: ['massage', 'gezichtsbehandeling', 'manicure', 'pedicure', 'knipbeurt'],
      fr: ['massage', 'soin du visage', 'manucure', 'pédicure', 'coupe'],
    };

    const langServices = services[language as keyof typeof services] || services.de;
    const mentionedServices = langServices.filter(service => 
      text.toLowerCase().includes(service)
    );

    if (mentionedServices.length > 0) {
      extractedInfo.requestedServices = mentionedServices;
    }

    return extractedInfo;
  }

  // =============================================================================
  // AUDIO HANDLING
  // =============================================================================

  async sendAudioToAgent(sessionId: string, audioData: Buffer): Promise<void> {
    const ws = this.activeConnections.get(sessionId);
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.warn(`No active ElevenLabs connection for session ${sessionId}`);
      return;
    }

    try {
      // Convert audio to expected format and send
      const audioMessage = {
        user_audio_chunk: audioData.toString('base64'),
      };

      ws.send(JSON.stringify(audioMessage));

      // Update conversation state
      const state = this.conversationStates.get(sessionId);
      if (state) {
        state.lastActivity = new Date();
        state.totalDuration = Date.now() - state.startTime.getTime();
      }

    } catch (error) {
      console.error(`Error sending audio to ElevenLabs for session ${sessionId}:`, error);
    }
  }

  async handleTranscription(
    sessionId: string,
    transcript: string,
    isFinal: boolean
  ): Promise<void> {
    const state = this.conversationStates.get(sessionId);
    if (!state) return;

    // Handle interruption logic
    if (isFinal && state.conversationContext.currentIntent === 'ai_speaking') {
      // User interrupted the AI - implement graceful handling
      await this.handleConversationInterrupt(sessionId, transcript);
    }

    // Store transcription for context preservation
    await this.storeTranscription(sessionId, transcript, isFinal);
  }

  private async handleConversationInterrupt(sessionId: string, userText: string): Promise<void> {
    console.log(`Handling conversation interrupt for session ${sessionId}: "${userText}"`);

    const ws = this.activeConnections.get(sessionId);
    if (!ws) return;

    // Send interrupt signal to ElevenLabs
    const interruptMessage = {
      type: 'conversation_interrupt',
      user_input: userText,
    };

    ws.send(JSON.stringify(interruptMessage));

    // Update conversation state
    const state = this.conversationStates.get(sessionId);
    if (state) {
      state.interruptCount++;
      state.conversationContext.currentIntent = 'interrupt_handled';
    }
  }

  // =============================================================================
  // CONVERSATION LIFECYCLE
  // =============================================================================

  private async handleConversationEnd(
    sessionId: string,
    state: ConversationState
  ): Promise<void> {
    console.log(`Conversation ended for session ${sessionId}`);

    // Calculate final metrics
    const endTime = new Date();
    const totalDuration = endTime.getTime() - state.startTime.getTime();
    
    // Store final conversation data
    const conversationSummary = {
      sessionId,
      salonId: state.salonId,
      customerPhone: state.customerPhone,
      language: state.language,
      startTime: state.startTime.toISOString(),
      endTime: endTime.toISOString(),
      totalDuration,
      interruptCount: state.interruptCount,
      finalIntent: state.conversationContext.currentIntent,
      extractedInfo: state.conversationContext.extractedInfo,
      costEstimate: state.costEstimate,
      bookingCreated: state.conversationContext.bookingInProgress,
    };

    await this.storeConversationSummary(sessionId, conversationSummary);

    // Clean up
    this.cleanup(sessionId);
  }

  private async handleError(sessionId: string, message: ConversationResponse): Promise<void> {
    console.error(`ElevenLabs error for session ${sessionId}:`, message);

    // Attempt reconnection if possible
    const attempts = this.reconnectAttempts.get(sessionId) || 0;
    if (attempts < 3) {
      console.log(`Attempting reconnection for session ${sessionId} (attempt ${attempts + 1})`);
      this.reconnectAttempts.set(sessionId, attempts + 1);
      
      // Wait before reconnecting
      setTimeout(async () => {
        try {
          const state = this.conversationStates.get(sessionId);
          if (state) {
            await this.connectToAgent(sessionId, state.salonId);
          }
        } catch (error) {
          console.error(`Reconnection failed for session ${sessionId}:`, error);
        }
      }, 2000 * Math.pow(2, attempts)); // Exponential backoff
    } else {
      console.error(`Max reconnection attempts reached for session ${sessionId}`);
      this.cleanup(sessionId);
    }
  }

  private async handleConnectionClose(sessionId: string, code: number): Promise<void> {
    console.log(`ElevenLabs connection closed for session ${sessionId} with code ${code}`);

    // Clean up after a delay to allow for potential reconnection
    setTimeout(() => {
      this.cleanup(sessionId);
    }, 5000);
  }

  private cleanup(sessionId: string): void {
    this.activeConnections.delete(sessionId);
    this.conversationStates.delete(sessionId);
    this.reconnectAttempts.delete(sessionId);
  }

  // =============================================================================
  // DATA PERSISTENCE
  // =============================================================================

  private async getSalonConfiguration(salonId: string): Promise<any> {
    // Mock salon configuration - replace with database query
    return {
      id: salonId,
      name: 'Premium Beauty Salon',
      language: 'de',
      timezone: 'Europe/Berlin',
      services: ['massage', 'facial', 'manicure', 'pedicure'],
    };
  }

  private async trackConversationStart(
    sessionId: string,
    state: ConversationState
  ): Promise<void> {
    try {
      const conversationData = {
        sessionId,
        salonId: state.salonId,
        startTime: state.startTime.toISOString(),
        language: state.language,
        status: 'active',
      };

      await this.redis.set(
        `voice:conversation:${sessionId}`,
        JSON.stringify(conversationData),
        { ex: 3600 }
      );

      // Daily conversation counter
      const today = new Date().toISOString().split('T')[0];
      await this.redis.incr(`voice:conversations:${state.salonId}:${today}`);

    } catch (error) {
      console.error('Error tracking conversation start:', error);
    }
  }

  private async updateConversationProgress(
    sessionId: string,
    state: ConversationState
  ): Promise<void> {
    try {
      const progressData = {
        sessionId,
        lastActivity: state.lastActivity.toISOString(),
        currentIntent: state.conversationContext.currentIntent,
        interruptCount: state.interruptCount,
        extractedInfo: state.conversationContext.extractedInfo,
        costEstimate: state.costEstimate,
      };

      await this.redis.set(
        `voice:progress:${sessionId}`,
        JSON.stringify(progressData),
        { ex: 1800 }
      );

    } catch (error) {
      console.error('Error updating conversation progress:', error);
    }
  }

  private async storeConversationTurn(
    sessionId: string,
    turnData: any
  ): Promise<void> {
    try {
      await this.redis.lpush(
        `voice:turns:${sessionId}`,
        JSON.stringify(turnData)
      );
      
      // Keep last 50 turns
      await this.redis.ltrim(`voice:turns:${sessionId}`, 0, 49);
      await this.redis.expire(`voice:turns:${sessionId}`, 3600);

    } catch (error) {
      console.error('Error storing conversation turn:', error);
    }
  }

  private async storeTranscription(
    sessionId: string,
    transcript: string,
    isFinal: boolean
  ): Promise<void> {
    if (!isFinal) return; // Only store final transcriptions

    try {
      const transcriptionData = {
        transcript,
        timestamp: new Date().toISOString(),
        sessionId,
      };

      await this.redis.lpush(
        `voice:transcripts:${sessionId}`,
        JSON.stringify(transcriptionData)
      );
      
      await this.redis.expire(`voice:transcripts:${sessionId}`, 3600);

    } catch (error) {
      console.error('Error storing transcription:', error);
    }
  }

  private async storeConversationSummary(
    sessionId: string,
    summary: any
  ): Promise<void> {
    try {
      await this.redis.set(
        `voice:summary:${sessionId}`,
        JSON.stringify(summary),
        { ex: 86400 } // 24 hours
      );

      // Also queue for database storage
      // This would be handled by a background worker

    } catch (error) {
      console.error('Error storing conversation summary:', error);
    }
  }

  // =============================================================================
  // PUBLIC API
  // =============================================================================

  public async getConversationState(sessionId: string): Promise<ConversationState | null> {
    return this.conversationStates.get(sessionId) || null;
  }

  public async endConversation(sessionId: string): Promise<void> {
    const ws = this.activeConnections.get(sessionId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.close();
    }

    const state = this.conversationStates.get(sessionId);
    if (state) {
      await this.handleConversationEnd(sessionId, state);
    }
  }

  public getActiveConversationsCount(): number {
    return this.activeConnections.size;
  }
}

// Create singleton instance
let elevenLabsClient: ElevenLabsConversationalClient | null = null;

export function getElevenLabsClient(): ElevenLabsConversationalClient {
  if (!elevenLabsClient) {
    const elevenLabsConfig: ElevenLabsConfig = {
      apiKey: config.ELEVENLABS_API_KEY || process.env.ELEVENLABS_API_KEY || '',
      agentId: process.env.ELEVENLABS_AGENT_ID || 'default_agent',
      voiceId: process.env.ELEVENLABS_VOICE_ID || 'premium_voice',
      voiceSettings: {
        stability: 0.7,
        similarity_boost: 0.8,
        style: 0.4,
        use_speaker_boost: true,
      },
      conversationConfig: {
        language: 'de',
        conversation_style: 'professional_friendly',
        max_conversation_length_seconds: 300, // 5 minutes max
      },
    };

    elevenLabsClient = new ElevenLabsConversationalClient(elevenLabsConfig);
  }

  return elevenLabsClient;
}

export { ElevenLabsConversationalClient };
export default ElevenLabsConversationalClient;