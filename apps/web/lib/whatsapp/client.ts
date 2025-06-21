import { config } from '@/lib/config';

// =============================================================================
// WHATSAPP BUSINESS API CLIENT
// =============================================================================

export interface WhatsAppTextMessage {
  messaging_product: 'whatsapp';
  to: string;
  type: 'text';
  text: {
    body: string;
    preview_url?: boolean;
  };
}

export interface WhatsAppTemplateMessage {
  messaging_product: 'whatsapp';
  to: string;
  type: 'template';
  template: {
    name: string;
    language: {
      code: string;
    };
    components?: Array<{
      type: 'body' | 'header' | 'button';
      parameters?: Array<{
        type: 'text' | 'image' | 'document' | 'video';
        text?: string;
        image?: {
          link: string;
        };
      }>;
    }>;
  };
}

export interface WhatsAppImageMessage {
  messaging_product: 'whatsapp';
  to: string;
  type: 'image';
  image: {
    link?: string;
    id?: string;
    caption?: string;
  };
}

export interface WhatsAppMessageResponse {
  messaging_product: string;
  contacts: Array<{
    input: string;
    wa_id: string;
  }>;
  messages: Array<{
    id: string;
    message_status?: string;
  }>;
}

export interface WhatsAppError {
  error: {
    message: string;
    type: string;
    code: number;
    error_data?: {
      messaging_product: string;
      details: string;
    };
    error_subcode?: number;
    fbtrace_id?: string;
  };
}

class WhatsAppBusinessClient {
  private accessToken: string;
  private phoneNumberId: string;
  private apiVersion: string = 'v22.0';
  private baseURL: string = 'https://graph.facebook.com';

  constructor() {
    this.accessToken = config.WHATSAPP_ACCESS_TOKEN || '';
    this.phoneNumberId = config.WHATSAPP_PHONE_NUMBER_ID || '';

    if (!this.accessToken || !this.phoneNumberId) {
      throw new Error('WhatsApp credentials not configured. Check WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID environment variables.');
    }
  }

  // =============================================================================
  // MESSAGE SENDING METHODS
  // =============================================================================

  /**
   * Send a text message to a WhatsApp number
   */
  async sendTextMessage(
    to: string, 
    message: string, 
    options: { previewUrl?: boolean } = {}
  ): Promise<WhatsAppMessageResponse> {
    const payload: WhatsAppTextMessage = {
      messaging_product: 'whatsapp',
      to: this.formatPhoneNumber(to),
      type: 'text',
      text: {
        body: message,
        preview_url: options.previewUrl ?? false
      }
    };

    return this.sendMessage(payload);
  }

  /**
   * Send a template message (for use outside 24-hour window)
   */
  async sendTemplateMessage(
    to: string,
    templateName: string,
    languageCode: string = 'en',
    components?: any[]
  ): Promise<WhatsAppMessageResponse> {
    const payload: WhatsAppTemplateMessage = {
      messaging_product: 'whatsapp',
      to: this.formatPhoneNumber(to),
      type: 'template',
      template: {
        name: templateName,
        language: {
          code: languageCode
        }
      }
    };

    if (components && components.length > 0) {
      payload.template.components = components;
    }

    return this.sendMessage(payload);
  }

  /**
   * Send an image message
   */
  async sendImageMessage(
    to: string,
    imageUrl: string,
    caption?: string
  ): Promise<WhatsAppMessageResponse> {
    const payload: WhatsAppImageMessage = {
      messaging_product: 'whatsapp',
      to: this.formatPhoneNumber(to),
      type: 'image',
      image: {
        link: imageUrl,
        caption
      }
    };

    return this.sendMessage(payload);
  }

  /**
   * Send booking confirmation with template
   */
  async sendBookingConfirmation(
    to: string,
    bookingDetails: {
      customerName: string;
      serviceName: string;
      appointmentDate: string;
      appointmentTime: string;
      salonName: string;
      salonAddress?: string;
    }
  ): Promise<WhatsAppMessageResponse> {
    // For MVP, use text message. In production, use approved template
    const message = `✅ Booking Confirmed!

Hi ${bookingDetails.customerName}!

Your appointment has been confirmed:

🎯 Service: ${bookingDetails.serviceName}
📅 Date: ${bookingDetails.appointmentDate}
⏰ Time: ${bookingDetails.appointmentTime}
📍 Location: ${bookingDetails.salonName}
${bookingDetails.salonAddress ? `   ${bookingDetails.salonAddress}` : ''}

We look forward to seeing you! 💇‍♀️

If you need to reschedule or cancel, please reply to this message.

${bookingDetails.salonName}`;

    return this.sendTextMessage(to, message);
  }

