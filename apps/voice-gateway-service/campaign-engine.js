// =============================================================================
// CAMPAIGN ENGINE - BullMQ + Redis Job Queue for Outbound Voice Campaigns
// =============================================================================
// Reliable, scalable outbound calling system with retry logic and monitoring
// Supports: Review requests, reactivation calls, follow-ups, promotional campaigns
// =============================================================================

const { Queue, Worker, QueueEvents } = require('bullmq');
const Redis = require('ioredis');
const { createClient } = require('@supabase/supabase-js');
const twilio = require('twilio');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

// =============================================================================
// CONFIGURATION & INITIALIZATION
// =============================================================================

// Redis configuration
const REDIS_CONFIG = {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  db: process.env.REDIS_DB || 0,
  maxRetriesPerRequest: null, // Required by BullMQ for blocking commands
  retryDelayOnFailover: 100,
  lazyConnect: true
};

// Create Redis connection
const redis = new Redis(REDIS_CONFIG);

// Initialize services (gracefully handle missing credentials in dev)
let supabase = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

let twilioClient = null;
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
  twilioClient = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );
}

// =============================================================================
// CAMPAIGN QUEUE DEFINITIONS
// =============================================================================

// Queue names for different campaign types
const QUEUE_NAMES = {
  REVIEW_REQUESTS: 'voice-campaigns-review-requests',
  REACTIVATION: 'voice-campaigns-reactivation', 
  FOLLOW_UP: 'voice-campaigns-follow-up',
  PROMOTIONAL: 'voice-campaigns-promotional',
  MISSED_CALL_CALLBACK: 'voice-campaigns-missed-call-callback'
};

// Create queues with Redis connection
const campaignQueues = {};
const campaignWorkers = {};
const queueEvents = {};

Object.entries(QUEUE_NAMES).forEach(([type, queueName]) => {
  // Create queue
  campaignQueues[type] = new Queue(queueName, {
    connection: redis,
    defaultJobOptions: {
      removeOnComplete: 100, // Keep 100 completed jobs for monitoring
      removeOnFail: 50,      // Keep 50 failed jobs for debugging
      attempts: 3,           // Retry failed jobs up to 3 times
      backoff: {
        type: 'exponential',
        delay: 2000          // Start with 2s delay, exponential backoff
      }
    }
  });

  // Create queue events for monitoring
  queueEvents[type] = new QueueEvents(queueName, { connection: redis });
  
  // Log queue events
  queueEvents[type].on('completed', ({ jobId, returnvalue }) => {
    console.log(`✅ Campaign job completed: ${queueName}:${jobId}`);
  });
  
  queueEvents[type].on('failed', ({ jobId, failedReason }) => {
    console.error(`❌ Campaign job failed: ${queueName}:${jobId} - ${failedReason}`);
  });
});

// =============================================================================
// CAMPAIGN JOB PROCESSOR
// =============================================================================

/**
 * Generic campaign job processor for all outbound voice campaigns
 */
async function processCampaignJob(job) {
  const { 
    campaignType,
    salonId,
    customerId,
    customerPhone,
    campaignContext,
    voiceConfig 
  } = job.data;

  console.log(`🎯 Processing ${campaignType} campaign job: ${job.id} for ${customerPhone}`);

  try {
    // STEP 1: Validate campaign is still active and within budget
    const validationResult = await validateCampaignExecution(salonId, campaignType);
    if (!validationResult.allowed) {
      throw new Error(`Campaign execution blocked: ${validationResult.reason}`);
    }

    // STEP 2: Get salon and customer information
    const [salonData, customerData] = await Promise.all([
      getSalonData(salonId),
      getCustomerData(customerId, customerPhone, salonId)
    ]);

    // STEP 3: Check consent for this campaign type
    const consentCheck = await checkCampaignConsent(customerPhone, salonId, campaignType);
    if (!consentCheck.hasConsent) {
      throw new Error(`No valid consent for ${campaignType} campaign`);
    }

    // STEP 4: Generate personalized script based on campaign type
    const script = await generateCampaignScript(
      campaignType,
      campaignContext,
      customerData,
      salonData,
      voiceConfig
    );

    // STEP 5: Initiate outbound call via Twilio
    const callResult = await initiateOutboundCall({
      to: customerPhone,
      from: salonData.twilio_phone_number,
      script: script,
      campaignType: campaignType,
      salonId: salonId,
      customerId: customerId,
      voiceConfig: voiceConfig
    });

    // STEP 6: Log successful campaign execution
    await logCampaignExecution({
      jobId: job.id,
      campaignType,
      salonId,
      customerId,
      customerPhone,
      callSid: callResult.callSid,
      status: 'initiated',
      campaignContext
    });

    // STEP 7: Update campaign analytics
    await updateCampaignAnalytics(salonId, campaignType, 'call_initiated');

    return {
      success: true,
      callSid: callResult.callSid,
      jobId: job.id,
      campaignType,
      customerPhone
    };

  } catch (error) {
    console.error(`❌ Campaign job ${job.id} failed:`, error.message);
    
    // Log failed execution
    await logCampaignExecution({
      jobId: job.id,
      campaignType,
      salonId,
      customerId,
      customerPhone,
      status: 'failed',
      error: error.message,
      campaignContext
    });

    throw error; // Re-throw to trigger BullMQ retry logic
  }
}

