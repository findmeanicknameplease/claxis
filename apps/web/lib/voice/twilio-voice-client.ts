import twilio from 'twilio';
import { VoiceResponse } from 'twilio/lib/twiml/VoiceResponse';
import { config } from '@/lib/config';
import { getUpstashClient } from '@/lib/redis/upstash-client';

// =============================================================================
// TWILIO VOICE CLIENT - ENTERPRISE CALL MANAGEMENT
// =============================================================================
// Premium voice integration for €299.99/month tier
// Handles incoming/outbound calls with intelligent routing
// Spam protection and business hours validation
// =============================================================================

export interface TwilioVoiceConfig {
  accountSid: string;
  authToken: string;
  phoneNumber: string;
  websocketUrl: string;
  statusCallbackUrl: string;
  voiceGatewayUrl: string;
}

export interface CallContext {
  salonId: string;
  customerPhone: string;
  customerName?: string;
  appointmentId?: string;
  callType: 'appointment_reminder' | 'missed_call_callback' | 'marketing' | 'emergency';
  language: 'de' | 'en' | 'nl' | 'fr';
  priority: number; // 1-10, higher = more urgent
}

export interface SpamCheckResult {
  isSpam: boolean;
  riskScore: number;
  reason?: string;
  lineType?: string;
  carrier?: string;
}

export interface CallInstance {
  sid: string;
  status: string;
  direction: string;
  from: string;
  to: string;
  startTime?: Date;
  endTime?: Date;
  duration?: number;
}

class TwilioVoiceClient {
  private client: twilio.Twilio;
  private config: TwilioVoiceConfig;
  private redis: ReturnType<typeof getUpstashClient>;

  constructor(config: TwilioVoiceConfig) {
    this.config = config;
    this.client = twilio(config.accountSid, config.authToken);
    this.redis = getUpstashClient();
  }

  // =============================================================================
  // INCOMING CALL HANDLING
  // =============================================================================

  async handleIncomingCall(
    callSid: string,
    from: string,
    to: string,
    additionalParams?: Record<string, string>
  ): Promise<VoiceResponse> {
    console.log(`Handling incoming call: ${callSid} from ${from} to ${to}`);

    try {
      // Step 1: Spam protection check
      const spamCheck = await this.checkSpamStatus(from);
      if (spamCheck.isSpam) {
        console.log(`Blocking spam call from ${from}: ${spamCheck.reason}`);
        return this.rejectSpamCall(callSid, spamCheck.reason || 'Spam detected');
      }

      // Step 2: Find salon configuration
      const salonConfig = await this.findSalonByPhoneNumber(to);
      if (!salonConfig) {
        console.log(`No salon found for number ${to}`);
        return this.createErrorResponse('Salon not found');
      }

      // Step 3: Check business hours
      const isBusinessHours = await this.checkBusinessHours(salonConfig.id, salonConfig.timezone);
      if (!isBusinessHours) {
        console.log(`Call outside business hours for salon ${salonConfig.id}`);
        return this.createAfterHoursResponse(salonConfig);
      }

      // Step 4: Check concurrent call limits
      const canAcceptCall = await this.checkConcurrentCallLimit(salonConfig.id);
      if (!canAcceptCall) {
        console.log(`Concurrent call limit reached for salon ${salonConfig.id}`);
        return this.createBusyResponse(salonConfig);
      }

      // Step 5: Create voice agent response with WebSocket connection
      const response = await this.createVoiceAgentResponse(callSid, from, salonConfig);

      // Step 6: Track call start
      await this.trackCallStart(callSid, from, to, salonConfig.id);

      return response;

    } catch (error) {
      console.error('Error handling incoming call:', error);
      return this.createErrorResponse('Internal server error');
    }
  }