  /**
   * Send appointment reminder
   */
  async sendAppointmentReminder(
    to: string,
    reminderDetails: {
      customerName: string;
      serviceName: string;
      appointmentDateTime: string;
      hoursUntilAppointment: number;
      salonName: string;
    }
  ): Promise<WhatsAppMessageResponse> {
    const timeframe = reminderDetails.hoursUntilAppointment < 24 
      ? `in ${reminderDetails.hoursUntilAppointment} hours`
      : `tomorrow`;

    const message = `🔔 Appointment Reminder

Hi ${reminderDetails.customerName}!

This is a friendly reminder that you have an appointment ${timeframe}:

🎯 ${reminderDetails.serviceName}
📅 ${reminderDetails.appointmentDateTime}

We can't wait to see you! ✨

If you need to make any changes, please let us know as soon as possible.

${reminderDetails.salonName}`;

    return this.sendTextMessage(to, message);
  }

  // =============================================================================
  // CORE API METHODS
  // =============================================================================

  private async sendMessage(payload: any): Promise<WhatsAppMessageResponse> {
    const url = `${this.baseURL}/${this.apiVersion}/${this.phoneNumberId}/messages`;

    try {
      console.log('Sending WhatsApp message:', {
        to: payload.to,
        type: payload.type,
        timestamp: new Date().toISOString()
      });

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const error: WhatsAppError = await response.json();
        throw new WhatsAppAPIError(
          error.error.message,
          error.error.code,
          error.error.type,
          error
        );
      }

      const result: WhatsAppMessageResponse = await response.json();
      
      console.log('WhatsApp message sent successfully:', {
        messageId: result.messages[0]?.id,
        to: payload.to
      });

      return result;

    } catch (error) {
      console.error('WhatsApp API error:', error);
      throw error;
    }
  }

  // =============================================================================
  // TEMPLATE MANAGEMENT
  // =============================================================================

  /**
   * Get list of message templates
   */
  async getMessageTemplates(): Promise<any> {
    const url = `${this.baseURL}/${this.apiVersion}/${config.WHATSAPP_BUSINESS_ACCOUNT_ID}/message_templates`;

    try {
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch templates: ${response.status}`);
      }

      return await response.json();

    } catch (error) {
      console.error('Error fetching WhatsApp templates:', error);
      throw error;
    }
  }

  /**
   * Create a new message template
   */
  async createMessageTemplate(
    name: string,
    category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION',
    language: string,
    components: any[]
  ): Promise<any> {
    const url = `${this.baseURL}/${this.apiVersion}/${config.WHATSAPP_BUSINESS_ACCOUNT_ID}/message_templates`;

    const payload = {
      name,
      category,
      language,
      components
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Failed to create template: ${response.status}`);
      }

      return await response.json();

    } catch (error) {
      console.error('Error creating WhatsApp template:', error);
      throw error;
    }
  }

  // =============================================================================
  // MEDIA HANDLING
  // =============================================================================

  /**
   * Upload media file and get media ID
   */
  async uploadMedia(file: File, type: 'image' | 'document' | 'audio' | 'video'): Promise<string> {
    const url = `${this.baseURL}/${this.apiVersion}/${this.phoneNumberId}/media`;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);
    formData.append('messaging_product', 'whatsapp');

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Failed to upload media: ${response.status}`);
      }

      const result = await response.json();
      return result.id;

    } catch (error) {
      console.error('Error uploading WhatsApp media:', error);
      throw error;
    }
  }

  // =============================================================================
  // UTILITY METHODS
  // =============================================================================

  private formatPhoneNumber(phoneNumber: string): string {
    // Remove all non-digit characters
    let formatted = phoneNumber.replace(/[^\d]/g, '');
    
    // Return the number without any prefix - WhatsApp API expects just the number
    return formatted;
  }

  /**
   * Check if we're within the 24-hour customer service window
   */
  async checkServiceWindow(_customerPhone: string): Promise<{
    withinWindow: boolean;
    lastCustomerMessage?: Date;
    windowExpiresAt?: Date;
  }> {
    // TODO: Implement service window checking using conversation history
    // For now, return a placeholder
    return {
      withinWindow: false, // Force template usage for testing
      lastCustomerMessage: undefined,
      windowExpiresAt: undefined
    };
  }

  /**
   * Get business phone number info
   */
  async getPhoneNumberInfo(): Promise<any> {
    const url = `${this.baseURL}/${this.apiVersion}/${this.phoneNumberId}`;

    try {
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get phone info: ${response.status}`);
      }

      return await response.json();

    } catch (error) {
      console.error('Error getting WhatsApp phone info:', error);
      throw error;
    }
  }
}

// =============================================================================
// ERROR CLASSES
// =============================================================================

export class WhatsAppAPIError extends Error {
  public readonly code: number;
  public readonly type: string;
  public readonly details: WhatsAppError;

  constructor(message: string, code: number, type: string, details: WhatsAppError) {
    super(message);
    this.name = 'WhatsAppAPIError';
    this.code = code;
    this.type = type;
    this.details = details;
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

let whatsappClient: WhatsAppBusinessClient | null = null;

export function getWhatsAppClient(): WhatsAppBusinessClient {
  if (!whatsappClient) {
    whatsappClient = new WhatsAppBusinessClient();
  }
  return whatsappClient;
}

export { WhatsAppBusinessClient };