// =============================================================================
// CAMPAIGN VALIDATION & DATA RETRIEVAL
// =============================================================================

/**
 * Validate if campaign can be executed (budget, limits, timing)
 */
async function validateCampaignExecution(salonId, campaignType) {
  try {
    if (!supabase) {
      return { 
        allowed: false, 
        reason: 'Database not configured - development environment' 
      };
    }

    // Check daily campaign limits
    const today = new Date().toISOString().split('T')[0];
    
    const { data: todayStats } = await supabase
      .from('voice_agent_analytics')
      .select('total_calls, total_cost_usd')
      .eq('salon_id', salonId)
      .eq('date_period', today)
      .eq('period_type', 'daily')
      .single();

    // Get salon voice settings
    const { data: salon } = await supabase
      .from('salons')
      .select('voice_agent_settings')
      .eq('id', salonId)
      .single();

    if (!salon) {
      return { allowed: false, reason: 'Salon not found' };
    }

    const voiceSettings = salon.voice_agent_settings || {};
    const dailyBudget = voiceSettings.cost_budget_daily_euros || 50;
    const dailyCallLimit = voiceSettings.max_calls_per_day || 100;
    
    // Check budget limits (convert EUR to USD approximately)
    const todayCostUSD = todayStats?.total_cost_usd || 0;
    const budgetLimitUSD = dailyBudget * 1.1; // Rough EUR to USD conversion
    
    if (todayCostUSD >= budgetLimitUSD) {
      return { allowed: false, reason: `Daily budget exceeded: $${todayCostUSD}/${budgetLimitUSD}` };
    }

    // Check call volume limits
    const todayCalls = todayStats?.total_calls || 0;
    if (todayCalls >= dailyCallLimit) {
      return { allowed: false, reason: `Daily call limit exceeded: ${todayCalls}/${dailyCallLimit}` };
    }

    // Check if campaign type is allowed
    const allowedCampaigns = voiceSettings.allowed_call_types || ['inbound'];
    const campaignTypeMap = {
      'REVIEW_REQUEST': 'review_request',
      'REACTIVATION': 'reactivation',
      'FOLLOW_UP': 'followup',
      'PROMOTIONAL': 'promotion',
      'MISSED_CALL_CALLBACK': 'callback'
    };
    
    const campaignKey = campaignTypeMap[campaignType];
    if (campaignKey && !allowedCampaigns.includes(campaignKey)) {
      return { allowed: false, reason: `Campaign type ${campaignType} not allowed for this salon` };
    }

    return { 
      allowed: true, 
      remainingBudget: budgetLimitUSD - todayCostUSD,
      remainingCalls: dailyCallLimit - todayCalls
    };

  } catch (error) {
    console.error('Campaign validation error:', error);
    return { allowed: false, reason: `Validation error: ${error.message}` };
  }
}

/**
 * Get salon data for campaign execution
 */
async function getSalonData(salonId) {
  if (!supabase) {
    throw new Error('Database not configured - development environment');
  }

  const { data: salon, error } = await supabase
    .from('salons')
    .select('business_name, twilio_phone_number, voice_agent_settings')
    .eq('id', salonId)
    .single();

  if (error || !salon) {
    throw new Error(`Salon data not found: ${salonId}`);
  }

  if (!salon.twilio_phone_number) {
    throw new Error(`Salon ${salonId} missing Twilio phone number configuration`);
  }

  return salon;
}

