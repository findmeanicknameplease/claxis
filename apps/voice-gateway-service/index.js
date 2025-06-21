const express = require('express');
const WebSocket = require('ws');
const twilio = require('twilio');
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const cors = require('cors');
const helmet = require('helmet');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

// Campaign Engine for reliable outbound calling
const {
  addCampaignJob,
  getCampaignQueueStats,
  initializeCampaignWorkers,
  validateCampaignExecution,
  generateCampaignScript,
  QUEUE_NAMES
} = require('./campaign-engine');

// Event Publishing System
const EventPublisher = require('./event-publisher');

// =============================================================================
// VOICE GATEWAY SERVICE - REAL-TIME VOICE AGENT ORCHESTRATOR
// =============================================================================
// Handles bidirectional audio streaming between:
// - Twilio Media Streams (customer calls)
// - ElevenLabs Conversational AI (voice agent)
// - n8n workflows (business logic)
// - Supabase (logging and context)
// =============================================================================

const app = express();
const server = require('http').createServer(app);

// Configuration
const PORT = process.env.PORT || 3001;
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_AGENT_ID = process.env.ELEVENLABS_AGENT_ID;

// Initialize services
const twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Initialize Event Publisher
const eventPublisher = new EventPublisher(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// In-memory call state management (use Redis in production)
const activeCalls = new Map();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// =============================================================================
// CORE VOICE GATEWAY FUNCTIONALITY
// =============================================================================

/**
 * Call State Management with Event Publishing
 */
class CallSession {
  constructor(callSid, salonId, phoneNumber, direction = 'inbound') {
    this.callSid = callSid;
    this.salonId = salonId;
    this.phoneNumber = phoneNumber;
    this.direction = direction;
    this.startTime = new Date();
    this.transcript = [];
    this.currentState = 'initializing';
    this.elevenLabsWs = null;
    this.twilioWs = null;
    this.customerId = null;
    this.conversationContext = {};
    this.detectedLanguage = 'en';
    this.salonOpen = true;
    this.outcome = null;
    this.summary = null;
    this.bookingIntent = null;
    this.customerSatisfied = null;
  }

  addTranscriptEntry(speaker, text, timestamp = new Date()) {
    const entry = {
      speaker,
      text,
      timestamp: timestamp.toISOString(),
      confidence: 0.95 // Default confidence
    };
    
    this.transcript.push(entry);
    
    // Publish transcript update event
    eventPublisher.publishTranscriptUpdate(this.salonId, this, entry)
      .catch(err => console.error('Failed to publish transcript update:', err));
  }

  updateState(newState) {
    console.log(`Call ${this.callSid}: ${this.currentState} -> ${newState}`);
    const previousState = this.currentState;
    this.currentState = newState;
    
    // Publish state change events
    if (newState === 'answered') {
      const responseTime = Date.now() - this.startTime.getTime();
      eventPublisher.publishCallAnswered(this.salonId, { 
        ...this, 
        responseTime 
      }).catch(err => console.error('Failed to publish call answered:', err));
    }
  }

  async publishCallStarted() {
    try {
      await eventPublisher.publishCallStarted(this.salonId, this);
    } catch (error) {
      console.error('Failed to publish call started event:', error);
    }
  }

  async publishCallEnded() {
    try {
      const duration = Math.floor((new Date() - this.startTime) / 1000);
      await eventPublisher.publishCallEnded(this.salonId, {
        ...this,
        duration
      });
    } catch (error) {
      console.error('Failed to publish call ended event:', error);
    }
  }

  async logToSupabase(status = 'completed', summary = null) {
    try {
      const duration = Math.floor((new Date() - this.startTime) / 1000);
      
      const { error } = await supabase
        .from('call_logs')
        .insert({
          twilio_call_sid: this.callSid,
          salon_id: this.salonId,
          customer_id: this.customerId,
          phone_number: this.phoneNumber,
          direction: this.direction,
          call_status: status,
          duration_seconds: duration,
          transcript: this.transcript,
          summary: summary,
          outcome: this.conversationContext.outcome || null
        });

      if (error) {
        console.error('Failed to log call to Supabase:', error);
      } else {
        console.log(`Call ${this.callSid} logged successfully`);
      }
    } catch (error) {
      console.error('Error logging call:', error);
    }
  }
}

// =============================================================================
// TWILIO WEBHOOKS & CALL HANDLING
// =============================================================================

/**
 * Twilio Call Webhook - Incoming calls
 */
app.post('/twilio/voice/incoming', async (req, res) => {
  const { CallSid, From, To } = req.body;
  
  console.log(`Incoming call: ${CallSid} from ${From} to ${To}`);
  
  try {
    // Look up salon by Twilio phone number
    const { data: salon } = await supabase
      .from('salons')
      .select('*')
      .eq('twilio_phone_number', To)
      .single();

    if (!salon) {
      console.error(`No salon found for Twilio number: ${To}`);
      res.type('text/xml').send(`
        <Response>
          <Say voice="alice" language="en">
            Sorry, this number is not configured. Please try again later.
          </Say>
          <Hangup/>
        </Response>
      `);
      return;
    }

    // Create call session with language detection
    const callSession = new CallSession(CallSid, salon.id, From, 'inbound');
    
    // Detect customer language for voice agent
    const detectedLanguage = detectCustomerLanguage(From);
    callSession.detectedLanguage = detectedLanguage;
    
    // Check if salon is open and set context
    const isOpen = await checkSalonHours(salon);
    callSession.salonOpen = isOpen;
    
    activeCalls.set(CallSid, callSession);
    
    // Publish call started event
    await callSession.publishCallStarted();
    
    if (!isOpen && salon.settings?.voice_agent_settings?.after_hours_enabled !== true) {
      const afterHoursMessage = getAfterHoursMessage(detectedLanguage, salon.business_name);
      
      res.type('text/xml').send(`
        <Response>
          <Say voice="alice" language="${detectedLanguage}">
            ${afterHoursMessage}
          </Say>
          <Hangup/>
        </Response>
      `);
      
      callSession.updateState('closed_hours');
      await callSession.logToSupabase('completed', `Called outside business hours (${detectedLanguage})`);
      activeCalls.delete(CallSid);
      return;
    }

    // Start bidirectional media stream for voice agent
    const streamUrl = `wss://${req.headers.host}/twilio/stream`;
    
    res.type('text/xml').send(`
      <Response>
        <Connect>
          <Stream url="${streamUrl}" />
        </Connect>
      </Response>
    `);

    callSession.updateState('streaming');

  } catch (error) {
    console.error('Error handling incoming call:', error);
    res.type('text/xml').send(`
      <Response>
        <Say voice="alice" language="en">
          Sorry, we're experiencing technical difficulties. Please try again later.
        </Say>
        <Hangup/>
      </Response>
    `);
  }
});

/**
 * Twilio Call Status Webhook
 */
app.post('/twilio/voice/status', async (req, res) => {
  const { CallSid, CallStatus, From, To, CallDuration } = req.body;
  
  console.log(`Call status update: ${CallSid} -> ${CallStatus}`);
  
  const callSession = activeCalls.get(CallSid);
  if (callSession) {
    callSession.updateState(CallStatus);
    
    if (['completed', 'failed', 'canceled', 'no-answer'].includes(CallStatus)) {
      // Call ended - clean up and log
      if (callSession.elevenLabsWs) {
        callSession.elevenLabsWs.close();
      }
      
      await callSession.logToSupabase(CallStatus);
      
      // MISSED CALL DETECTION: Auto-callback for inbound missed calls
      if (CallStatus === 'no-answer' && callSession.direction === 'inbound') {
        await handleMissedCallDetection(callSession, CallDuration || 0);
      }
      
      activeCalls.delete(CallSid);
    }
  }
  
  res.sendStatus(200);
});

// =============================================================================
// WEBSOCKET HANDLERS - REAL-TIME AUDIO STREAMING
// =============================================================================

/**
 * WebSocket server for Twilio Media Streams
 */
const wss = new WebSocket.Server({ 
  server,
  path: '/twilio/stream'
});

wss.on('connection', (twilioWs, req) => {
  console.log('Twilio WebSocket connected');
  
  let callSession = null;
  let elevenLabsWs = null;

  twilioWs.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      
      switch (data.event) {
        case 'connected':
          console.log('Twilio WebSocket connected:', data.protocol);
          break;
          
        case 'start':
          console.log('Call started:', data.start);
          const callSid = data.start.callSid;
          
          // Get call session
          callSession = activeCalls.get(callSid);
          if (!callSession) {
            console.error('Call session not found:', callSid);
            twilioWs.close();
            return;
          }
          
          callSession.twilioWs = twilioWs;
          
          // Initialize ElevenLabs Conversational AI connection
          await initializeElevenLabsAgent(callSession);
          break;
          
        case 'media':
          // Forward audio to ElevenLabs
          if (callSession?.elevenLabsWs?.readyState === WebSocket.OPEN) {
            const audioPayload = {
              type: 'audio',
              data: data.media.payload // base64 audio from Twilio
            };
            callSession.elevenLabsWs.send(JSON.stringify(audioPayload));
          }
          break;
          
        case 'stop':
          console.log('Call stream stopped');
          if (elevenLabsWs) {
            elevenLabsWs.close();
          }
          break;
      }
    } catch (error) {
      console.error('Error processing Twilio message:', error);
    }
  });

  twilioWs.on('close', () => {
    console.log('Twilio WebSocket disconnected');
    if (elevenLabsWs) {
      elevenLabsWs.close();
    }
  });
});

