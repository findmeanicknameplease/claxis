// =============================================================================
// WHATSAPP READ RECEIPT ANTI NO-SHOW IMPLEMENTATION
// Complete implementation for Cursor + Sonnet 4 development
// =============================================================================

// 1. Enhanced Database Schema for Message Tracking
// =============================================================================

// SQL Migration: Add message tracking table
const messageTrackingSchema = `
-- Enhanced message tracking for read receipts
CREATE TABLE whatsapp_message_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id TEXT UNIQUE NOT NULL,
  conversation_id UUID REFERENCES conversations(id),
  booking_id UUID REFERENCES bookings(id),
  message_type TEXT CHECK (message_type IN ('booking_confirmation', 'reminder', 'follow_up', 'escalation')),
  status TEXT CHECK (status IN ('sent', 'delivered', 'read', 'failed')),
  sent_at TIMESTAMPTZ NOT NULL,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  follow_up_scheduled BOOLEAN DEFAULT false,
  follow_up_sent_count INTEGER DEFAULT 0,
  no_show_risk_score INTEGER DEFAULT 0,
  escalation_triggered BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX idx_message_tracking_booking ON whatsapp_message_tracking(booking_id, message_type);
CREATE INDEX idx_message_tracking_status ON whatsapp_message_tracking(message_id, status);
CREATE INDEX idx_message_tracking_followup ON whatsapp_message_tracking(follow_up_scheduled, sent_at)
WHERE follow_up_scheduled = true;

-- Add no-show risk tracking to bookings
ALTER TABLE bookings 
ADD COLUMN no_show_risk_score INTEGER DEFAULT 0,
ADD COLUMN prevention_actions JSONB DEFAULT '[]',
ADD COLUMN confirmation_read BOOLEAN DEFAULT false,
ADD COLUMN last_engagement_at TIMESTAMPTZ;
`;

// 2. Enhanced WhatsApp Webhook Handler for Status Updates
// =============================================================================

// src/app/api/webhooks/whatsapp/status/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ReadReceiptTracker } from '@/lib/n8n/read-receipt-tracker';

interface WhatsAppStatusUpdate {
  entry: Array<{
    changes: Array<{
      value: {
        statuses: Array<{
          id: string; // message_id
          status: 'sent' | 'delivered' | 'read' | 'failed';
          timestamp: string;
          recipient_id: string;
          conversation?: {
            id: string;
          };
        }>;
      };
    }>;
  }>;
}

