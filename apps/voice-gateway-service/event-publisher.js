// Event Publishing System for Voice Gateway Service
// Phase 1A: Event Bus Foundation

const { createClient } = require('@supabase/supabase-js');

class EventPublisher {
  constructor(supabaseUrl, supabaseKey) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Publish event to Postgres LISTEN/NOTIFY system
   * @param {string} salonId - Salon UUID
   * @param {string} eventType - Event type (call.started, call.ended, etc.)
   * @param {object} eventData - Event payload data
   * @param {string} channel - Postgres channel (default: service_events)
   */
  async publishEvent(salonId, eventType, eventData, channel = 'service_events') {
    try {
      // Use the enhanced database function that logs and notifies
      const { data, error } = await this.supabase.rpc('publish_event_with_log', {
        p_salon_id: salonId,
        p_event_type: eventType,
        p_event_data: eventData,
        p_channel: channel
      });

      if (error) {
        console.error('Failed to publish event:', error);
        return null;
      }

      console.log(`Event published: ${eventType} for salon ${salonId}`);
      return data; // Returns event_id
    } catch (error) {
      console.error('Error publishing event:', error);
      return null;
    }
  }

  /**
   * Mark event as processed by external system
   * @param {string} eventId - Event UUID
   */
  async markEventProcessed(eventId) {
    try {
      const { error } = await this.supabase.rpc('mark_event_processed', {
        p_event_id: eventId
      });

      if (error) {
        console.error('Failed to mark event as processed:', error);
      }
    } catch (error) {
      console.error('Error marking event as processed:', error);
    }
  }

  // Voice-specific event helpers
  async publishCallStarted(salonId, callData) {
    return await this.publishEvent(salonId, 'call.started', {
      call_sid: callData.callSid,
      phone_number: callData.phoneNumber,
      direction: callData.direction,
      language: callData.detectedLanguage,
      timestamp: new Date().toISOString(),
      salon_open: callData.salonOpen
    });
  }

  async publishCallAnswered(salonId, callData) {
    return await this.publishEvent(salonId, 'call.answered', {
      call_sid: callData.callSid,
      response_time_ms: callData.responseTime,
      voice_agent_active: true,
      timestamp: new Date().toISOString()
    });
  }

  async publishCallEnded(salonId, callData) {
    return await this.publishEvent(salonId, 'call.ended', {
      call_sid: callData.callSid,
      duration_seconds: callData.duration,
      outcome: callData.outcome,
      summary: callData.summary,
      transcript_length: callData.transcript?.length || 0,
      customer_satisfied: callData.customerSatisfied,
      booking_intent: callData.bookingIntent,
      timestamp: new Date().toISOString()
    });
  }

  async publishTranscriptUpdate(salonId, callData, transcriptEntry) {
    return await this.publishEvent(salonId, 'transcript.updated', {
      call_sid: callData.callSid,
      speaker: transcriptEntry.speaker,
      text: transcriptEntry.text,
      confidence: transcriptEntry.confidence,
      timestamp: transcriptEntry.timestamp
    });
  }

  async publishBookingIntent(salonId, callData, intentData) {
    return await this.publishEvent(salonId, 'booking.intent_detected', {
      call_sid: callData.callSid,
      confidence: intentData.confidence,
      service_type: intentData.serviceType,
      preferred_date: intentData.preferredDate,
      customer_info: intentData.customerInfo,
      timestamp: new Date().toISOString()
    });
  }

  async publishCallbackRequested(salonId, callData, callbackData) {
    return await this.publishEvent(salonId, 'callback.requested', {
      call_sid: callData.callSid,
      customer_phone: callData.phoneNumber,
      preferred_time: callbackData.preferredTime,
      reason: callbackData.reason,
      priority: callbackData.priority,
      timestamp: new Date().toISOString()
    });
  }

  async publishSystemHealth(salonId, healthData) {
    return await this.publishEvent(salonId, 'system.health', {
      active_calls: healthData.activeCalls,
      response_time_avg: healthData.avgResponseTime,
      success_rate: healthData.successRate,
      voice_agent_status: healthData.voiceAgentStatus,
      timestamp: new Date().toISOString()
    });
  }

  // Campaign events
  async publishCampaignStarted(salonId, campaignData) {
    return await this.publishEvent(salonId, 'campaign.started', {
      campaign_id: campaignData.campaignId,
      campaign_type: campaignData.type,
      target_customers: campaignData.targetCount,
      scheduled_time: campaignData.scheduledTime,
      timestamp: new Date().toISOString()
    });
  }

  async publishCampaignCompleted(salonId, campaignData) {
    return await this.publishEvent(salonId, 'campaign.completed', {
      campaign_id: campaignData.campaignId,
      calls_made: campaignData.callsMade,
      successful_contacts: campaignData.successfulContacts,
      bookings_generated: campaignData.bookingsGenerated,
      completion_rate: campaignData.completionRate,
      timestamp: new Date().toISOString()
    });
  }
}

module.exports = EventPublisher;