/**
 * Initialize ElevenLabs Conversational AI connection
 */
async function initializeElevenLabsAgent(callSession) {
  try {
    // Get salon context for personalized agent
    const { data: salon } = await supabase
      .from('salons')
      .select('*, services(*)')
      .eq('id', callSession.salonId)
      .single();

    // Build agent context with multilingual support
    const preferredLanguage = callSession.detectedLanguage || salon.settings?.ai_settings?.preferred_language || 'nl';
    const agentContext = {
      salon_name: salon.business_name,
      services: salon.services.map(s => `${s.name} - €${s.price}`).join(', '),
      business_hours: formatBusinessHours(salon.settings.business_hours),
      language: preferredLanguage,
      personality: salon.settings?.voice_agent_settings?.personality || 'friendly',
      country_context: getCountryContext(preferredLanguage)
    };

    // Connect to ElevenLabs Conversational AI
    const elevenLabsWs = new WebSocket('wss://api.elevenlabs.io/v1/convai/conversation', {
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
      }
    });

    elevenLabsWs.on('open', () => {
      console.log('Connected to ElevenLabs Conversational AI');
      
      // Initialize conversation with multilingual salon context
      const localizedContext = buildLocalizedContext(agentContext);
      const initMessage = {
        type: 'conversation_initiation',
        conversation_config: {
          agent_id: ELEVENLABS_AGENT_ID,
          language: agentContext.language,
          context: localizedContext.system_prompt,
          voice_settings: {
            voice_id: localizedContext.voice_id,
            stability: 0.5,
            similarity_boost: 0.8,
            style: 0.2,
            use_speaker_boost: true
          }
        }
      };
      
      elevenLabsWs.send(JSON.stringify(initMessage));
      callSession.updateState('agent_connected');
    });

    elevenLabsWs.on('message', (message) => {
      try {
        const data = JSON.parse(message);
        
        switch (data.type) {
          case 'audio':
            // Forward AI response audio to Twilio
            if (callSession.twilioWs?.readyState === WebSocket.OPEN) {
              const twilioMessage = {
                event: 'media',
                streamSid: callSession.callSid,
                media: {
                  payload: data.data // base64 audio for Twilio
                }
              };
              callSession.twilioWs.send(JSON.stringify(twilioMessage));
            }
            break;
            
          case 'transcript':
            // Log conversation transcript
            callSession.addTranscriptEntry(
              data.speaker || 'assistant',
              data.text || '',
              new Date()
            );
            
            // Check if business logic needed (booking, availability check, etc.)
            if (data.intent && needsBusinessLogic(data.intent)) {
              handleBusinessLogicRequest(callSession, data.intent);
            }
            break;
            
          case 'conversation_end':
            console.log('ElevenLabs conversation ended');
            callSession.updateState('agent_disconnected');
            break;
        }
      } catch (error) {
        console.error('Error processing ElevenLabs message:', error);
      }
    });

    elevenLabsWs.on('close', () => {
      console.log('ElevenLabs WebSocket disconnected');
      callSession.updateState('agent_disconnected');
    });

    elevenLabsWs.on('error', (error) => {
      console.error('ElevenLabs WebSocket error:', error);
      callSession.updateState('agent_error');
    });

    callSession.elevenLabsWs = elevenLabsWs;

  } catch (error) {
    console.error('Error initializing ElevenLabs agent:', error);
    callSession.updateState('agent_init_failed');
  }
}

// =============================================================================
// BUSINESS LOGIC INTEGRATION WITH N8N
// =============================================================================

/**
 * Check if AI intent requires n8n business logic
 */
function needsBusinessLogic(intent) {
  const businessIntents = [
    'booking_request',
    'availability_check',
    'service_pricing',
    'cancel_booking',
    'reschedule_booking'
  ];
  return businessIntents.includes(intent.type);
}

/**
 * Handle business logic requests by calling n8n webhooks
 */
async function handleBusinessLogicRequest(callSession, intent) {
  try {
    const webhookUrl = `${process.env.N8N_WEBHOOK_BASE_URL}/voice-agent-logic`;
    
    const payload = {
      salon_id: callSession.salonId,
      customer_phone: callSession.phoneNumber,
      intent: intent,
      call_sid: callSession.callSid,
      conversation_context: callSession.conversationContext
    };

    console.log(`Calling n8n for business logic: ${intent.type}`);
    
    const response = await axios.post(webhookUrl, payload, {
      timeout: 5000, // 5 second timeout for real-time calls
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.N8N_API_KEY
      }
    });

    // Store result in conversation context for ElevenLabs
    callSession.conversationContext = {
      ...callSession.conversationContext,
      [intent.type]: response.data
    };

    // Send updated context to ElevenLabs if needed
    if (callSession.elevenLabsWs?.readyState === WebSocket.OPEN) {
      const contextUpdate = {
        type: 'context_update',
        context: response.data
      };
      callSession.elevenLabsWs.send(JSON.stringify(contextUpdate));
    }

  } catch (error) {
    console.error('Error calling n8n business logic:', error);
    
    // Fallback response
    callSession.conversationContext.error = {
      type: 'business_logic_error',
      message: 'Sorry, I cannot process that request right now. Please try again later.'
    };
  }
}

// =============================================================================
// OUTBOUND CALL MANAGEMENT
// =============================================================================

/**
 * API endpoint for n8n to initiate outbound calls
 */
app.post('/calls/initiate', async (req, res) => {
  try {
    const { 
      salon_id, 
      phone_number, 
      campaign_type, 
      customer_context,
      scheduled_time 
    } = req.body;

    // Validate API key
    if (req.headers['x-api-key'] !== process.env.SERVICE_API_KEY) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get salon configuration
    const { data: salon } = await supabase
      .from('salons')
      .select('*')
      .eq('id', salon_id)
      .single();

    if (!salon) {
      return res.status(404).json({ error: 'Salon not found' });
    }

    // Schedule or initiate call immediately
    if (scheduled_time && new Date(scheduled_time) > new Date()) {
      // Add to callback queue for later processing
      const { data: queueEntry } = await supabase
        .from('callback_queue')
        .insert({
          salon_id,
          phone_number,
          campaign_type,
          customer_context,
          process_after: scheduled_time,
          status: 'scheduled'
        })
        .select()
        .single();

      res.json({
        success: true,
        call_scheduled: true,
        queue_id: queueEntry.id,
        scheduled_for: scheduled_time
      });
    } else {
      // Initiate call immediately
      const callResult = await initiateOutboundCall(salon, phone_number, campaign_type, customer_context);
      res.json(callResult);
    }

  } catch (error) {
    console.error('Error initiating outbound call:', error);
    res.status(500).json({ 
      error: 'Failed to initiate call',
      details: error.message 
    });
  }
});

/**
 * Initiate outbound call via Twilio
 */
async function initiateOutboundCall(salon, phoneNumber, campaignType, customerContext) {
  try {
    const call = await twilioClient.calls.create({
      from: salon.twilio_phone_number,
      to: phoneNumber,
      url: `${process.env.BASE_URL}/twilio/voice/outbound?campaign=${campaignType}`,
      statusCallback: `${process.env.BASE_URL}/twilio/voice/status`,
      statusCallbackEvent: ['initiated', 'answered', 'completed'],
      timeout: 30
    });

    // Create call session for outbound call
    const callSession = new CallSession(call.sid, salon.id, phoneNumber, 'outbound');
    callSession.conversationContext = {
      campaign_type: campaignType,
      customer_context: customerContext
    };
    activeCalls.set(call.sid, callSession);

    console.log(`Outbound call initiated: ${call.sid}`);

    return {
      success: true,
      call_sid: call.sid,
      status: call.status,
      direction: 'outbound'
    };

  } catch (error) {
    console.error('Error creating outbound call:', error);
    throw error;
  }
}