export async function POST(request: NextRequest) {
  try {
    // 1. Verify webhook signature
    const signature = request.headers.get('x-hub-signature-256');
    const body = await request.text();
    
    if (!verifyWhatsAppSignature(body, signature)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // 2. Parse status update
    const statusUpdate: WhatsAppStatusUpdate = JSON.parse(body);
    
    // 3. Process each status update
    for (const entry of statusUpdate.entry) {
      for (const change of entry.changes) {
        if (change.value.statuses) {
          for (const status of change.value.statuses) {
            await processMessageStatus(status);
          }
        }
      }
    }

    return NextResponse.json({ status: 'success' });
    
  } catch (error) {
    console.error('WhatsApp status webhook error:', error);
    return NextResponse.json({ status: 'error' }, { status: 500 });
  }
}

async function processMessageStatus(status: any) {
  const tracker = new ReadReceiptTracker();
  
  // Update message tracking
  await tracker.updateMessageStatus(status.id, {
    status: status.status,
    timestamp: status.timestamp,
    recipient_id: status.recipient_id
  });
  
  // Trigger no-show prevention logic if needed
  if (status.status === 'delivered' || status.status === 'read') {
    await tracker.processNoShowPrevention(status.id);
  }
}

// 3. Read Receipt Tracker Class
// =============================================================================

// src/lib/n8n/read-receipt-tracker.ts
export class ReadReceiptTracker {
  private supabase = createClient();
  private n8nAPI = new N8nAPIClient();

  async updateMessageStatus(messageId: string, statusData: any) {
    const updateData: any = {
      updated_at: new Date()
    };

    switch (statusData.status) {
      case 'delivered':
        updateData.status = 'delivered';
        updateData.delivered_at = new Date(parseInt(statusData.timestamp) * 1000);
        break;
      case 'read':
        updateData.status = 'read';
        updateData.read_at = new Date(parseInt(statusData.timestamp) * 1000);
        break;
      case 'failed':
        updateData.status = 'failed';
        break;
    }

    await this.supabase
      .from('whatsapp_message_tracking')
      .update(updateData)
      .eq('message_id', messageId);

    // Update booking confirmation status if this is a booking confirmation
    if (statusData.status === 'read') {
      await this.updateBookingReadStatus(messageId);
    }
  }

  async processNoShowPrevention(messageId: string) {
    const messageTracking = await this.getMessageTracking(messageId);
    
    if (!messageTracking || messageTracking.message_type !== 'booking_confirmation') {
      return;
    }

    const booking = await this.getBookingFromMessage(messageId);
    if (!booking) return;

    // Calculate no-show risk
    const riskAssessment = await this.calculateNoShowRisk(booking, messageTracking);
    
    // Update risk score
    await this.updateBookingRiskScore(booking.id, riskAssessment.risk_score);

    // Trigger prevention actions based on risk and read status
    if (messageTracking.status === 'delivered' && !messageTracking.read_at) {
      // Message delivered but not read - schedule reminder
      await this.scheduleReadReminder(messageId, '2 hours');
    } else if (messageTracking.status === 'read') {
      // Message read - lower risk, but still monitor
      await this.schedulePreAppointmentReminder(booking.id);
    }
  }

  async calculateNoShowRisk(booking: any, messageTracking: any): Promise<NoShowRiskAssessment> {
    const now = new Date();
    const appointmentTime = new Date(booking.appointment_time);
    const hoursUntilAppointment = (appointmentTime.getTime() - now.getTime()) / (1000 * 60 * 60);

    const riskFactors = {
      message_not_read: !messageTracking.read_at ? 35 : 0,
      first_time_customer: booking.client.visit_count === 0 ? 25 : 0,
      appointment_within_24h: hoursUntilAppointment < 24 ? 15 : 0,
      weekend_appointment: this.isWeekend(appointmentTime) ? 10 : 0,
      high_value_service: booking.service_value > 100 ? -15 : 0, // Lower risk for expensive services
      repeat_customer_bonus: booking.client.visit_count > 5 ? -20 : 0,
      recent_no_show_history: booking.client.no_show_count > 0 ? 30 : 0
    };

    const totalRisk = Object.values(riskFactors).reduce((sum, risk) => sum + risk, 0);
    const normalizedRisk = Math.max(0, Math.min(100, totalRisk));

    return {
      risk_score: normalizedRisk,
      risk_level: this.getRiskLevel(normalizedRisk),
      factors: riskFactors,
      recommended_actions: this.getRecommendedActions(normalizedRisk, booking),
      potential_revenue_loss: booking.service_value
    };
  }

  private getRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
    if (score >= 80) return 'critical';
    if (score >= 60) return 'high';
    if (score >= 35) return 'medium';
    return 'low';
  }

  private getRecommendedActions(riskScore: number, booking: any): string[] {
    const actions = [];
    
    if (riskScore >= 80) {
      actions.push('immediate_phone_call');
      actions.push('manager_intervention');
      actions.push('offer_reschedule_incentive');
    } else if (riskScore >= 60) {
      actions.push('urgent_whatsapp_reminder');
      actions.push('confirm_attendance_request');
      actions.push('highlight_cancellation_policy');
    } else if (riskScore >= 35) {
      actions.push('gentle_reminder');
      actions.push('service_excitement_message');
    } else {
      actions.push('standard_pre_appointment_reminder');
    }
    
    return actions;
  }

  async scheduleReadReminder(messageId: string, delay: string) {
    const messageTracking = await this.getMessageTracking(messageId);
    if (!messageTracking || messageTracking.follow_up_scheduled) return;

    // Mark follow-up as scheduled
    await this.supabase
      .from('whatsapp_message_tracking')
      .update({ follow_up_scheduled: true })
      .eq('message_id', messageId);

    // Schedule n8n workflow execution
    const delayMs = this.parseDelayToMs(delay);
    await this.n8nAPI.scheduleWorkflowExecution({
      workflowId: 'read-reminder-workflow',
      data: { messageId, originalMessageId: messageId },
      executeAt: new Date(Date.now() + delayMs)
    });
  }

  async executeReadReminder(messageId: string) {
    const messageTracking = await this.getMessageTracking(messageId);
    if (!messageTracking) return;

    // Check if message was read since scheduling
    if (messageTracking.read_at) {
      console.log('Message was read, skipping reminder');
      return;
    }

    const booking = await this.getBookingFromMessage(messageId);
    if (!booking) return;

    // Check service window status
    const conversation = await this.getConversation(messageTracking.conversation_id);
    const serviceWindowActive = this.isServiceWindowActive(conversation);

    if (!serviceWindowActive) {
      console.log('Service window expired, evaluating template use');
      
      // Only use template for high-value appointments or VIP customers
      const shouldUseTemplate = booking.service_value > 100 || booking.client.is_vip;
      
      if (!shouldUseTemplate) {
        console.log('Service window expired, skipping reminder to save costs');
        return;
      }
    }

    // Generate reminder message
    const reminderMessage = this.generateReadReminderMessage(booking, messageTracking);
    
    // Send reminder
    await this.sendWhatsAppMessage(booking.client.phone, reminderMessage);
    
    // Track the reminder
    await this.trackReminderSent(messageId, 'read_reminder');
    
    // Schedule escalation if still not read after 4 more hours
    await this.scheduleEscalation(messageId, '4 hours');
  }

  private generateReadReminderMessage(booking: any, messageTracking: any): string {
    const client = booking.client;
    const service = booking.service;
    const appointmentDate = new Date(booking.appointment_time).toLocaleDateString('en-GB');
    const appointmentTime = new Date(booking.appointment_time).toLocaleTimeString('en-GB', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });

    return `Hi ${client.first_name}! 👋

Just making sure you saw your appointment confirmation for ${service.name} on ${appointmentDate} at ${appointmentTime}.

We're really looking forward to seeing you! ✨

If you need to make any changes, just reply to this message.

See you soon! 💇‍♀️

${booking.salon.name}`;
  }

  async scheduleEscalation(messageId: string, delay: string) {
    const delayMs = this.parseDelayToMs(delay);
    
    await this.n8nAPI.scheduleWorkflowExecution({
      workflowId: 'escalation-workflow',
      data: { messageId },
      executeAt: new Date(Date.now() + delayMs)
    });
  }

  async executeEscalation(messageId: string) {
    const messageTracking = await this.getMessageTracking(messageId);
    if (!messageTracking || messageTracking.read_at) {
      return; // Message was read, no escalation needed
    }

    const booking = await this.getBookingFromMessage(messageId);
    if (!booking) return;

    const riskAssessment = await this.calculateNoShowRisk(booking, messageTracking);
    
    if (riskAssessment.risk_level === 'critical' || riskAssessment.risk_level === 'high') {
      // High risk - trigger manager intervention
      await this.triggerManagerIntervention(booking, riskAssessment);
    } else {
      // Medium risk - send final reminder
      await this.sendFinalReminder(booking);
    }
  }

  private async triggerManagerIntervention(booking: any, riskAssessment: any) {
    // Notify salon manager
    await this.notifyManager({
      type: 'high_no_show_risk',
      booking: booking,
      risk_score: riskAssessment.risk_score,
      recommended_action: 'immediate_phone_call',
      potential_loss: riskAssessment.potential_revenue_loss
    });

    // Log intervention
    await this.logPreventionAction(booking.id, 'manager_intervention', {
      risk_score: riskAssessment.risk_score,
      factors: riskAssessment.factors
    });
  }

  private isServiceWindowActive(conversation: any): boolean {
    if (!conversation.service_window_expires_at) return false;
    return new Date(conversation.service_window_expires_at) > new Date();
  }

  private parseDelayToMs(delay: string): number {
    const match = delay.match(/(\d+)\s*(hours?|minutes?|mins?)/i);
    if (!match) return 0;

    const value = parseInt(match[1]);
    const unit = match[2].toLowerCase();

    if (unit.startsWith('hour')) {
      return value * 60 * 60 * 1000;
    } else if (unit.startsWith('min')) {
      return value * 60 * 1000;
    }

    return 0;
  }

  private isWeekend(date: Date): boolean {
    const day = date.getDay();
    return day === 0 || day === 6; // Sunday or Saturday
  }

  // Additional helper methods...
  private async getMessageTracking(messageId: string) {
    const { data } = await this.supabase
      .from('whatsapp_message_tracking')
      .select('*')
      .eq('message_id', messageId)
      .single();
    return data;
  }

  private async getBookingFromMessage(messageId: string) {
    const { data } = await this.supabase
      .from('whatsapp_message_tracking')
      .select(`
        booking_id,
        bookings (
          id,
          appointment_time,
          service_value,
          salon:salons (id, name),
          client:clients (
            id, first_name, phone, visit_count, 
            is_vip, no_show_count
          ),
          service:services (id, name)
        )
      `)
      .eq('message_id', messageId)
      .single();
    
    return data?.bookings;
  }

  private async trackReminderSent(messageId: string, reminderType: string) {
    await this.supabase
      .from('whatsapp_message_tracking')
      .update({
        follow_up_sent_count: sql`follow_up_sent_count + 1`,
        updated_at: new Date()
      })
      .eq('message_id', messageId);
  }

  private async sendWhatsAppMessage(phone: string, message: string) {
    // Implementation depends on your WhatsApp API client
    const whatsappClient = new WhatsAppClient();
    return await whatsappClient.sendMessage(phone, message);
  }

  private async notifyManager(notification: any) {
    // Send notification to salon manager via dashboard, email, or SMS
    const notificationService = new NotificationService();
    return await notificationService.notifyManager(notification);
  }

  private async logPreventionAction(bookingId: string, action: string, metadata: any) {
    await this.supabase
      .from('bookings')
      .update({
        prevention_actions: sql`prevention_actions || ${JSON.stringify([{
          action,
          timestamp: new Date(),
          metadata
        }])}`,
        updated_at: new Date()
      })
      .eq('id', bookingId);
  }
}

