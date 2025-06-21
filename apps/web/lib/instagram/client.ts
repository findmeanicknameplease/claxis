import { config } from '@/lib/config';

// =============================================================================
// INSTAGRAM GRAPH API CLIENT
// =============================================================================

export interface InstagramComment {
  id: string;
  text: string;
  username: string;
  timestamp: string;
  media_id: string;
  parent_id?: string; // for replies
  user_id: string;
  like_count: number;
  hidden: boolean;
}

export interface InstagramDMMessage {
  id: string;
  created_time: string;
  from: {
    username: string;
    id: string;
  };
  to: {
    data: Array<{
      username: string;
      id: string;
    }>;
  };
  message: string;
  attachments?: {
    data: Array<{
      image_data?: {
        url: string;
        preview_url: string;
      };
      video_data?: {
        url: string;
        preview_url: string;
      };
    }>;
  };
}

export interface InstagramMediaPost {
  id: string;
  media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';
  media_url: string;
  permalink: string;
  caption?: string;
  timestamp: string;
  like_count?: number;
  comments_count?: number;
  username: string;
}

export interface InstagramDMSendMessage {
  recipient: {
    id: string;
  };
  message: {
    text?: string;
    attachment?: {
      type: 'image' | 'video';
      payload: {
        url: string;
        is_reusable?: boolean;
      };
    };
  };
}

export interface InstagramCommentReply {
  message: string;
}

export interface InstagramAPIResponse {
  data?: any;
  error?: {
    message: string;
    type: string;
    code: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
}

export interface BookingIntentAnalysis {
  hasBookingIntent: boolean;
  confidence: number;
  extractedInfo: {
    service?: string;
    preferredTime?: string;
    phoneNumber?: string;
    email?: string;
  };
  suggestedResponse: string;
  language: 'de' | 'en' | 'nl' | 'fr';
}

class InstagramGraphClient {
  private accessToken: string;
  private pageId: string;
  private apiVersion: string = 'v19.0';
  private baseURL: string = 'https://graph.facebook.com';

  constructor(accessToken?: string, pageId?: string) {
    this.accessToken = accessToken ?? config.INSTAGRAM_ACCESS_TOKEN ?? '';
    this.pageId = pageId ?? config.INSTAGRAM_PAGE_ID ?? '';
    
    if (!this.accessToken || this.accessToken.length === 0) {
      throw new Error('Instagram access token is required');
    }
    
    if (!this.pageId || this.pageId.length === 0) {
      throw new Error('Instagram page ID is required');
    }
  }

  // =============================================================================
  // COMMENT MANAGEMENT
  // =============================================================================

  /**
   * Get comments on a specific media post
   */
  async getMediaComments(mediaId: string): Promise<InstagramComment[]> {
    try {
      const url = `${this.baseURL}/${this.apiVersion}/${mediaId}/comments`;
      const params = new URLSearchParams({
        access_token: this.accessToken,
        fields: 'id,text,username,timestamp,like_count,hidden,parent_id,user'
      });

      const response = await fetch(`${url}?${params.toString()}`);
      const data: InstagramAPIResponse = await response.json();

      if (data.error) {
        throw new Error(`Instagram API Error: ${data.error.message}`);
      }

      return data.data || [];
    } catch (error) {
      console.error('Error fetching Instagram comments:', error);
      throw error;
    }
  }