// =============================================================================
// MISSED CALL DETECTION & AUTO-CALLBACK SYSTEM
// =============================================================================

/**
 * Handle missed call detection and intelligent auto-callback queueing
 */
async function handleMissedCallDetection(callSession, callDuration) {
  try {
    console.log(`🔔 Missed call detected: ${callSession.callSid} from ${callSession.phoneNumber}`);
    
    // Get salon configuration
    const { data: salon } = await supabase
      .from('salons')
      .select('*')
      .eq('id', callSession.salonId)
      .single();

    if (!salon) {
      console.error('Salon not found for missed call callback');
      return;
    }

    // Check if auto-callback is enabled for this salon
    const voiceSettings = salon.settings?.voice_agent_settings || {};
    if (!voiceSettings.enabled || !voiceSettings.missed_call_callback_enabled) {
      console.log(`Auto-callback disabled for salon ${salon.business_name}`);
      return;
    }

    // Check customer preferences
    const customerPreferences = await getCustomerVoicePreferences(callSession.phoneNumber, callSession.salonId);
    if (!customerPreferences.allow_voice_calls || !customerPreferences.allow_voice_followups) {
      console.log(`Customer ${callSession.phoneNumber} opted out of voice callbacks`);
      return;
    }

    // Calculate optimal callback timing
    const callbackDelay = calculateOptimalCallbackDelay(salon, customerPreferences);
    const processAfter = new Date(Date.now() + (callbackDelay * 60 * 1000));

    // Check if we should perform spam protection
    let twilioLookupData = null;
    let isVerifiedSafe = true;

    if (voiceSettings.spam_protection_enabled !== false) {
      try {
        console.log(`🔍 Performing spam protection lookup for ${callSession.phoneNumber}`);
        
        const lookupResponse = await twilioClient.lookups.v2.phoneNumbers(callSession.phoneNumber)
          .fetch({
            fields: 'line_type_intelligence,caller_name'
          });

        twilioLookupData = {
          phone_number: lookupResponse.phoneNumber,
          valid: lookupResponse.valid,
          line_type: lookupResponse.lineTypeIntelligence?.type,
          carrier: lookupResponse.lineTypeIntelligence?.carrier_name,
          error_code: lookupResponse.lineTypeIntelligence?.error_code
        };

        // Assess safety based on line type and error codes
        const riskySigns = [
          lookupResponse.lineTypeIntelligence?.error_code,
          lookupResponse.lineTypeIntelligence?.type === 'voip',
          lookupResponse.lineTypeIntelligence?.type === 'prepaid'
        ];

        isVerifiedSafe = !riskySigns.some(Boolean);

        if (!isVerifiedSafe) {
          console.log(`⚠️  Phone number ${callSession.phoneNumber} failed safety checks - blocking callback`);
          return;
        }

      } catch (lookupError) {
        console.warn('Twilio Lookup failed, proceeding with callback (fail-open policy):', lookupError.message);
        twilioLookupData = { error: 'Lookup service unavailable', warning: lookupError.message };
      }
    }

    // Build customer context for personalized callback with language detection
    const customerContext = await buildCustomerContext(callSession.phoneNumber, callSession.salonId);
    
    // Detect and set customer's preferred language
    customerContext.preferred_language = detectCustomerLanguage(callSession.phoneNumber, customerContext);

    // Add to callback queue
    const { data: queueEntry, error } = await supabase
      .from('callback_queue')
      .insert({
        salon_id: callSession.salonId,
        phone_number: callSession.phoneNumber,
        status: 'scheduled',
        process_after: processAfter.toISOString(),
        campaign_type: 'missed_call_callback',
        campaign_context: {
          original_call_sid: callSession.callSid,
          missed_at: new Date().toISOString(),
          call_duration: callDuration,
          callback_reason: 'automatic_missed_call_detection'
        },
        customer_context: customerContext,
        twilio_lookup_response: twilioLookupData,
        is_verified_safe: isVerifiedSafe,
        max_attempts: voiceSettings.max_callback_attempts || 2
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to add missed call to callback queue:', error);
      return;
    }

    console.log(`✅ Missed call callback scheduled: Queue ID ${queueEntry.id}, scheduled for ${processAfter.toISOString()}`);

    // Trigger immediate n8n workflow for context-aware processing
    await triggerMissedCallWorkflow(callSession, queueEntry, salon);

  } catch (error) {
    console.error('Error handling missed call detection:', error);
  }
}

/**
 * Get or create customer voice preferences
 */
async function getCustomerVoicePreferences(phoneNumber, salonId) {
  try {
    // First try to find existing customer
    const { data: customer } = await supabase
      .from('customers')
      .select('*')
      .eq('phone', phoneNumber)
      .eq('salon_id', salonId)
      .single();

    if (customer) {
      // Get voice preferences
      const { data: preferences } = await supabase
        .from('customer_voice_preferences')
        .select('*')
        .eq('customer_id', customer.id)
        .eq('salon_id', salonId)
        .single();

      if (preferences) {
        return preferences;
      }
    }

    // Return default preferences if customer or preferences not found
    return {
      allow_voice_calls: true,
      allow_voice_followups: true,
      allow_voice_reviews: true,
      allow_voice_promotions: false,
      preferred_language: 'nl',
      preferred_call_times: {},
      timezone: 'Europe/Amsterdam'
    };

  } catch (error) {
    console.warn('Error getting customer voice preferences, using defaults:', error.message);
    return {
      allow_voice_calls: true,
      allow_voice_followups: true,
      allow_voice_reviews: true,
      allow_voice_promotions: false,
      preferred_language: 'nl',
      preferred_call_times: {},
      timezone: 'Europe/Amsterdam'
    };
  }
}

/**
 * Calculate optimal callback delay based on salon settings and customer preferences
 */
function calculateOptimalCallbackDelay(salon, customerPreferences) {
  const voiceSettings = salon.settings?.voice_agent_settings || {};
  const now = new Date();
  
  // Base delay (default 2 minutes)
  let delayMinutes = voiceSettings.callback_delay_minutes || 2;
  
  // Adjust based on time of day
  const currentHour = now.getHours();
  
  // During business hours: shorter delay
  if (currentHour >= 9 && currentHour <= 17) {
    delayMinutes = Math.max(1, delayMinutes - 1);
  }
  // Outside business hours: longer delay
  else if (currentHour < 8 || currentHour > 19) {
    delayMinutes = Math.max(15, delayMinutes + 10); // Wait until reasonable hours
  }
  
  // Respect customer's preferred call times if available
  const preferredTimes = customerPreferences.preferred_call_times || {};
  const today = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
  
  if (preferredTimes[today] && preferredTimes[today].length > 0) {
    // Customer has preferences for today
    const timeNow = now.toTimeString().slice(0, 5); // HH:MM
    const isInPreferredTime = preferredTimes[today].some(timeRange => {
      const [start, end] = timeRange.split('-');
      return timeNow >= start && timeNow <= end;
    });
    
    if (!isInPreferredTime) {
      // Find next preferred time slot
      const nextSlot = findNextPreferredTimeSlot(preferredTimes, now);
      if (nextSlot) {
        const minutesUntilSlot = Math.floor((nextSlot - now) / (1000 * 60));
        delayMinutes = Math.max(delayMinutes, minutesUntilSlot);
      }
    }
  }
  
  return Math.min(delayMinutes, 60); // Cap at 1 hour max
}

/**
 * Find the next preferred time slot for callback
 */
function findNextPreferredTimeSlot(preferredTimes, fromDate) {
  // This is a simplified implementation
  // In production, you'd want more sophisticated scheduling logic
  const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const currentDay = fromDate.getDay();
  
  // Check today first
  const today = daysOfWeek[currentDay];
  if (preferredTimes[today]) {
    for (const timeRange of preferredTimes[today]) {
      const [start] = timeRange.split('-');
      const [hours, minutes] = start.split(':').map(Number);
      const slotTime = new Date(fromDate);
      slotTime.setHours(hours, minutes, 0, 0);
      
      if (slotTime > fromDate) {
        return slotTime;
      }
    }
  }
  
  // Check tomorrow
  const tomorrow = new Date(fromDate);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0); // Default to 9 AM tomorrow
  
  return tomorrow;
}

/**
 * Build customer context for personalized callback
 */