  private async checkSpamStatus(phoneNumber: string): Promise<SpamCheckResult> {
    try {
      // Check our internal spam database first
      const cachedResult = await this.redis.get(`spam:${phoneNumber}`);
      if (cachedResult) {
        return JSON.parse(cachedResult as string);
      }

      // Use Twilio Lookup API for comprehensive validation
      const lookup = await this.client.lookups.v2
        .phoneNumbers(phoneNumber)
        .fetch({
          fields: ['line_type_intelligence']
        });

      // Calculate risk score based on line type and carrier
      let riskScore = 0;
      let reason = '';

      // High risk indicators
      if (lookup.lineTypeIntelligence?.type === 'voip') {
        riskScore += 0.4;
        reason += 'VoIP number; ';
      }

      if (lookup.lineTypeIntelligence?.['type'] === 'toll-free') {
        riskScore += 0.6;
        reason += 'Toll-free number; ';
      }

      // Check against known spam patterns
      const spamPatterns = await this.getSpamPatterns();
      for (const pattern of spamPatterns) {
        if (phoneNumber.includes(pattern)) {
          riskScore += 0.8;
          reason += `Matches spam pattern: ${pattern}; `;
        }
      }

      const result: SpamCheckResult = {
        isSpam: riskScore > 0.7,
        riskScore,
        reason: reason.trim(),
        lineType: lookup.lineTypeIntelligence?.['type'],
        carrier: lookup.lineTypeIntelligence?.['carrier_name'],
      };

      // Cache result for 24 hours
      await this.redis.set(`spam:${phoneNumber}`, JSON.stringify(result), { ex: 86400 });

      return result;

    } catch (error) {
      console.error('Error checking spam status:', error);
      // Fail safe - allow call but with moderate risk score
      return {
        isSpam: false,
        riskScore: 0.3,
        reason: 'Lookup failed - allowing call',
      };
    }
  }

  private async getSpamPatterns(): Promise<string[]> {
    // Get spam patterns from Redis cache or database
    const patterns = await this.redis.get('spam:patterns');
    if (patterns) {
      return JSON.parse(patterns as string);
    }

    // Default spam patterns
    const defaultPatterns = [
      '1234567890', // Sequential numbers
      '0000000000', // All zeros
      '1111111111', // Repeated digits
    ];

    await this.redis.set('spam:patterns', JSON.stringify(defaultPatterns), { ex: 3600 });
    return defaultPatterns;
  }

  private rejectSpamCall(callSid: string, reason: string): VoiceResponse {
    const response = new VoiceResponse();
    
    // Log the rejection
    console.log(`Rejecting spam call ${callSid}: ${reason}`);
    
    // Politely reject the call
    response.say({
      voice: 'alice',
      language: 'de-DE',
    }, 'Entschuldigung, dieser Anruf kann nicht entgegengenommen werden.');
    
    response.hangup();
    return response;
  }

  private async findSalonByPhoneNumber(phoneNumber: string) {
    // This would typically query your database
    // For now, return a mock salon configuration
    return {
      id: 'salon_001',
      name: 'Premium Beauty Salon',
      phoneNumber,
      timezone: 'Europe/Berlin',
      language: 'de' as const,
      voiceAgentEnabled: true,
      businessHours: {
        monday: { open: '09:00', close: '18:00' },
        tuesday: { open: '09:00', close: '18:00' },
        wednesday: { open: '09:00', close: '18:00' },
        thursday: { open: '09:00', close: '18:00' },
        friday: { open: '09:00', close: '18:00' },
        saturday: { open: '10:00', close: '16:00' },
        sunday: { open: null, close: null }, // Closed
      },
    };
  }

  private async checkBusinessHours(salonId: string, timezone: string): Promise<boolean> {
    const now = new Date();
    const localTime = new Intl.DateTimeFormat('de-DE', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'long',
    }).formatToParts(now);

    const currentHour = parseInt(localTime.find(part => part.type === 'hour')?.value || '0');
    const currentMinute = parseInt(localTime.find(part => part.type === 'minute')?.value || '0');
    const currentDay = localTime.find(part => part.type === 'weekday')?.value?.toLowerCase();