/**
 * Get customer data for personalized campaigns
 */
async function getCustomerData(customerId, customerPhone, salonId) {
  let customer = null;

  if (supabase) {
    // Try to get customer by ID first
    if (customerId) {
      const { data } = await supabase
        .from('customers')
        .select('*')
        .eq('id', customerId)
        .eq('salon_id', salonId)
        .single();
      customer = data;
    }

    // If not found by ID, try by phone number
    if (!customer && customerPhone) {
      const { data } = await supabase
        .from('customers')
        .select('*')
        .eq('phone', customerPhone)
        .eq('salon_id', salonId)
        .single();
      customer = data;
    }
  }

  // Return customer data or defaults
  return customer || {
    id: null,
    first_name: 'Valued Customer',
    phone: customerPhone,
    preferred_language: 'nl',
    salon_id: salonId
  };
}

// =============================================================================
// CAMPAIGN SCRIPT GENERATION
// =============================================================================

/**
 * Generate personalized campaign script based on type and context
 */
async function generateCampaignScript(campaignType, campaignContext, customerData, salonData, voiceConfig) {
  const language = voiceConfig.language || customerData.preferred_language || 'nl';
  const customerName = customerData.first_name || 'Valued Customer';
  const salonName = salonData.business_name;

  const scriptTemplates = {
    'REVIEW_REQUEST': {
      'nl': `Hallo ${customerName}, u spreekt met de digitale assistent van ${salonName}. We hopen dat u tevreden was met uw recente ${campaignContext.service_type || 'behandeling'}. Zou u een korte review willen achterlaten? Druk op 1 voor ja, of 2 als u liever niet deelneemt.`,
      'de': `Hallo ${customerName}, hier ist der digitale Assistent von ${salonName}. Wir hoffen, Sie waren zufrieden mit Ihrer ${campaignContext.service_type || 'Behandlung'}. Möchten Sie eine kurze Bewertung hinterlassen? Drücken Sie 1 für ja oder 2, wenn Sie nicht teilnehmen möchten.`,
      'fr': `Bonjour ${customerName}, vous parlez avec l'assistant numérique de ${salonName}. Nous espérons que vous avez été satisfait(e) de votre récent ${campaignContext.service_type || 'soin'}. Souhaitez-vous laisser un avis rapide? Appuyez sur 1 pour oui, ou 2 si vous préférez ne pas participer.`,
      'en': `Hello ${customerName}, this is the digital assistant from ${salonName}. We hope you were satisfied with your recent ${campaignContext.service_type || 'treatment'}. Would you like to leave a quick review? Press 1 for yes, or 2 if you prefer not to participate.`
    },
    
    'REACTIVATION': {
      'nl': `Hallo ${customerName}, u spreekt met ${salonName}. We missen u! Het is alweer een tijdje geleden dat u bij ons bent geweest. We hebben nieuwe behandelingen en speciale aanbiedingen. Zou u graag een afspraak willen maken? Druk op 1 om met een medewerker te spreken.`,
      'de': `Hallo ${customerName}, hier ist ${salonName}. Wir vermissen Sie! Es ist schon eine Weile her, dass Sie bei uns waren. Wir haben neue Behandlungen und Sonderangebote. Möchten Sie gerne einen Termin vereinbaren? Drücken Sie 1, um mit einem Mitarbeiter zu sprechen.`,
      'fr': `Bonjour ${customerName}, ici ${salonName}. Vous nous manquez! Cela fait un moment que vous n'êtes pas venu(e). Nous avons de nouveaux soins et des offres spéciales. Souhaitez-vous prendre rendez-vous? Appuyez sur 1 pour parler à un conseiller.`,
      'en': `Hello ${customerName}, this is ${salonName}. We miss you! It's been a while since your last visit. We have new treatments and special offers. Would you like to schedule an appointment? Press 1 to speak with a staff member.`
    },
    
    'FOLLOW_UP': {
      'nl': `Hallo ${customerName}, u spreekt met ${salonName}. We willen graag weten hoe u zich voelt na uw recente behandeling. Heeft u nog vragen of zou u een vervolgafspraak willen maken? Druk op 1 voor vragen, of 2 voor een nieuwe afspraak.`,
      'de': `Hallo ${customerName}, hier ist ${salonName}. Wir möchten gerne wissen, wie Sie sich nach Ihrer letzten Behandlung fühlen. Haben Sie noch Fragen oder möchten Sie einen Folgetermin vereinbaren? Drücken Sie 1 für Fragen oder 2 für einen neuen Termin.`,
      'fr': `Bonjour ${customerName}, ici ${salonName}. Nous aimerions savoir comment vous vous sentez après votre récent soin. Avez-vous des questions ou souhaitez-vous prendre un rendez-vous de suivi? Appuyez sur 1 pour des questions, ou 2 pour un nouveau rendez-vous.`,
      'en': `Hello ${customerName}, this is ${salonName}. We'd like to know how you're feeling after your recent treatment. Do you have any questions or would you like to schedule a follow-up appointment? Press 1 for questions, or 2 for a new appointment.`
    },

    'MISSED_CALL_CALLBACK': {
      'nl': `Hallo ${customerName}, u spreekt met ${salonName}. We zagen dat u ons heeft gebeld maar we konden uw oproep niet beantwoorden. Waarmee kunnen we u helpen? Druk op 1 voor het maken van een afspraak, of 2 voor algemene vragen.`,
      'de': `Hallo ${customerName}, hier ist ${salonName}. Wir haben gesehen, dass Sie uns angerufen haben, aber wir konnten Ihren Anruf nicht beantworten. Womit können wir Ihnen helfen? Drücken Sie 1 für Terminvereinbarung oder 2 für allgemeine Fragen.`,
      'fr': `Bonjour ${customerName}, ici ${salonName}. Nous avons vu que vous nous avez appelés mais nous n'avons pas pu répondre. Comment pouvons-nous vous aider? Appuyez sur 1 pour prendre rendez-vous, ou 2 pour des questions générales.`,
      'en': `Hello ${customerName}, this is ${salonName}. We saw that you called us but we couldn't answer your call. How can we help you? Press 1 to schedule an appointment, or 2 for general questions.`
    }
  };

  const template = scriptTemplates[campaignType];
  if (!template) {
    throw new Error(`Unknown campaign type: ${campaignType}`);
  }

  return template[language] || template['en'];
}