async function buildCustomerContext(phoneNumber, salonId) {
  try {
    // Get customer information
    const { data: customer } = await supabase
      .from('customers')
      .select(`
        *,
        bookings!inner(
          id,
          scheduled_at,
          status,
          services(name, price),
          created_at
        )
      `)
      .eq('phone', phoneNumber)
      .eq('salon_id', salonId)
      .order('bookings.scheduled_at', { ascending: false })
      .limit(5)
      .single();

    if (customer) {
      const recentBookings = customer.bookings || [];
      const lastBooking = recentBookings[0];
      
      return {
        customer_name: customer.name,
        customer_id: customer.id,
        is_existing_customer: true,
        last_visit: lastBooking?.scheduled_at,
        favorite_services: recentBookings
          .slice(0, 3)
          .map(b => b.services?.name)
          .filter(Boolean),
        total_visits: recentBookings.length,
        customer_value: 'regular', // Could be calculated based on visit frequency
        preferred_language: customer.preferred_language || 'nl'
      };
    }

    // New customer context
    return {
      customer_name: null,
      customer_id: null,
      is_existing_customer: false,
      callback_reason: 'new_customer_inquiry',
      preferred_language: 'nl'
    };

  } catch (error) {
    console.warn('Error building customer context:', error.message);
    return {
      customer_name: null,
      customer_id: null,
      is_existing_customer: false,
      callback_reason: 'inquiry',
      preferred_language: 'nl'
    };
  }
}

/**
 * Trigger n8n workflow for intelligent missed call processing
 */
async function triggerMissedCallWorkflow(callSession, queueEntry, salon) {
  try {
    const webhookUrl = `${process.env.N8N_WEBHOOK_BASE_URL}/missed-call-detection`;
    
    const payload = {
      event_type: 'missed_call_detected',
      salon_id: callSession.salonId,
      salon_name: salon.business_name,
      customer_phone: callSession.phoneNumber,
      original_call_sid: callSession.callSid,
      queue_id: queueEntry.id,
      callback_scheduled_for: queueEntry.process_after,
      customer_context: queueEntry.customer_context,
      spam_check_result: {
        is_verified_safe: queueEntry.is_verified_safe,
        lookup_response: queueEntry.twilio_lookup_response
      },
      salon_settings: salon.settings?.voice_agent_settings || {}
    };

    console.log(`📞 Triggering n8n missed call workflow for ${callSession.phoneNumber}`);
    
    const response = await axios.post(webhookUrl, payload, {
      timeout: 3000,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.N8N_API_KEY
      }
    });

    console.log(`✅ n8n missed call workflow triggered successfully`);

  } catch (error) {
    console.warn('Failed to trigger n8n missed call workflow (non-critical):', error.message);
    // This is non-critical - the callback will still be processed from the queue
  }
}

// =============================================================================
// MULTILINGUAL VOICE SUPPORT
// =============================================================================

/**
 * Get country and cultural context for language
 */
function getCountryContext(language) {
  const contexts = {
    'nl': {
      country: 'Netherlands',
      currency: 'EUR',
      culture: 'Dutch directness with politeness',
      greeting_style: 'friendly but professional',
      time_format: '24-hour',
      date_format: 'DD-MM-YYYY',
      business_culture: 'appointment-focused, punctual'
    },
    'de': {
      country: 'Germany',
      currency: 'EUR', 
      culture: 'German efficiency and thoroughness',
      greeting_style: 'formal but warm',
      time_format: '24-hour',
      date_format: 'DD.MM.YYYY',
      business_culture: 'structured, detail-oriented'
    },
    'fr': {
      country: 'France',
      currency: 'EUR',
      culture: 'French elegance and courtesy',
      greeting_style: 'polite and refined',
      time_format: '24-hour', 
      date_format: 'DD/MM/YYYY',
      business_culture: 'relationship-focused, sophisticated'
    },
    'en': {
      country: 'International',
      currency: 'EUR',
      culture: 'International professional',
      greeting_style: 'friendly and helpful',
      time_format: '12-hour',
      date_format: 'MM/DD/YYYY', 
      business_culture: 'service-oriented, flexible'
    }
  };
  
  return contexts[language] || contexts['en'];
}

/**
 * Build localized context for voice agent
 */
function buildLocalizedContext(agentContext) {
  const language = agentContext.language;
  const countryCtx = agentContext.country_context;
  
  const localizations = {
    'nl': {
      voice_id: 'bIHbv24MWmeRgasZH58o', // Dutch female voice
      system_prompt: `Je bent de AI stem-assistent voor ${agentContext.salon_name}, een beautysalon in Nederland. 

BELANGRIJKE INSTRUCTIES:
- Spreek altijd in het Nederlands
- Wees ${agentContext.personality === 'friendly' ? 'vriendelijk en toegankelijk' : 'professioneel en behulpzaam'}
- Gebruik Nederlandse hofelijkheidsnormen
- Prijzen worden altijd in euro's (€) genoemd
- Tijden in 24-uurs formaat (bijv. "14:00" niet "2 PM")

BESCHIKBARE DIENSTEN:
${agentContext.services}

OPENINGSTIJDEN:
${agentContext.business_hours}

JE KUNT HELPEN MET:
- Afspraken maken en beheren
- Vragen over diensten en prijzen beantwoorden
- Algemene informatie over de salon verstrekken
- Doorverbinden naar een medewerker voor complexe verzoeken

BELANGRIJKE CULTURELE CONTEXT:
- Nederlandse klanten waarderen directheid maar ook vriendelijkheid
- Wees punctueel en duidelijk over tijden en prijzen
- Bied praktische oplossingen aan

Begin elke gesprek met een warme begroeting in het Nederlands.`,
      
      common_phrases: {
        greeting: "Goedemorgen! U spreekt met de digitale assistent van {salon_name}. Waarmee kan ik u helpen?",
        booking: "Ik kan u graag helpen met het maken van een afspraak.",
        services: "Onze populaire behandelingen zijn",
        pricing: "De prijs voor deze behandeling is",
        availability: "Laat me even kijken naar beschikbare tijden voor u.",
        goodbye: "Dank u wel voor uw interesse in {salon_name}. Tot ziens!"
      }
    },
    
    'de': {
      voice_id: 'EXAVITQu4vr4xnSDxMaL', // German female voice
      system_prompt: `Sie sind die KI-Sprachassistentin für ${agentContext.salon_name}, einen Beautysalon in Deutschland.

WICHTIGE ANWEISUNGEN:
- Sprechen Sie immer auf Deutsch
- Seien Sie ${agentContext.personality === 'friendly' ? 'freundlich und herzlich' : 'professionell und hilfsbereit'}
- Verwenden Sie deutsche Höflichkeitsformen (Sie/Ihnen)
- Preise immer in Euro (€) angeben
- Zeiten im 24-Stunden-Format (z.B. "14:00" nicht "2 PM")

VERFÜGBARE DIENSTLEISTUNGEN:
${agentContext.services}

ÖFFNUNGSZEITEN:
${agentContext.business_hours}

ICH KANN IHNEN HELFEN MIT:
- Terminbuchungen und -verwaltung
- Fragen zu Dienstleistungen und Preisen
- Allgemeine Informationen über den Salon
- Weiterleitung an einen Mitarbeiter für komplexe Anfragen

WICHTIGER KULTURELLER KONTEXT:
- Deutsche Kunden schätzen Pünktlichkeit und Zuverlässigkeit
- Seien Sie gründlich und detailliert in Ihren Antworten
- Bieten Sie strukturierte und klare Lösungen an

Beginnen Sie jedes Gespräch mit einer höflichen Begrüßung auf Deutsch.`,
      
      common_phrases: {
        greeting: "Guten Tag! Sie sprechen mit der digitalen Assistentin von {salon_name}. Wie kann ich Ihnen behilflich sein?",
        booking: "Gerne helfe ich Ihnen bei der Terminvereinbarung.",
        services: "Unsere beliebten Behandlungen sind",
        pricing: "Der Preis für diese Behandlung beträgt",
        availability: "Lassen Sie mich die verfügbaren Termine für Sie prüfen.",
        goodbye: "Vielen Dank für Ihr Interesse an {salon_name}. Auf Wiederhören!"
      }
    },
    
    'fr': {
      voice_id: 'Xb7hH8MSUJpSbSDYk0k2', // French female voice  
      system_prompt: `Vous êtes l'assistante vocale IA pour ${agentContext.salon_name}, un salon de beauté en France.

INSTRUCTIONS IMPORTANTES:
- Parlez toujours en français
- Soyez ${agentContext.personality === 'friendly' ? 'amicale et chaleureuse' : 'professionnelle et serviable'}
- Utilisez les formules de politesse françaises appropriées
- Les prix sont toujours en euros (€)
- Les heures au format 24h (ex: "14h00" pas "2 PM")

SERVICES DISPONIBLES:
${agentContext.services}

HORAIRES D'OUVERTURE:
${agentContext.business_hours}

JE PEUX VOUS AIDER AVEC:
- La prise et gestion de rendez-vous
- Les questions sur les services et tarifs
- Les informations générales sur le salon
- Le transfert vers un conseiller pour les demandes complexes

CONTEXTE CULTUREL IMPORTANT:
- Les clients français apprécient la courtoisie et l'élégance
- Soyez attentive aux détails et aux préférences personnelles
- Offrez des solutions raffinées et personnalisées

Commencez chaque conversation par une salutation polie en français.`,
      
      common_phrases: {
        greeting: "Bonjour! Vous parlez avec l'assistante numérique de {salon_name}. Comment puis-je vous aider?",
        booking: "Je serais ravie de vous aider à prendre rendez-vous.",
        services: "Nos soins les plus populaires sont",
        pricing: "Le tarif pour ce soin est de",
        availability: "Permettez-moi de vérifier les créneaux disponibles pour vous.",
        goodbye: "Merci de votre intérêt pour {salon_name}. Au revoir!"
      }
    },
    
    'en': {
      voice_id: 'AZnzlk1XvdvUeBnXmlld', // English female voice
      system_prompt: `You are the AI voice assistant for ${agentContext.salon_name}, a beauty salon serving international clients.

IMPORTANT INSTRUCTIONS:
- Always speak in clear, professional English
- Be ${agentContext.personality === 'friendly' ? 'friendly and approachable' : 'professional and helpful'}
- Use international English (avoid local slang)
- Prices always in euros (€)
- Times in 24-hour format for clarity (e.g. "14:00" not "2 PM")

AVAILABLE SERVICES:
${agentContext.services}

BUSINESS HOURS:
${agentContext.business_hours}

I CAN HELP YOU WITH:
- Booking and managing appointments
- Questions about services and pricing
- General information about the salon
- Connecting you with a staff member for complex requests

IMPORTANT CULTURAL CONTEXT:
- International clients appreciate clear communication
- Be flexible and accommodating with different cultural preferences
- Provide comprehensive and helpful information

Begin each conversation with a warm, professional greeting in English.`,
      
      common_phrases: {
        greeting: "Good day! You're speaking with the digital assistant for {salon_name}. How may I help you today?",
        booking: "I'd be happy to help you schedule an appointment.",
        services: "Our popular treatments include",
        pricing: "The price for this treatment is",
        availability: "Let me check available appointment times for you.",
        goodbye: "Thank you for your interest in {salon_name}. Have a wonderful day!"
      }
    }
  };
  
  return localizations[language] || localizations['en'];
}