    // For demo purposes, assume business hours are 9-18 Monday-Friday, 10-16 Saturday
    const businessHours: Record<string, { open: number; close: number } | null> = {
      'monday': { open: 9, close: 18 },
      'tuesday': { open: 9, close: 18 },
      'wednesday': { open: 9, close: 18 },
      'thursday': { open: 9, close: 18 },
      'friday': { open: 9, close: 18 },
      'saturday': { open: 10, close: 16 },
      'sunday': null, // Closed
    };

    const dayHours = businessHours[currentDay || ''];
    if (!dayHours) return false;

    const currentTimeMinutes = currentHour * 60 + currentMinute;
    const openMinutes = dayHours.open * 60;
    const closeMinutes = dayHours.close * 60;

    return currentTimeMinutes >= openMinutes && currentTimeMinutes < closeMinutes;
  }

  private async checkConcurrentCallLimit(salonId: string): Promise<boolean> {
    const activeCallsKey = `voice:active:${salonId}`;
    const activeCalls = await this.redis.get(activeCallsKey);
    const currentActiveCalls = activeCalls ? parseInt(activeCalls as string) : 0;
    
    // Premium tier allows up to 3 concurrent calls
    const maxConcurrentCalls = 3;
    
    return currentActiveCalls < maxConcurrentCalls;
  }

  private async createVoiceAgentResponse(
    callSid: string,
    from: string,
    salonConfig: any
  ): Promise<VoiceResponse> {
    const response = new VoiceResponse();

    // Connect to Voice Gateway WebSocket for AI conversation
    const connect = response.connect();
    const stream = connect.stream({
      url: `${this.config.voiceGatewayUrl}/voice-stream?sessionId=${callSid}&type=twilio`,
      track: 'inbound_track',
    });

    // Pass context parameters to the voice gateway
    stream.parameter({ name: 'salonId', value: salonConfig.id });
    stream.parameter({ name: 'customerPhone', value: from });
    stream.parameter({ name: 'language', value: salonConfig.language });
    stream.parameter({ name: 'callType', value: 'inbound' });

    return response;
  }

  private createAfterHoursResponse(salonConfig: any): VoiceResponse {
    const response = new VoiceResponse();
    
    const language = salonConfig.language === 'de' ? 'de-DE' : 'en-US';
    const message = salonConfig.language === 'de' 
      ? 'Vielen Dank für Ihren Anruf. Unser Salon ist derzeit geschlossen. Unsere Öffnungszeiten sind Montag bis Freitag von 9 bis 18 Uhr und Samstag von 10 bis 16 Uhr. Sie können uns auch über WhatsApp erreichen oder online einen Termin buchen.'
      : 'Thank you for calling. Our salon is currently closed. Our opening hours are Monday to Friday 9 AM to 6 PM and Saturday 10 AM to 4 PM. You can also reach us via WhatsApp or book an appointment online.';

    response.say({
      voice: 'alice',
      language,
    }, message);

    response.hangup();
    return response;
  }

  private createBusyResponse(salonConfig: any): VoiceResponse {
    const response = new VoiceResponse();
    
    const language = salonConfig.language === 'de' ? 'de-DE' : 'en-US';
    const message = salonConfig.language === 'de'
      ? 'Alle unsere Leitungen sind derzeit besetzt. Bitte versuchen Sie es in wenigen Minuten erneut oder hinterlassen Sie uns eine Nachricht über WhatsApp.'
      : 'All our lines are currently busy. Please try again in a few minutes or leave us a message via WhatsApp.';

    response.say({
      voice: 'alice',
      language,
    }, message);

    response.hangup();
    return response;
  }

  private createErrorResponse(message: string): VoiceResponse {
    const response = new VoiceResponse();
    
    response.say({
      voice: 'alice',
      language: 'de-DE',
    }, 'Es tut uns leid, es ist ein technischer Fehler aufgetreten. Bitte versuchen Sie es später erneut.');

    response.hangup();
    return response;
  }

  private async trackCallStart(
    callSid: string,
    from: string,
    to: string,
    salonId: string
  ): Promise<void> {
    try {
      // Increment active calls counter
      const activeCallsKey = `voice:active:${salonId}`;
      await this.redis.incr(activeCallsKey);
      await this.redis.expire(activeCallsKey, 1800); // 30 minutes TTL

      // Store call information
      const callData = {
        callSid,
        from,
        to,
        salonId,
        startTime: new Date().toISOString(),
        status: 'initiated',
      };

      await this.redis.set(`voice:call:${callSid}`, JSON.stringify(callData), { ex: 3600 });

      // Daily call counter
      const today = new Date().toISOString().split('T')[0];
      await this.redis.incr(`voice:daily:${salonId}:${today}`);

      console.log(`Call ${callSid} started and tracked`);

    } catch (error) {
      console.error('Error tracking call start:', error);
    }
  }

  // =============================================================================
  // OUTBOUND CALL HANDLING
  // =============================================================================

  async initiateOutboundCall(
    to: string,
    salonId: string,
    context: CallContext
  ): Promise<CallInstance> {
    try {
      // Validate phone number
      const isValid = await this.validatePhoneNumber(to);
      if (!isValid) {
        throw new Error(`Invalid phone number: ${to}`);
      }

      // Check business hours for outbound calls
      const canMakeCall = await this.canMakeOutboundCall(salonId, context);
      if (!canMakeCall) {
        throw new Error('Cannot make outbound call at this time');
      }

      // Create the call
      const call = await this.client.calls.create({
        to,
        from: this.config.phoneNumber,
        url: `${this.config.statusCallbackUrl}/outbound-twiml`,
        statusCallback: `${this.config.statusCallbackUrl}/call-status`,
        statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
        statusCallbackMethod: 'POST',
        timeout: 30, // 30 seconds ring timeout
        record: false, // Privacy compliant - no automatic recording
      });

      // Track outbound call
      await this.trackOutboundCall(call.sid, to, salonId, context);

      return {
        sid: call.sid,
        status: call.status,
        direction: call.direction,
        from: call.from,
        to: call.to,
        startTime: call.startTime,
      };

    } catch (error) {
      console.error('Error initiating outbound call:', error);
      throw error;
    }
  }

  private async validatePhoneNumber(phoneNumber: string): Promise<boolean> {
    try {
      const lookup = await this.client.lookups.v2
        .phoneNumbers(phoneNumber)
        .fetch();

      return lookup.valid;
    } catch (error) {
      console.error('Phone number validation failed:', error);
      return false;
    }
  }

  private async canMakeOutboundCall(salonId: string, context: CallContext): Promise<boolean> {
    // Check daily call limits
    const today = new Date().toISOString().split('T')[0];
    const dailyCalls = await this.redis.get(`voice:daily:${salonId}:${today}`);
    const callCount = dailyCalls ? parseInt(dailyCalls as string) : 0;

    // Premium tier: 100 calls per day
    if (callCount >= 100) {
      return false;
    }

    // Emergency calls are always allowed
    if (context.callType === 'emergency') {
      return true;
    }

    // Check business hours for non-emergency calls
    return await this.checkBusinessHours(salonId, 'Europe/Berlin');
  }

  private async trackOutboundCall(
    callSid: string,
    to: string,
    salonId: string,
    context: CallContext
  ): Promise<void> {
    try {
      const callData = {
        callSid,
        to,
        salonId,
        context,
        direction: 'outbound',
        startTime: new Date().toISOString(),
        status: 'initiated',
      };

      await this.redis.set(`voice:call:${callSid}`, JSON.stringify(callData), { ex: 3600 });

      console.log(`Outbound call ${callSid} to ${to} initiated`);

    } catch (error) {
      console.error('Error tracking outbound call:', error);
    }
  }

  // =============================================================================
  // CALL STATUS HANDLING
  // =============================================================================

  async handleCallStatusUpdate(
    callSid: string,
    status: string,
    duration?: string,
    additionalData?: Record<string, any>
  ): Promise<void> {
    try {
      console.log(`Call ${callSid} status update: ${status}`);

      // Update call data
      const callDataStr = await this.redis.get(`voice:call:${callSid}`);
      if (!callDataStr) {
        console.warn(`No call data found for ${callSid}`);
        return;
      }

      const callData = JSON.parse(callDataStr as string);
      callData.status = status;
      callData.lastUpdate = new Date().toISOString();

      if (duration) {
        callData.duration = parseInt(duration);
      }

      if (additionalData) {
        callData.additionalData = additionalData;
      }

      await this.redis.set(`voice:call:${callSid}`, JSON.stringify(callData), { ex: 3600 });

      // Handle specific status events
      switch (status) {
        case 'completed':
        case 'failed':
        case 'busy':
        case 'no-answer':
          await this.handleCallEnd(callSid, callData);
          break;
      }

    } catch (error) {
      console.error('Error handling call status update:', error);
    }
  }

  private async handleCallEnd(callSid: string, callData: any): Promise<void> {
    try {
      // Decrement active calls counter
      if (callData.salonId) {
        const activeCallsKey = `voice:active:${callData.salonId}`;
        const current = await this.redis.get(activeCallsKey);
        if (current && parseInt(current as string) > 0) {
          await this.redis.decr(activeCallsKey);
        }
      }

      // Store final call data for analytics
      callData.endTime = new Date().toISOString();
      await this.redis.set(`voice:completed:${callSid}`, JSON.stringify(callData), { ex: 86400 });

      console.log(`Call ${callSid} ended: ${callData.status}`);

    } catch (error) {
      console.error('Error handling call end:', error);
    }
  }

  // =============================================================================
  // UTILITY METHODS
  // =============================================================================

  public async getCallInfo(callSid: string): Promise<any> {
    const callDataStr = await this.redis.get(`voice:call:${callSid}`);
    return callDataStr ? JSON.parse(callDataStr as string) : null;
  }

  public async getActiveCalls(salonId: string): Promise<number> {
    const activeCalls = await this.redis.get(`voice:active:${salonId}`);
    return activeCalls ? parseInt(activeCalls as string) : 0;
  }

  public async getDailyCallCount(salonId: string, date?: string): Promise<number> {
    const targetDate = date || new Date().toISOString().split('T')[0];
    const dailyCalls = await this.redis.get(`voice:daily:${salonId}:${targetDate}`);
    return dailyCalls ? parseInt(dailyCalls as string) : 0;
  }
}

// Create singleton instance
let twilioVoiceClient: TwilioVoiceClient | null = null;

export function getTwilioVoiceClient(): TwilioVoiceClient {
  if (!twilioVoiceClient) {
    const voiceConfig: TwilioVoiceConfig = {
      accountSid: config.WHATSAPP_BUSINESS_ACCOUNT_ID || process.env['TWILIO_ACCOUNT_SID'] || '',
      authToken: config.WHATSAPP_APP_SECRET || process.env['TWILIO_AUTH_TOKEN'] || '',
      phoneNumber: config.WHATSAPP_PHONE_NUMBER_ID || process.env['TWILIO_PHONE_NUMBER'] || '',
      websocketUrl: process.env['VOICE_GATEWAY_URL'] || 'wss://voice-gateway.claxis.com',
      statusCallbackUrl: process.env['NEXT_PUBLIC_APP_URL'] || 'https://claxis.onrender.com',
      voiceGatewayUrl: process.env['VOICE_GATEWAY_URL'] || 'wss://voice-gateway.claxis.com',
    };

    twilioVoiceClient = new TwilioVoiceClient(voiceConfig);
  }

  return twilioVoiceClient;
}

export { TwilioVoiceClient };
export default TwilioVoiceClient;