// =============================================================================
// TWILIO CALL INITIATION
// =============================================================================

/**
 * Initiate outbound call via Twilio with campaign script
 */
async function initiateOutboundCall({ to, from, script, campaignType, salonId, customerId, voiceConfig }) {
  try {
    if (!twilioClient) {
      throw new Error('Twilio not configured - development environment');
    }

    // Create TwiML URL for campaign script
    const twimlUrl = `${process.env.APP_BASE_URL || 'https://voice-gateway.onrender.com'}/twiml/campaign-call`;
    
    // Initiate call with Twilio
    const call = await twilioClient.calls.create({
      to: to,
      from: from,
      url: twimlUrl,
      method: 'POST',
      statusCallback: `${process.env.APP_BASE_URL || 'https://voice-gateway.onrender.com'}/twilio/voice/status`,
      statusCallbackMethod: 'POST',
      timeout: 30,
      // Pass campaign context in URL parameters
      url: `${twimlUrl}?campaign_type=${encodeURIComponent(campaignType)}&salon_id=${encodeURIComponent(salonId)}&customer_id=${encodeURIComponent(customerId || '')}&language=${encodeURIComponent(voiceConfig.language || 'nl')}&script=${encodeURIComponent(script)}`
    });

    console.log(`📞 Outbound campaign call initiated: ${call.sid} to ${to}`);

    return {
      success: true,
      callSid: call.sid,
      to: to,
      from: from,
      campaignType: campaignType
    };

  } catch (error) {
    console.error('Twilio call initiation failed:', error);
    throw new Error(`Failed to initiate call: ${error.message}`);
  }
}

// =============================================================================
// LOGGING & ANALYTICS
// =============================================================================

/**
 * Log campaign execution for tracking and analytics
 */
async function logCampaignExecution(executionData) {
  try {
    const { error } = await supabase
      .from('call_logs')
      .insert({
        twilio_call_sid: executionData.callSid || null,
        salon_id: executionData.salonId,
        customer_id: executionData.customerId,
        phone_number: executionData.customerPhone,
        direction: 'outbound',
        call_status: executionData.status,
        campaign_type: executionData.campaignType.toLowerCase(),
        campaign_id: executionData.jobId,
        conversation_context: {
          job_id: executionData.jobId,
          campaign_context: executionData.campaignContext,
          error: executionData.error || null
        }
      });

    if (error) {
      console.error('Failed to log campaign execution:', error);
    }
  } catch (error) {
    console.error('Campaign logging error:', error);
  }
}