/**
 * Get localized response for common scenarios
 */
function getLocalizedResponse(language, scenarioKey, replacements = {}) {
  const localization = buildLocalizedContext({ language }).common_phrases;
  let response = localization[scenarioKey] || localization.greeting;
  
  // Replace placeholders
  Object.keys(replacements).forEach(key => {
    response = response.replace(`{${key}}`, replacements[key]);
  });
  
  return response;
}

/**
 * Get after-hours message in the appropriate language
 */
function getAfterHoursMessage(language, salonName) {
  const messages = {
    'nl': `Bedankt voor het bellen naar ${salonName}. We zijn momenteel gesloten. Onze openingstijden zijn maandag tot vrijdag van 9:00 tot 18:00, en zaterdag van 9:00 tot 17:00. U kunt ons ook een WhatsApp bericht sturen voor het maken van een afspraak. Fijne dag nog!`,
    
    'de': `Vielen Dank für Ihren Anruf bei ${salonName}. Wir sind derzeit geschlossen. Unsere Öffnungszeiten sind Montag bis Freitag von 9:00 bis 18:00 Uhr und Samstag von 9:00 bis 17:00 Uhr. Sie können uns auch gerne eine WhatsApp-Nachricht senden, um einen Termin zu vereinbaren. Schönen Tag noch!`,
    
    'fr': `Merci d'avoir appelé ${salonName}. Nous sommes actuellement fermés. Nos horaires d'ouverture sont du lundi au vendredi de 9h00 à 18h00, et le samedi de 9h00 à 17h00. Vous pouvez également nous envoyer un message WhatsApp pour prendre rendez-vous. Bonne journée!`,
    
    'en': `Thank you for calling ${salonName}. We are currently closed. Our business hours are Monday through Friday from 9:00 AM to 6:00 PM, and Saturday from 9:00 AM to 5:00 PM. You can also send us a WhatsApp message to schedule an appointment. Have a great day!`
  };
  
  return messages[language] || messages['en'];
}

/**
 * Detect language from customer phone number or context
 */