// 4. n8n Workflow Definition for Read Receipt Automation
// =============================================================================

const readReceiptWorkflow = {
  "name": "Read Receipt No-Show Prevention",
  "nodes": [
    {
      "name": "Booking Confirmation Trigger",
      "type": "webhook",
      "webhookPath": "/booking-confirmed"
    },
    {
      "name": "Send Confirmation Message",
      "type": "whatsapp-send",
      "parameters": {
        "phone": "={{$json.client.phone}}",
        "message": "={{$json.confirmationMessage}}",
        "trackReadReceipt": true
      }
    },
    {
      "name": "Track Confirmation Message",
      "type": "function",
      "code": `
        const messageId = $json.whatsapp_message_id;
        const bookingId = $json.booking.id;
        
        // Store message tracking
        await supabase
          .from('whatsapp_message_tracking')
          .insert({
            message_id: messageId,
            booking_id: bookingId,
            message_type: 'booking_confirmation',
            status: 'sent',
            sent_at: new Date()
          });
        
        return {
          ...items[0].json,
          message_tracking_id: messageId
        };
      `
    },
    {
      "name": "Schedule Read Check",
      "type": "schedule",
      "parameters": {
        "delay": "2 hours",
        "workflowToExecute": "read-reminder-workflow",
        "data": "={{$json}}"
      }
    }
  ]
};