/**
 * Update campaign analytics counters
 */
async function updateCampaignAnalytics(salonId, campaignType, eventType) {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // Prepare update data based on event type
    const updateData = {
      salon_id: salonId,
      date_period: today,
      period_type: 'daily'
    };

    if (eventType === 'call_initiated') {
      updateData.total_calls = 1;
      updateData.outbound_calls = 1;
      
      // Campaign-specific counters
      if (campaignType === 'REVIEW_REQUEST') {
        updateData.review_calls = 1;
      } else if (campaignType === 'REACTIVATION') {
        updateData.reactivation_calls = 1;
      } else if (campaignType === 'FOLLOW_UP') {
        updateData.followup_calls = 1;
      }
    }

    // Upsert analytics data
    const { error } = await supabase
      .from('voice_agent_analytics')
      .upsert(updateData, {
        onConflict: 'salon_id,date_period,period_type'
      });

    if (error) {
      console.error('Failed to update campaign analytics:', error);
    }
  } catch (error) {
    console.error('Campaign analytics error:', error);
  }
}

/**
 * Check campaign consent for GDPR/TCPA compliance
 */
async function checkCampaignConsent(phoneNumber, salonId, campaignType) {
  try {
    const { data: consent, error } = await supabase
      .from('contact_consent')
      .select('*')
      .eq('phone_number', phoneNumber)
      .eq('salon_id', salonId)
      .eq('campaign_type', campaignType)
      .eq('consent_status', 'OPTED_IN')
      .is('revoked_at', null)
      .single();

    return {
      hasConsent: !error && !!consent,
      consentData: consent || null,
      error: error?.message || null
    };
  } catch (error) {
    console.error('Consent check error:', error);
    return { hasConsent: false, error: error.message };
  }
}

// =============================================================================
// CAMPAIGN QUEUE MANAGEMENT API
// =============================================================================

/**
 * Add job to campaign queue
 */
async function addCampaignJob(campaignType, jobData, options = {}) {
  const queueKey = Object.keys(QUEUE_NAMES).find(key => 
    QUEUE_NAMES[key].includes(campaignType.toLowerCase()) ||
    key === campaignType
  );

  if (!queueKey) {
    throw new Error(`Unknown campaign type: ${campaignType}`);
  }

  const queue = campaignQueues[queueKey];
  const job = await queue.add(
    `campaign-${campaignType.toLowerCase()}`,
    {
      campaignType,
      ...jobData
    },
    {
      delay: options.delay || 0,
      priority: options.priority || 0,
      ...options
    }
  );

  console.log(`📋 Campaign job added: ${job.id} (${campaignType})`);
  return job;
}

/**
 * Get queue statistics
 */
async function getCampaignQueueStats() {
  const stats = {};
  
  for (const [type, queue] of Object.entries(campaignQueues)) {
    const [waiting, active, completed, failed] = await Promise.all([
      queue.getWaiting(),
      queue.getActive(), 
      queue.getCompleted(),
      queue.getFailed()
    ]);

    stats[type] = {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      queueName: QUEUE_NAMES[type]
    };
  }

  return stats;
}

// =============================================================================
// WORKER INITIALIZATION
// =============================================================================

/**
 * Initialize campaign workers for job processing
 */
function initializeCampaignWorkers() {
  Object.entries(QUEUE_NAMES).forEach(([type, queueName]) => {
    campaignWorkers[type] = new Worker(
      queueName,
      processCampaignJob,
      {
        connection: redis,
        concurrency: 5, // Process up to 5 jobs concurrently per worker
        removeOnComplete: 100,
        removeOnFail: 50
      }
    );

    console.log(`🔄 Campaign worker initialized: ${type} (${queueName})`);
  });
}

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  // Queue management
  addCampaignJob,
  getCampaignQueueStats,
  campaignQueues,
  
  // Worker management
  initializeCampaignWorkers,
  campaignWorkers,
  
  // Utilities
  validateCampaignExecution,
  generateCampaignScript,
  checkCampaignConsent,
  
  // Constants
  QUEUE_NAMES,
  redis
};