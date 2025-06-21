// =============================================================================
// CONVERSATION USAGE TRACKING MIDDLEWARE
// Premium SaaS with Facebook/Meta Business Verification Compliance
// Non-tech savvy beauty/wellness business owners friendly
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { headers } from 'next/headers';

export interface ConversationUsage {
  salon_id: string;
  tier: 'free' | 'professional' | 'enterprise';
  period_start: string;
  period_end: string;
  total_conversations: number;
  tier_limit: number;
  usage_percentage: number;
  channels_breakdown: {
    whatsapp: number;
    instagram: number;
    voice: number;
  };
  facebook_api_limits: {
    daily_limit: number;
    business_initiated_today: number;
    verification_status: string;
    api_tier: string;
  };
  tier_features: Record<string, any>;
  upgrade_prompt_eligible: boolean;
}

export interface ConversationTrackingResult {
  success: boolean;
  usage?: ConversationUsage;
  error?: string;
  message?: string;
  upgrade_required?: boolean;
  should_show_upgrade_prompt?: boolean;
}

/**
 * Track conversation usage for salon with tier-based limits
 * Respects Facebook/Meta business verification constraints
 */
export class ConversationTracker {
  private async getSupabaseClient() {
    return await createClient();
  }

  /**
   * Get current usage stats for a salon
   */
  async getCurrentUsage(salonId: string): Promise<ConversationUsage | null> {
    try {
      const supabase = await this.getSupabaseClient();
      const { data, error } = await supabase
        .rpc('get_current_usage', { salon_uuid: salonId });

      if (error) {
        console.error('Error fetching usage:', error);
        return null;
      }

      return data as ConversationUsage;
    } catch (error) {
      console.error('Error in getCurrentUsage:', error);
      return null;
    }
  }

  /**
   * Increment conversation count and check limits
   */
  async trackConversation(
    salonId: string,
    channel: 'whatsapp' | 'instagram' | 'voice' | 'web',
    isBusinessInitiated: boolean = false
  ): Promise<ConversationTrackingResult> {
    try {
      // Map web to whatsapp for tracking purposes
      const trackingChannel = channel === 'web' ? 'whatsapp' : channel;

      const supabase = await this.getSupabaseClient();
      const { data, error } = await supabase
        .rpc('increment_conversation_usage', {
          salon_uuid: salonId,
          channel_type: trackingChannel,
          is_business_initiated: isBusinessInitiated
        });

      if (error) {
        console.error('Error tracking conversation:', error);
        return {
          success: false,
          error: 'tracking_error',
          message: 'Unable to track conversation usage'
        };
      }

      // If increment failed due to limits
      if (!data.success) {
        const usage = await this.getCurrentUsage(salonId);
        return {
          success: false,
          error: data.error,
          message: data.message,
          upgrade_required: data.upgrade_required || false,
          usage: usage || undefined
        };
      }

      // Get updated usage after increment
      const usage = await this.getCurrentUsage(salonId);
      
      return {
        success: true,
        usage: usage || undefined,
        should_show_upgrade_prompt: usage?.upgrade_prompt_eligible || false
      };

    } catch (error) {
      console.error('Error in trackConversation:', error);
      return {
        success: false,
        error: 'system_error',
        message: 'System error while tracking conversation'
      };
    }
  }

  /**
   * Check if salon can initiate a new conversation
   */
  async canInitiateConversation(
    salonId: string,
    channel: 'whatsapp' | 'instagram' | 'voice'
  ): Promise<{ allowed: boolean; reason?: string; upgrade_suggestion?: string }> {
    try {
      const usage = await this.getCurrentUsage(salonId);
      
      if (!usage) {
        return { allowed: false, reason: 'Unable to fetch usage data' };
      }

      // Check monthly tier limits (free tier only)
      if (usage.tier === 'free' && usage.tier_limit !== -1) {
        if (usage.total_conversations >= usage.tier_limit) {
          return {
            allowed: false,
            reason: 'Monthly limit exceeded',
            upgrade_suggestion: 'Upgrade to Professional for unlimited customer conversations and Instagram automation'
          };
        }
      }

      // Check Facebook API daily limits for business-initiated messages
      if (usage.facebook_api_limits.business_initiated_today >= usage.facebook_api_limits.daily_limit) {
        return {
          allowed: false,
          reason: 'Facebook API daily limit reached',
          upgrade_suggestion: usage.facebook_api_limits.verification_status === 'unverified' 
            ? 'Business verification can increase your daily limit from 250 to 1,000+ conversations'
            : 'Daily Facebook API limit reached. Limit resets at midnight.'
        };
      }

      // Check channel availability for tier
      const tierFeatures = usage.tier_features;
      const availableChannels = tierFeatures['channels'] || ['whatsapp'];
      
      if (!availableChannels.includes(channel)) {
        const channelUpgrades: Record<string, string> = {
          whatsapp: 'WhatsApp is available in all tiers',
          instagram: 'Upgrade to Professional for Instagram automation',
          voice: 'Upgrade to Enterprise for Voice AI calling'
        };
        
        return {
          allowed: false,
          reason: `${channel} not available in ${usage.tier} tier`,
          upgrade_suggestion: channelUpgrades[channel] || 'Upgrade for more channels'
        };
      }

      return { allowed: true };

    } catch (error) {
      console.error('Error checking conversation eligibility:', error);
      return { allowed: false, reason: 'System error' };
    }
  }