// 5. Usage Example and Testing
// =============================================================================

// Example: How to test the read receipt functionality
async function testReadReceiptFlow() {
  const tracker = new ReadReceiptTracker();
  
  // Simulate a booking confirmation
  const mockBooking = {
    id: 'booking-123',
    client: { phone: '+4917712345678', first_name: 'Maria' },
    service: { name: 'Haircut & Style' },
    appointment_time: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
    service_value: 85
  };
  
  // Simulate message status updates
  await tracker.updateMessageStatus('msg-123', {
    status: 'delivered',
    timestamp: (Date.now() / 1000).toString()
  });
  
  // After 2 hours, simulate no read receipt
  setTimeout(async () => {
    await tracker.executeReadReminder('msg-123');
  }, 2 * 60 * 60 * 1000);
}

// Performance monitoring
class NoShowPreventionAnalytics {
  async getPreventionMetrics(salonId: string, period: 'week' | 'month' = 'month') {
    const { data } = await supabase.rpc('get_no_show_prevention_metrics', {
      salon_id: salonId,
      period
    });
    
    return {
      total_bookings: data.total_bookings,
      confirmations_sent: data.confirmations_sent,
      confirmations_read: data.confirmations_read,
      reminders_sent: data.reminders_sent,
      escalations_triggered: data.escalations_triggered,
      no_shows_prevented: data.no_shows_prevented,
      revenue_saved: data.revenue_saved,
      read_rate: (data.confirmations_read / data.confirmations_sent) * 100,
      prevention_rate: (data.no_shows_prevented / data.high_risk_bookings) * 100
    };
  }
}

export { ReadReceiptTracker, NoShowPreventionAnalytics };