  /**
   * Reply to a comment with booking-related response
   */
  async replyToComment(
    commentId: string, 
    message: string
  ): Promise<{ success: boolean; commentId?: string }> {
    try {
      const url = `${this.baseURL}/${this.apiVersion}/${commentId}/replies`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          access_token: this.accessToken,
          message: message
        })
      });

      const data: InstagramAPIResponse = await response.json();

      if (data.error) {
        throw new Error(`Instagram Comment Reply Error: ${data.error.message}`);
      }

      return {
        success: true,
        commentId: data.data?.id
      };
    } catch (error) {
      console.error('Error replying to Instagram comment:', error);
      return { success: false };
    }
  }

  /**
   * Analyze comment for booking intent using AI
   */
  async analyzeCommentForBookingIntent(
    comment: InstagramComment
  ): Promise<BookingIntentAnalysis> {
    // This will integrate with AIOrchestrator for real analysis
    // For now, return basic pattern matching
    const text = comment.text.toLowerCase();
    
    const bookingKeywords = [
      'book', 'booking', 'appointment', 'termin', 'buchen',
      'réserver', 'rendez-vous', 'afspraak', 'boeken'
    ];
    
    const serviceKeywords = [
      'haircut', 'color', 'massage', 'facial', 'manicure', 'pedicure',
      'haarschnitt', 'färben', 'massage', 'gesichtsbehandlung',
      'coupe', 'coloration', 'knippen', 'kleuren'
    ];

    const hasBookingIntent = bookingKeywords.some(keyword => text.includes(keyword));
    const hasServiceMention = serviceKeywords.some(keyword => text.includes(keyword));
    
    const confidence = hasBookingIntent ? (hasServiceMention ? 0.9 : 0.7) : 0.2;

    // Language detection (basic)
    const language = this.detectLanguage(text);

    return {
      hasBookingIntent,
      confidence,
      extractedInfo: {
        service: hasServiceMention ? text : undefined
      },
      suggestedResponse: this.generateBookingResponse(language, hasBookingIntent),
      language
    };
  }

  // =============================================================================
  // DIRECT MESSAGE MANAGEMENT
  // =============================================================================

  /**
   * Send direct message to Instagram user
   */
  async sendDirectMessage(
    recipientId: string,
    message: string
  ): Promise<{ success: boolean; messageId?: string }> {
    try {
      const url = `${this.baseURL}/${this.apiVersion}/${this.pageId}/messages`;
      
      const payload: InstagramDMSendMessage = {
        recipient: { id: recipientId },
        message: { text: message }
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...payload,
          access_token: this.accessToken
        })
      });

      const data: InstagramAPIResponse = await response.json();

      if (data.error) {
        throw new Error(`Instagram DM Error: ${data.error.message}`);
      }

      return {
        success: true,
        messageId: data.data?.message_id
      };
    } catch (error) {
      console.error('Error sending Instagram DM:', error);
      return { success: false };
    }
  }

  /**
   * Get conversation thread for DM automation
   */
  async getConversationThread(
    threadId: string
  ): Promise<InstagramDMMessage[]> {
    try {
      const url = `${this.baseURL}/${this.apiVersion}/${threadId}`;
      const params = new URLSearchParams({
        access_token: this.accessToken,
        fields: 'messages{id,created_time,from,to,message,attachments}'
      });

      const response = await fetch(`${url}?${params.toString()}`);
      const data: InstagramAPIResponse = await response.json();

      if (data.error) {
        throw new Error(`Instagram Thread Error: ${data.error.message}`);
      }

      return data.data?.messages?.data || [];
    } catch (error) {
      console.error('Error fetching Instagram conversation:', error);
      throw error;
    }
  }

  // =============================================================================
  // MEDIA AND INSIGHTS
  // =============================================================================

  /**
   * Get recent media posts for analysis
   */
  async getRecentPosts(limit: number = 10): Promise<InstagramMediaPost[]> {
    try {
      const url = `${this.baseURL}/${this.apiVersion}/${this.pageId}/media`;
      const params = new URLSearchParams({
        access_token: this.accessToken,
        fields: 'id,media_type,media_url,permalink,caption,timestamp,like_count,comments_count,username',
        limit: limit.toString()
      });

      const response = await fetch(`${url}?${params.toString()}`);
      const data: InstagramAPIResponse = await response.json();

      if (data.error) {
        throw new Error(`Instagram Media Error: ${data.error.message}`);
      }

      return data.data || [];
    } catch (error) {
      console.error('Error fetching Instagram posts:', error);
      throw error;
    }
  }

  /**
   * Get insights for a specific post
   */
  async getPostInsights(mediaId: string): Promise<any> {
    try {
      const url = `${this.baseURL}/${this.apiVersion}/${mediaId}/insights`;
      const params = new URLSearchParams({
        access_token: this.accessToken,
        metric: 'impressions,reach,engagement,comments,likes,shares'
      });

      const response = await fetch(`${url}?${params.toString()}`);
      const data: InstagramAPIResponse = await response.json();

      if (data.error) {
        throw new Error(`Instagram Insights Error: ${data.error.message}`);
      }

      return data.data || {};
    } catch (error) {
      console.error('Error fetching Instagram insights:', error);
      throw error;
    }
  }

  // =============================================================================
  // UTILITY METHODS
  // =============================================================================

  private detectLanguage(text: string): 'de' | 'en' | 'nl' | 'fr' {
    const germanWords = ['und', 'der', 'die', 'das', 'ich', 'ist', 'für', 'mit'];
    const dutchWords = ['en', 'van', 'het', 'de', 'een', 'is', 'voor', 'met'];
    const frenchWords = ['et', 'le', 'la', 'les', 'un', 'une', 'est', 'pour', 'avec'];
    
    const lowerText = text.toLowerCase();
    
    if (germanWords.some(word => lowerText.includes(word))) return 'de';
    if (dutchWords.some(word => lowerText.includes(word))) return 'nl';
    if (frenchWords.some(word => lowerText.includes(word))) return 'fr';
    
    return 'en'; // Default to English
  }

  private generateBookingResponse(
    language: 'de' | 'en' | 'nl' | 'fr',
    hasBookingIntent: boolean
  ): string {
    if (!hasBookingIntent) {
      const responses = {
        de: 'Vielen Dank für Ihr Interesse! Schreiben Sie uns eine DM für weitere Informationen.',
        en: 'Thank you for your interest! Send us a DM for more information.',
        nl: 'Bedankt voor je interesse! Stuur ons een DM voor meer informatie.',
        fr: 'Merci de votre intérêt! Envoyez-nous un DM pour plus d\'informations.'
      };
      return responses[language];
    }

    const bookingResponses = {
      de: 'Gerne helfen wir Ihnen bei der Terminbuchung! Schreiben Sie uns eine DM mit Ihrem Wunschtermin.',
      en: 'We\'d love to help you book an appointment! Send us a DM with your preferred time.',
      nl: 'We helpen je graag met het boeken van een afspraak! Stuur ons een DM met je gewenste tijd.',
      fr: 'Nous serions ravis de vous aider à prendre rendez-vous! Envoyez-nous un DM avec votre heure préférée.'
    };
    
    return bookingResponses[language];
  }

  /**
   * Health check for Instagram API connection
   */
  async healthCheck(): Promise<{ status: 'healthy' | 'error'; details?: string }> {
    try {
      const url = `${this.baseURL}/${this.apiVersion}/${this.pageId}`;
      const params = new URLSearchParams({
        access_token: this.accessToken,
        fields: 'id,name,username'
      });

      const response = await fetch(`${url}?${params.toString()}`);
      const data: InstagramAPIResponse = await response.json();

      if (data.error) {
        return {
          status: 'error',
          details: data.error.message
        };
      }

      return { status: 'healthy' };
    } catch (error) {
      return {
        status: 'error',
        details: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

let instagramClient: InstagramGraphClient | null = null;

export function getInstagramClient(): InstagramGraphClient {
  if (!instagramClient) {
    instagramClient = new InstagramGraphClient();
  }
  return instagramClient;
}

export { InstagramGraphClient };
export default InstagramGraphClient;