  /**
   * Get upgrade recommendations based on usage patterns
   */
  async getUpgradeRecommendations(salonId: string): Promise<{
    should_upgrade: boolean;
    current_tier: string;
    recommended_tier: string;
    benefits: string[];
    roi_calculation: Record<string, any>;
  } | null> {
    try {
      const usage = await this.getCurrentUsage(salonId);
      
      if (!usage) return null;

      // Free tier hitting limits
      if (usage.tier === 'free' && usage.usage_percentage >= 80) {
        return {
          should_upgrade: true,
          current_tier: 'free',
          recommended_tier: 'professional',
          benefits: [
            'Unlimited customer-initiated conversations',
            'Instagram automation for lead generation',
            'Advanced AI with marketing campaigns',
            'Win-back campaigns (€2,000-5,000 monthly ROI)',
            'No-show prevention (€300-1,200 savings)',
            'Post-service upselling (€500-1,500 revenue)'
          ],
          roi_calculation: {
            monthly_cost: 99.99,
            estimated_monthly_roi: '€2,800-8,700',
            payback_period_days: 3,
            annual_savings: '€33,600-104,400'
          }
        };
      }

      // Professional tier needing voice features
      if (usage.tier === 'professional' && usage.channels_breakdown.voice === 0) {
        return {
          should_upgrade: true,
          current_tier: 'professional',
          recommended_tier: 'enterprise',
          benefits: [
            '24/7 Voice AI agent replaces receptionist',
            'Voice win-back calls (85% answer rate vs 20% WhatsApp)',
            'VIP birthday calls (80% conversion rate)',
            'Emergency rescheduling automation',
            'Business verification white-glove service',
            'Custom voice cloning for brand consistency'
          ],
          roi_calculation: {
            monthly_cost: 299.99,
            replaces_receptionist_cost: 1200,
            estimated_monthly_roi: '€4,600-12,700',
            payback_period_days: 7,
            annual_savings: '€55,200-152,400'
          }
        };
      }

      return {
        should_upgrade: false,
        current_tier: usage.tier,
        recommended_tier: usage.tier,
        benefits: [],
        roi_calculation: {}
      };

    } catch (error) {
      console.error('Error getting upgrade recommendations:', error);
      return null;
    }
  }

  /**
   * Middleware function for Next.js API routes
   */
  static async middleware(request: NextRequest): Promise<NextResponse | null> {
    try {
      // Only apply to conversation-related API routes
      const conversationRoutes = [
        '/api/whatsapp/webhook',
        '/api/instagram/webhook', 
        '/api/voice/initiate',
        '/api/conversations'
      ];

      const shouldTrack = conversationRoutes.some(route => 
        request.nextUrl.pathname.startsWith(route)
      );

      if (!shouldTrack) {
        return null; // Continue to next middleware
      }

      // Extract salon ID from headers or request
      const headersList = await headers();
      const salonId = headersList.get('x-salon-id') || 
                     request.nextUrl.searchParams.get('salon_id');

      if (!salonId) {
        return NextResponse.json(
          { error: 'Salon ID required for conversation tracking' },
          { status: 400 }
        );
      }

      // Note: Business-initiated conversation detection available if needed
      // const isBusinessInitiated = request.method === 'POST' && 
      //   (request.nextUrl.pathname.includes('/send') || 
      //    request.nextUrl.pathname.includes('/initiate'));

      // Determine channel from route
      let channel: 'whatsapp' | 'instagram' | 'voice' = 'whatsapp';
      if (request.nextUrl.pathname.includes('instagram')) channel = 'instagram';
      if (request.nextUrl.pathname.includes('voice')) channel = 'voice';

      const tracker = new ConversationTracker();

      // Check if conversation is allowed
      const eligibility = await tracker.canInitiateConversation(salonId, channel);
      
      if (!eligibility.allowed) {
        return NextResponse.json({
          error: 'conversation_limit_exceeded',
          message: eligibility.reason,
          upgrade_suggestion: eligibility.upgrade_suggestion,
          upgrade_required: true
        }, { status: 429 }); // Too Many Requests
      }

      // Track the conversation (will be done in the actual API handler)
      // We just validate here to prevent hitting limits

      return null; // Continue to actual handler

    } catch (error) {
      console.error('Error in conversation tracking middleware:', error);
      // Don't block requests on tracking errors
      return null;
    }
  }
}

/**
 * Utility function to track conversations in API routes
 */
export async function trackConversationInRoute(
  salonId: string,
  channel: 'whatsapp' | 'instagram' | 'voice' | 'web',
  isBusinessInitiated: boolean = false
): Promise<ConversationTrackingResult> {
  const tracker = new ConversationTracker();
  return await tracker.trackConversation(salonId, channel, isBusinessInitiated);
}

/**
 * Utility function for upgrade prompts in components
 */
export async function getUpgradePromptData(salonId: string) {
  const tracker = new ConversationTracker();
  const [usage, recommendations] = await Promise.all([
    tracker.getCurrentUsage(salonId),
    tracker.getUpgradeRecommendations(salonId)
  ]);

  return {
    usage,
    recommendations,
    should_show_prompt: usage?.upgrade_prompt_eligible || false
  };
}

export default ConversationTracker;