function detectCustomerLanguage(phoneNumber, customerContext = {}) {
  // Phone number country code mapping
  const countryToLanguage = {
    '+31': 'nl', // Netherlands
    '+32': 'nl', // Belgium (Dutch speaking regions)
    '+49': 'de', // Germany  
    '+43': 'de', // Austria
    '+41': 'de', // Switzerland (German speaking)
    '+33': 'fr', // France
    '+352': 'fr', // Luxembourg (French speaking)
  };
  
  // Check customer preferences first
  if (customerContext.preferred_language) {
    return customerContext.preferred_language;
  }
  
  // Detect from phone number
  for (const [prefix, language] of Object.entries(countryToLanguage)) {
    if (phoneNumber.startsWith(prefix)) {
      return language;
    }
  }
  
  // Default to Dutch for EU region
  return 'nl';
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Check if salon is currently open
 */
async function checkSalonHours(salon) {
  const now = new Date();
  const dayOfWeek = now.toLocaleLowerCase().slice(0, 3); // 'mon', 'tue', etc.
  const currentTime = now.toTimeString().slice(0, 5); // 'HH:MM'
  
  const businessHours = salon.settings?.business_hours?.[dayOfWeek];
  
  if (!businessHours || !businessHours.is_open) {
    return false;
  }
  
  return currentTime >= businessHours.open_time && currentTime <= businessHours.close_time;
}

/**
 * Format business hours for agent context
 */
function formatBusinessHours(businessHours) {
  if (!businessHours) return 'Business hours not configured';
  
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const openDays = days
    .filter(day => businessHours[day]?.is_open)
    .map(day => `${day}: ${businessHours[day].open_time}-${businessHours[day].close_time}`)
    .join(', ');
    
  return openDays || 'Closed all days';
}

// =============================================================================
// CALLBACK QUEUE PROCESSING
// =============================================================================

/**
 * Process pending callbacks from the queue
 */
app.post('/callbacks/process', async (req, res) => {
  try {
    // Validate API key
    if (req.headers['x-api-key'] !== process.env.SERVICE_API_KEY) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { limit = 10 } = req.body;

    // Get pending callbacks that are ready to process
    const { data: callbacks, error } = await supabase
      .from('callback_queue')
      .select(`
        *,
        salons!inner(
          id,
          business_name,
          twilio_phone_number,
          settings
        )
      `)
      .in('status', ['pending', 'scheduled'])
      .lte('process_after', new Date().toISOString())
      .lt('attempts', supabase.raw('max_attempts'))
      .order('process_after', { ascending: true })
      .limit(limit);

    if (error) {
      console.error('Error fetching callbacks from queue:', error);
      return res.status(500).json({ error: 'Failed to fetch callbacks' });
    }

    const results = [];

    for (const callback of callbacks) {
      try {
        console.log(`📞 Processing callback: ${callback.id} for ${callback.phone_number}`);

        // Update status to in_progress
        await supabase
          .from('callback_queue')
          .update({ 
            status: 'in_progress',
            last_attempt_at: new Date().toISOString(),
            attempts: callback.attempts + 1
          })
          .eq('id', callback.id);

        // Initiate the callback
        const callResult = await initiateCallbackCall(callback);

        if (callResult.success) {
          // Update queue entry with success
          await supabase
            .from('callback_queue')
            .update({
              status: 'completed',
              final_call_sid: callResult.call_sid,
              completion_status: 'call_initiated',
              notes: `Callback call initiated successfully`
            })
            .eq('id', callback.id);

          results.push({
            queue_id: callback.id,
            status: 'success',
            call_sid: callResult.call_sid
          });

        } else {
          // Handle failure
          const shouldRetry = callback.attempts + 1 < callback.max_attempts;
          
          if (shouldRetry) {
            // Schedule retry
            const retryDelay = Math.min(30, (callback.attempts + 1) * 10); // Progressive delay
            const nextAttempt = new Date(Date.now() + (retryDelay * 60 * 1000));
            
            await supabase
              .from('callback_queue')
              .update({
                status: 'pending',
                process_after: nextAttempt.toISOString(),
                notes: `Attempt ${callback.attempts + 1} failed: ${callResult.error}. Retry scheduled.`
              })
              .eq('id', callback.id);

            results.push({
              queue_id: callback.id,
              status: 'retry_scheduled',
              retry_at: nextAttempt.toISOString(),
              error: callResult.error
            });

          } else {
            // Max attempts reached
            await supabase
              .from('callback_queue')
              .update({
                status: 'failed',
                completion_status: 'max_attempts_reached',
                notes: `Failed after ${callback.attempts + 1} attempts: ${callResult.error}`
              })
              .eq('id', callback.id);

            results.push({
              queue_id: callback.id,
              status: 'failed',
              error: callResult.error,
              attempts: callback.attempts + 1
            });
          }
        }

      } catch (error) {
        console.error(`Error processing callback ${callback.id}:`, error);
        
        // Mark as failed
        await supabase
          .from('callback_queue')
          .update({
            status: 'failed',
            completion_status: 'processing_error',
            notes: `Processing error: ${error.message}`
          })
          .eq('id', callback.id);

        results.push({
          queue_id: callback.id,
          status: 'error',
          error: error.message
        });
      }
    }

    console.log(`✅ Processed ${results.length} callbacks from queue`);

    res.json({
      success: true,
      processed: results.length,
      results: results
    });

  } catch (error) {
    console.error('Error processing callback queue:', error);
    res.status(500).json({ 
      error: 'Failed to process callback queue',
      details: error.message 
    });
  }
});

/**
 * Initiate a callback call from the queue
 */
async function initiateCallbackCall(callbackEntry) {
  try {
    const salon = callbackEntry.salons;
    const customerContext = callbackEntry.customer_context || {};
    
    // Build campaign context for voice agent
    const campaignContext = {
      ...callbackEntry.campaign_context,
      callback_type: callbackEntry.campaign_type,
      queue_id: callbackEntry.id,
      customer_context: customerContext,
      personalization: {
        customer_name: customerContext.customer_name,
        is_existing_customer: customerContext.is_existing_customer,
        last_visit: customerContext.last_visit,
        preferred_language: customerContext.preferred_language || 'nl'
      }
    };

    // Create the outbound call
    const call = await twilioClient.calls.create({
      from: salon.twilio_phone_number,
      to: callbackEntry.phone_number,
      url: `${process.env.BASE_URL}/twilio/voice/outbound?campaign=${callbackEntry.campaign_type}&queue_id=${callbackEntry.id}`,
      statusCallback: `${process.env.BASE_URL}/twilio/voice/status`,
      statusCallbackEvent: ['initiated', 'answered', 'completed'],
      timeout: 25 // Slightly shorter timeout for callbacks
    });

    // Create call session for callback
    const callSession = new CallSession(call.sid, salon.id, callbackEntry.phone_number, 'outbound');
    callSession.conversationContext = {
      campaign_type: callbackEntry.campaign_type,
      campaign_context: campaignContext,
      callback_queue_id: callbackEntry.id,
      original_missed_call: callbackEntry.campaign_context?.original_call_sid
    };
    
    activeCalls.set(call.sid, callSession);

    console.log(`📞 Callback call initiated: ${call.sid} for queue entry ${callbackEntry.id}`);

    return {
      success: true,
      call_sid: call.sid,
      status: call.status
    };

  } catch (error) {
    console.error('Error initiating callback call:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get callback queue status
 */
app.get('/callbacks/status', async (req, res) => {
  try {
    // Validate API key
    if (req.headers['x-api-key'] !== process.env.SERVICE_API_KEY) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { data: queueStats } = await supabase
      .from('callback_queue')
      .select('status')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()); // Last 24 hours

    const stats = queueStats.reduce((acc, entry) => {
      acc[entry.status] = (acc[entry.status] || 0) + 1;
      return acc;
    }, {});

    res.json({
      success: true,
      last_24_hours: stats,
      total_pending: stats.pending || 0,
      total_scheduled: stats.scheduled || 0,
      total_in_progress: stats.in_progress || 0,
      total_completed: stats.completed || 0,
      total_failed: stats.failed || 0
    });

  } catch (error) {
    console.error('Error getting callback status:', error);
    res.status(500).json({ 
      error: 'Failed to get callback status',
      details: error.message 
    });
  }
});

// =============================================================================
// REVIEW COLLECTION API - TACTICAL IMPLEMENTATION
// =============================================================================

/**
 * Check if salon has sufficient budget for voice calls
 */
async function checkVoiceBudget(salonId) {
  try {
    // Get salon settings and current usage
    const { data: salon, error: salonError } = await supabase
      .from('salons')
      .select('voice_agent_settings')
      .eq('id', salonId)
      .single();

    if (salonError || !salon) {
      return { allowed: false, reason: 'Salon not found' };
    }

    const settings = salon.voice_agent_settings || {};
    const dailyBudgetEuros = settings.cost_budget_daily_euros || 50;

    // Get today's voice call costs
    const today = new Date().toISOString().split('T')[0];
    const { data: todaysCalls, error: callsError } = await supabase
      .from('call_logs')
      .select('cost_usd')
      .eq('salon_id', salonId)
      .gte('created_at', `${today}T00:00:00Z`)
      .lt('created_at', `${today}T23:59:59Z`);

    if (callsError) {
      console.warn('Error checking today\'s calls:', callsError);
      return { allowed: true, reason: 'Unable to verify budget, allowing call' };
    }

    const todaysCostUsd = todaysCalls.reduce((sum, call) => sum + (call.cost_usd || 0), 0);
    const todaysCostEuros = todaysCostUsd * 0.92; // Approximate USD to EUR conversion
    const remainingBudget = dailyBudgetEuros - todaysCostEuros;

    // Estimate cost per call (approximately €0.50 for review calls)
    const estimatedCallCost = 0.50;

    return {
      allowed: remainingBudget >= estimatedCallCost,
      remaining_budget_euros: remainingBudget,
      daily_budget_euros: dailyBudgetEuros,
      used_today_euros: todaysCostEuros,
      estimated_call_cost: estimatedCallCost
    };

  } catch (error) {
    console.error('Budget check error:', error);
    return { allowed: true, reason: 'Budget check failed, allowing call' };
  }
}

/**
 * Generate personalized review request script
 */
function generateReviewScript(customerData, language = 'nl') {
  const { customer_name, service_type, service_date, salon_name } = customerData;

  const scripts = {
    'nl': {
      greeting: `Hallo ${customer_name || ''}! U spreekt met de digitale assistent van ${salon_name}.`,
      purpose: `Ik bel u over uw recente ${service_type || 'behandeling'} van ${service_date ? new Date(service_date).toLocaleDateString('nl-NL') : 'recent'}.`,
      request: `We hopen dat u tevreden bent met de service. Zou u ons willen helpen door een korte review achter te laten?`,
      instruction: `U kunt uw ervaring delen door op onze Google pagina of website. Heeft u een minuutje om dit te doen?`,
      thanks: `Dank u wel voor uw tijd en we hopen u binnenkort weer te zien!`
    },
    'de': {
      greeting: `Hallo ${customer_name || ''}! Sie sprechen mit der digitalen Assistentin von ${salon_name}.`,
      purpose: `Ich rufe Sie bezüglich Ihrer kürzlichen ${service_type || 'Behandlung'} vom ${service_date ? new Date(service_date).toLocaleDateString('de-DE') : 'vor kurzem'} an.`,
      request: `Wir hoffen, dass Sie mit unserem Service zufrieden waren. Würden Sie uns helfen, indem Sie eine kurze Bewertung hinterlassen?`,
      instruction: `Sie können Ihre Erfahrung auf unserer Google-Seite oder Website teilen. Haben Sie eine Minute Zeit dafür?`,
      thanks: `Vielen Dank für Ihre Zeit und wir hoffen, Sie bald wiederzusehen!`
    },
    'fr': {
      greeting: `Bonjour ${customer_name || ''} ! Vous parlez avec l'assistante numérique de ${salon_name}.`,
      purpose: `Je vous appelle concernant votre récent ${service_type || 'soin'} du ${service_date ? new Date(service_date).toLocaleDateString('fr-FR') : 'récemment'}.`,
      request: `Nous espérons que vous êtes satisfait(e) de notre service. Pourriez-vous nous aider en laissant un court avis?`,
      instruction: `Vous pouvez partager votre expérience sur notre page Google ou notre site web. Avez-vous une minute pour le faire?`,
      thanks: `Merci pour votre temps et nous espérons vous revoir bientôt!`
    },
    'en': {
      greeting: `Hello ${customer_name || ''}! You're speaking with the digital assistant from ${salon_name}.`,
      purpose: `I'm calling about your recent ${service_type || 'treatment'} from ${service_date ? new Date(service_date).toLocaleDateString('en-US') : 'recently'}.`,
      request: `We hope you were satisfied with our service. Would you help us by leaving a brief review?`,
      instruction: `You can share your experience on our Google page or website. Do you have a minute to do this?`,
      thanks: `Thank you for your time and we hope to see you again soon!`
    }
  };

  const script = scripts[language] || scripts['en'];
  return `${script.greeting} ${script.purpose} ${script.request} ${script.instruction} ${script.thanks}`;
}

/**
 * Review Request - Tactical Implementation
 * POST /api/v1/calls/review-request
 */
app.post('/api/v1/calls/review-request', async (req, res) => {
  try {
    const {
      salon_id,
      customer_phone,
      customer_name,
      customer_id = null,
      service_type,
      service_date,
      language = null // Will be auto-detected if not provided
    } = req.body;

    // Validate required fields
    if (!salon_id || !customer_phone) {
      return res.status(400).json({
        error: 'Missing required fields: salon_id, customer_phone'
      });
    }

    console.log(`📞 Review request initiated for ${customer_phone} from salon ${salon_id}`);

    // STEP 1: Check consent for review requests
    const { data: consent, error: consentError } = await supabase
      .from('contact_consent')
      .select('*')
      .eq('phone_number', customer_phone)
      .eq('campaign_type', 'REVIEW_REQUEST')
      .eq('salon_id', salon_id)
      .eq('consent_status', 'OPTED_IN')
      .is('revoked_at', null)
      .single();

    if (consentError && consentError.code !== 'PGRST116') {
      console.error('Consent check error:', consentError);
      return res.status(500).json({ error: 'Failed to verify consent' });
    }

    if (!consent) {
      console.log(`❌ No consent found for ${customer_phone} - REVIEW_REQUEST`);
      return res.status(403).json({
        error: 'No valid consent for review requests',
        consent_required: true,
        campaign_type: 'REVIEW_REQUEST'
      });
    }

    // STEP 2: Check budget limits
    const budgetCheck = await checkVoiceBudget(salon_id);
    if (!budgetCheck.allowed) {
      console.log(`💰 Budget limit reached for salon ${salon_id}`);
      return res.status(402).json({
        error: 'Daily voice budget exceeded',
        budget_info: budgetCheck
      });
    }

    // STEP 3: Get salon information
    const { data: salon, error: salonError } = await supabase
      .from('salons')
      .select('business_name, twilio_phone_number, voice_agent_settings')
      .eq('id', salon_id)
      .single();

    if (salonError || !salon) {
      return res.status(404).json({ error: 'Salon not found' });
    }

    if (!salon.twilio_phone_number) {
      return res.status(400).json({ error: 'Salon does not have a Twilio phone number configured' });
    }

    // STEP 4: Detect language or use provided
    const detectedLanguage = language || detectCustomerLanguage(customer_phone, { preferred_language: null });

    // STEP 5: Generate personalized script
    const reviewScript = generateReviewScript({
      customer_name,
      service_type,
      service_date,
      salon_name: salon.business_name
    }, detectedLanguage);

    // STEP 6: Initiate call via Twilio
    const call = await twilioClient.calls.create({
      to: customer_phone,
      from: salon.twilio_phone_number,
      url: `${process.env.APP_BASE_URL || 'https://voice-gateway.onrender.com'}/twiml/review-call`,
      method: 'POST',
      statusCallback: `${process.env.APP_BASE_URL || 'https://voice-gateway.onrender.com'}/twilio/voice/status`,
      statusCallbackMethod: 'POST',
      timeout: 30
    });

    console.log(`✅ Review call initiated: ${call.sid} to ${customer_phone}`);

    // STEP 7: Log the call
    const { error: logError } = await supabase
      .from('call_logs')
      .insert({
        twilio_call_sid: call.sid,
        salon_id: salon_id,
        customer_id: customer_id,
        phone_number: customer_phone,
        direction: 'outbound',
        call_status: 'initiated',
        campaign_type: 'review_request',
        conversation_context: {
          script: reviewScript,
          language: detectedLanguage,
          customer_name,
          service_type,
          service_date,
          campaign_context: 'tactical_review_collection'
        }
      });

    if (logError) {
      console.warn('Failed to log call:', logError);
    }

    res.status(201).json({
      success: true,
      call_sid: call.sid,
      message: 'Review request call initiated',
      language: detectedLanguage,
      budget_remaining: budgetCheck.remaining_budget_euros
    });

  } catch (error) {
    console.error('Review request error:', error);
    res.status(500).json({ 
      error: 'Failed to initiate review request call',
      details: error.message 
    });
  }
});

/**
 * TwiML endpoint for review calls
 * POST /twiml/review-call
 */
app.post('/twiml/review-call', async (req, res) => {
  try {
    const { CallSid, From, To } = req.body;

    console.log(`🎙️  Handling review call TwiML: ${CallSid} from ${From}`);

    // Get call context from call_logs
    const { data: callLog, error } = await supabase
      .from('call_logs')
      .select('conversation_context, salon_id')
      .eq('twilio_call_sid', CallSid)
      .single();

    if (error || !callLog) {
      console.warn('Call log not found for review call:', CallSid);
      // Fallback response
      res.type('text/xml').send(`
        <Response>
          <Say voice="alice" language="nl-NL">
            Hallo! Bedankt voor het opnemen. We hopen dat u tevreden bent met onze service. 
            Zou u ons willen helpen door een review achter te laten? Dank u wel!
          </Say>
          <Hangup/>
        </Response>
      `);
      return;
    }

    const context = callLog.conversation_context || {};
    const language = context.language || 'nl';
    const script = context.script || 'Thank you for your time!';

    // Map language to Twilio voice settings
    const voiceSettings = {
      'nl': { voice: 'alice', language: 'nl-NL' },
      'de': { voice: 'alice', language: 'de-DE' },
      'fr': { voice: 'alice', language: 'fr-FR' },
      'en': { voice: 'alice', language: 'en-US' }
    };

    const voice = voiceSettings[language] || voiceSettings['en'];

    console.log(`🗣️  Playing review script in ${language} for ${CallSid}`);

    // Generate TwiML response
    res.type('text/xml').send(`
      <Response>
        <Say voice="${voice.voice}" language="${voice.language}">
          ${script}
        </Say>
        <Pause length="2"/>
        <Say voice="${voice.voice}" language="${voice.language}">
          ${language === 'nl' ? 'Nogmaals bedankt en tot ziens!' : 
            language === 'de' ? 'Nochmals vielen Dank und auf Wiederhören!' :
            language === 'fr' ? 'Merci encore et au revoir!' : 
            'Thank you again and goodbye!'}
        </Say>
        <Hangup/>
      </Response>
    `);

    // Update call status
    await supabase
      .from('call_logs')
      .update({ 
        call_status: 'completed',
        summary: `Review request call completed in ${language}`,
        outcome: { 
          script_delivered: true, 
          language: language,
          campaign_type: 'review_request'
        }
      })
      .eq('twilio_call_sid', CallSid);

  } catch (error) {
    console.error('TwiML review call error:', error);
    
    // Fallback TwiML response
    res.type('text/xml').send(`
      <Response>
        <Say voice="alice">
          Thank you for your time. We hope you were satisfied with our service. 
          Please consider leaving us a review. Goodbye!
        </Say>
        <Hangup/>
      </Response>
    `);
  }
});

// =============================================================================
// CONSENT MANAGEMENT API - TCPA/GDPR COMPLIANCE
// =============================================================================

/**
 * Check consent status for a phone number and campaign type
 * GET /api/v1/consent/check?phone_number={phone}&campaign_type={type}&salon_id={id}
 */
app.get('/api/v1/consent/check', async (req, res) => {
  try {
    const { phone_number, campaign_type, salon_id } = req.query;

    if (!phone_number || !campaign_type || !salon_id) {
      return res.status(400).json({
        error: 'Missing required parameters: phone_number, campaign_type, salon_id'
      });
    }

    // Check for explicit consent record
    const { data: consent, error } = await supabase
      .from('contact_consent')
      .select('*')
      .eq('phone_number', phone_number)
      .eq('campaign_type', campaign_type)
      .eq('salon_id', salon_id)
      .eq('consent_status', 'OPTED_IN')
      .is('revoked_at', null)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error checking consent:', error);
      return res.status(500).json({ error: 'Failed to check consent' });
    }

    const hasConsent = !!consent;
    const isValid = hasConsent && (
      !consent.consent_expires_at || 
      new Date(consent.consent_expires_at) > new Date()
    );

    res.json({
      has_consent: hasConsent,
      is_valid: isValid,
      consent_record: consent || null,
      checked_at: new Date().toISOString()
    });

  } catch (error) {
    console.error('Consent check error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Record new consent for a customer
 * POST /api/v1/consent
 */
app.post('/api/v1/consent', async (req, res) => {
  try {
    const {
      customer_id,
      salon_id,
      phone_number,
      campaign_type,
      source_of_consent,
      consent_method,
      consent_text,
      consent_language = 'nl',
      ip_address,
      user_agent,
      privacy_policy_version,
      terms_version,
      expires_in_days = null
    } = req.body;

    // Validate required fields
    if (!salon_id || !phone_number || !campaign_type || !source_of_consent) {
      return res.status(400).json({
        error: 'Missing required fields: salon_id, phone_number, campaign_type, source_of_consent'
      });
    }

    // Calculate expiration if specified
    const consent_expires_at = expires_in_days 
      ? new Date(Date.now() + (expires_in_days * 24 * 60 * 60 * 1000))
      : null;

    // Insert or update consent record
    const { data: consent, error } = await supabase
      .from('contact_consent')
      .upsert({
        customer_id,
        salon_id,
        phone_number,
        campaign_type,
        consent_status: 'OPTED_IN',
        source_of_consent,
        consent_method,
        consent_text,
        consent_language,
        ip_address,
        user_agent,
        privacy_policy_version,
        terms_version,
        consent_expires_at: consent_expires_at?.toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'customer_id,salon_id,phone_number,campaign_type'
      })
      .select()
      .single();

    if (error) {
      console.error('Error recording consent:', error);
      return res.status(500).json({ error: 'Failed to record consent' });
    }

    console.log(`✅ Consent recorded: ${phone_number} for ${campaign_type}`);

    res.status(201).json({
      success: true,
      consent_id: consent.consent_id,
      message: 'Consent recorded successfully'
    });

  } catch (error) {
    console.error('Record consent error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Update consent status
 * PUT /api/v1/consent/{consent_id}
 */
app.put('/api/v1/consent/:consent_id', async (req, res) => {
  try {
    const { consent_id } = req.params;
    const { 
      consent_status, 
      revocation_reason, 
      notes,
      ip_address,
      user_agent 
    } = req.body;

    if (!consent_status) {
      return res.status(400).json({ error: 'consent_status is required' });
    }

    const updateData = {
      consent_status,
      updated_at: new Date().toISOString(),
      notes
    };

    // If revoking consent, record revocation details
    if (consent_status === 'OPTED_OUT') {
      updateData.revoked_at = new Date().toISOString();
      updateData.revocation_reason = revocation_reason;
      
      if (ip_address) updateData.ip_address = ip_address;
      if (user_agent) updateData.user_agent = user_agent;
    }

    const { data: consent, error } = await supabase
      .from('contact_consent')
      .update(updateData)
      .eq('consent_id', consent_id)
      .select()
      .single();

    if (error) {
      console.error('Error updating consent:', error);
      return res.status(500).json({ error: 'Failed to update consent' });
    }

    if (!consent) {
      return res.status(404).json({ error: 'Consent record not found' });
    }

    console.log(`📝 Consent updated: ${consent_id} to ${consent_status}`);

    res.json({
      success: true,
      message: 'Consent updated successfully',
      consent_status: consent.consent_status
    });

  } catch (error) {
    console.error('Update consent error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Revoke consent (convenience endpoint)
 * DELETE /api/v1/consent/{consent_id}
 */
app.delete('/api/v1/consent/:consent_id', async (req, res) => {
  try {
    const { consent_id } = req.params;
    const { revocation_reason, ip_address, user_agent } = req.body;

    const { data: consent, error } = await supabase
      .from('contact_consent')
      .update({
        consent_status: 'OPTED_OUT',
        revoked_at: new Date().toISOString(),
        revocation_reason: revocation_reason || 'User requested revocation',
        ip_address,
        user_agent,
        updated_at: new Date().toISOString()
      })
      .eq('consent_id', consent_id)
      .select('phone_number, campaign_type')
      .single();

    if (error) {
      console.error('Error revoking consent:', error);
      return res.status(500).json({ error: 'Failed to revoke consent' });
    }

    if (!consent) {
      return res.status(404).json({ error: 'Consent record not found' });
    }

    console.log(`🚫 Consent revoked: ${consent.phone_number} for ${consent.campaign_type}`);

    res.json({
      success: true,
      message: 'Consent revoked successfully'
    });

  } catch (error) {
    console.error('Revoke consent error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// =============================================================================
// HEALTH CHECK & SERVER STARTUP
// =============================================================================
// CAMPAIGN ENGINE API ENDPOINTS
// =============================================================================

/**
 * Add job to campaign queue
 * POST /api/v1/campaigns/jobs
 */
app.post('/api/v1/campaigns/jobs', async (req, res) => {
  try {
    const {
      campaignType,
      salonId,
      customerId,
      customerPhone,
      campaignContext = {},
      voiceConfig = {},
      delay = 0,
      priority = 0
    } = req.body;

    // Validate required fields
    if (!campaignType || !salonId || !customerPhone) {
      return res.status(400).json({
        error: 'Missing required fields: campaignType, salonId, customerPhone'
      });
    }

    // Validate campaign type
    const validCampaignTypes = ['REVIEW_REQUEST', 'REACTIVATION', 'FOLLOW_UP', 'PROMOTIONAL', 'MISSED_CALL_CALLBACK'];
    if (!validCampaignTypes.includes(campaignType)) {
      return res.status(400).json({
        error: `Invalid campaign type. Must be one of: ${validCampaignTypes.join(', ')}`
      });
    }

    // Add job to queue
    const job = await addCampaignJob(campaignType, {
      salonId,
      customerId,
      customerPhone,
      campaignContext,
      voiceConfig
    }, {
      delay,
      priority
    });

    console.log(`📋 Campaign job created: ${job.id} (${campaignType})`);

    res.json({
      success: true,
      jobId: job.id,
      campaignType,
      queueName: job.queueName,
      delay,
      scheduled: delay > 0
    });

  } catch (error) {
    console.error('Campaign job creation error:', error);
    res.status(500).json({
      error: 'Failed to create campaign job',
      details: error.message
    });
  }
});

/**
 * Get campaign queue statistics
 * GET /api/v1/campaigns/stats
 */
app.get('/api/v1/campaigns/stats', async (req, res) => {
  try {
    const stats = await getCampaignQueueStats();
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      queues: stats,
      totalJobs: Object.values(stats).reduce((sum, queue) => 
        sum + queue.waiting + queue.active + queue.completed + queue.failed, 0
      )
    });

  } catch (error) {
    console.error('Campaign stats error:', error);
    res.status(500).json({
      error: 'Failed to get campaign statistics',
      details: error.message
    });
  }
});

/**
 * Validate campaign execution (for external systems)
 * POST /api/v1/campaigns/validate
 */
app.post('/api/v1/campaigns/validate', async (req, res) => {
  try {
    const { salonId, campaignType } = req.body;

    if (!salonId || !campaignType) {
      return res.status(400).json({
        error: 'Missing required fields: salonId, campaignType'
      });
    }

    const validation = await validateCampaignExecution(salonId, campaignType);
    
    res.json({
      success: true,
      validation,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Campaign validation error:', error);
    res.status(500).json({
      error: 'Failed to validate campaign execution',
      details: error.message
    });
  }
});

// =============================================================================
// HEALTH CHECK ENDPOINT
// =============================================================================

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'voice-gateway-service',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    active_calls: activeCalls.size,
    uptime: process.uptime(),
    features: {
      voice_agent: true,
      campaign_engine: true,
      multilingual_support: true,
      missed_call_detection: true
    }
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`🎙️  Voice Gateway Service running on port ${PORT}`);
  console.log(`📞 Twilio webhook URL: http://localhost:${PORT}/twilio/voice/incoming`);
  console.log(`🔌 WebSocket endpoint: ws://localhost:${PORT}/twilio/stream`);
  console.log(`📋 Health check: http://localhost:${PORT}/health`);
  
  // Initialize campaign workers for outbound calling
  console.log(`🚀 Initializing BullMQ campaign workers...`);
  try {
    initializeCampaignWorkers();
    console.log(`✅ Campaign Engine initialized successfully`);
  } catch (error) {
    console.error(`❌ Failed to initialize Campaign Engine:`, error.message);
  }
});