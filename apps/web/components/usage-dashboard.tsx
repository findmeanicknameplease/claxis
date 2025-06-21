'use client';

import React, { useState, useEffect } from 'react';
import { ConversationTracker } from '@/lib/middleware/conversation-tracker';
import { UpgradePrompt } from './upgrade-prompt';

// =============================================================================
// USAGE DASHBOARD COMPONENT
// Premium SaaS for non-tech savvy beauty/wellness business owners
// =============================================================================
// Beautiful, easy-to-understand usage tracking dashboard
// - Real-time conversation usage with visual progress bars
// - Facebook/Meta API limits monitoring
// - Upgrade prompts at optimal times
// - ROI highlighting for business growth
// =============================================================================

interface UsageDashboardProps {
  salonId: string;
  className?: string;
}

interface UsageData {
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

export function UsageDashboard({ salonId, className = '' }: UsageDashboardProps) {
  const [usageData, setUsageData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchUsageData();
    
    // Refresh every 5 minutes
    const interval = setInterval(fetchUsageData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [salonId]);

  const fetchUsageData = async () => {
    try {
      const tracker = new ConversationTracker();
      const data = await tracker.getCurrentUsage(salonId);
      
      if (data) {
        setUsageData(data);
        setError(null);
      } else {
        setError('Unable to fetch usage data');
      }
    } catch (err) {
      console.error('Error fetching usage data:', err);
      setError('Error loading usage information');
    } finally {
      setLoading(false);
    }
  };


  const getTierBadgeColor = (tier: string) => {
    switch (tier) {
      case 'free': return 'bg-gray-100 text-gray-800';
      case 'professional': return 'bg-purple-100 text-purple-800';
      case 'enterprise': return 'bg-indigo-100 text-indigo-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getUsageBarColor = (percentage: number) => {
    if (percentage < 50) return 'bg-green-500';
    if (percentage < 80) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-EU', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className={`bg-white rounded-lg shadow-sm border p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-8 bg-gray-200 rounded w-1/2 mb-6"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !usageData) {
    return (
      <div className={`bg-white rounded-lg shadow-sm border p-6 ${className}`}>
        <div className="text-center text-gray-500">
          <div className="text-2xl mb-2">⚠️</div>
          <p>{error || 'Unable to load usage data'}</p>
          <button
            onClick={fetchUsageData}
            className="mt-3 text-purple-600 hover:text-purple-700 text-sm underline"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const isUnlimited = usageData.tier_limit === -1;
  const isNearLimit = usageData.usage_percentage >= 80;
  const isOverLimit = usageData.usage_percentage >= 100;

  return (
    <>
      <div className={`bg-white rounded-lg shadow-sm border ${className}`}>
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Usage Overview</h2>
              <p className="text-sm text-gray-500">
                {formatDate(usageData.period_start)} - {formatDate(usageData.period_end)}
              </p>
            </div>
            
            <div className="text-right">
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getTierBadgeColor(usageData.tier)}`}>
                {usageData.tier.charAt(0).toUpperCase() + usageData.tier.slice(1)} Plan
              </span>
              
              {usageData.upgrade_prompt_eligible && (
                <button
                  onClick={() => setShowUpgradePrompt(true)}
                  className="ml-2 text-xs text-purple-600 hover:text-purple-700 underline"
                >
                  Upgrade Available
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Main Usage Display */}
        <div className="p-6">
          {/* Conversations Usage */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-medium text-gray-900">Monthly Conversations</h3>
              {isNearLimit && !isUnlimited && (
                <span className="text-sm text-orange-600 font-medium">
                  {isOverLimit ? '⚠️ Limit Reached' : '⚠️ Near Limit'}
                </span>
              )}
            </div>

            <div className="flex items-center mb-4">
              <div className="text-3xl font-bold text-gray-900 mr-4">
                {usageData.total_conversations.toLocaleString()}
              </div>
              <div className="text-sm text-gray-500">
                {isUnlimited ? 'Unlimited' : `of ${usageData.tier_limit.toLocaleString()}`}
              </div>
            </div>

            {!isUnlimited && (
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${getUsageBarColor(usageData.usage_percentage)}`}
                  style={{ width: `${Math.min(usageData.usage_percentage, 100)}%` }}
                />
              </div>
            )}

            {!isUnlimited && (
              <div className="flex justify-between text-sm text-gray-500 mt-2">
                <span>{usageData.usage_percentage.toFixed(1)}% used</span>
                <span>
                  {usageData.tier_limit - usageData.total_conversations > 0 
                    ? `${usageData.tier_limit - usageData.total_conversations} remaining`
                    : 'Limit exceeded'
                  }
                </span>
              </div>
            )}
          </div>

          {/* Channel Breakdown */}
          <div className="mb-8">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Channel Breakdown</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-green-800">WhatsApp</div>
                    <div className="text-2xl font-bold text-green-900">
                      {usageData.channels_breakdown.whatsapp}
                    </div>
                  </div>
                  <div className="text-green-500">💬</div>
                </div>
              </div>

              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-purple-800">Instagram</div>
                    <div className="text-2xl font-bold text-purple-900">
                      {usageData.channels_breakdown.instagram}
                    </div>
                  </div>
                  <div className="text-purple-500">📸</div>
                </div>
                {usageData.tier === 'free' && (
                  <div className="text-xs text-purple-600 mt-1">
                    Upgrade to unlock
                  </div>
                )}
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-blue-800">Voice</div>
                    <div className="text-2xl font-bold text-blue-900">
                      {usageData.channels_breakdown.voice}
                    </div>
                  </div>
                  <div className="text-blue-500">📞</div>
                </div>
                {usageData.tier !== 'enterprise' && (
                  <div className="text-xs text-blue-600 mt-1">
                    Enterprise only
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Facebook API Status */}
          <div className="mb-8">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Facebook/Meta API Status</h3>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-medium text-blue-800">Verification Status</div>
                  <div className="flex items-center mt-1">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      usageData.facebook_api_limits.verification_status === 'verified'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {usageData.facebook_api_limits.verification_status === 'verified' ? '✅ Verified' : '⏳ Unverified'}
                    </span>
                    {usageData.facebook_api_limits.verification_status !== 'verified' && usageData.tier === 'enterprise' && (
                      <span className="ml-2 text-xs text-blue-600">Verification assistance included</span>
                    )}
                  </div>
                </div>

                <div>
                  <div className="text-sm font-medium text-blue-800">Daily Limit</div>
                  <div className="mt-1">
                    <span className="text-lg font-bold text-blue-900">
                      {usageData.facebook_api_limits.business_initiated_today}
                    </span>
                    <span className="text-sm text-blue-600">
                      /{usageData.facebook_api_limits.daily_limit}
                    </span>
                  </div>
                </div>
              </div>

              {usageData.facebook_api_limits.verification_status !== 'verified' && (
                <div className="mt-3 text-sm text-blue-700">
                  💡 Business verification increases your daily limit from 250 to 1,000+ conversations and unlocks Instagram automation.
                </div>
              )}
            </div>
          </div>

          {/* Upgrade CTA for Free Tier */}
          {usageData.tier === 'free' && (isNearLimit || usageData.upgrade_prompt_eligible) && (
            <div className="bg-gradient-to-r from-purple-600 to-purple-800 text-white rounded-lg p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-bold mb-2">🚀 Ready to Scale Your Salon?</h3>
                  <p className="text-purple-100 mb-4">
                    You're using your free conversations efficiently! Upgrade to unlock unlimited conversations, 
                    Instagram automation, and marketing features that can generate €2,800-8,700 additional monthly revenue.
                  </p>
                  <button
                    onClick={() => setShowUpgradePrompt(true)}
                    className="bg-white text-purple-600 px-6 py-2 rounded-lg font-semibold hover:bg-purple-50 transition-colors"
                  >
                    See Upgrade Options
                  </button>
                </div>
                <div className="text-4xl opacity-75">💰</div>
              </div>
            </div>
          )}

          {/* Professional Tier Voice AI Promotion */}
          {usageData.tier === 'professional' && (
            <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 text-white rounded-lg p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-bold mb-2">📞 Add Voice AI to Replace Your Receptionist</h3>
                  <p className="text-indigo-100 mb-4">
                    Your marketing automation is working great! Now add our Voice AI agent to handle calls 24/7. 
                    It can replace a €1,200+/month receptionist while increasing bookings with 85% answer rates.
                  </p>
                  <button
                    onClick={() => setShowUpgradePrompt(true)}
                    className="bg-white text-indigo-600 px-6 py-2 rounded-lg font-semibold hover:bg-indigo-50 transition-colors"
                  >
                    Learn About Enterprise
                  </button>
                </div>
                <div className="text-4xl opacity-75">🤖</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Upgrade Prompt Modal */}
      {showUpgradePrompt && (
        <UpgradePrompt
          salonId={salonId}
          currentTier={usageData.tier}
          conversationsUsed={usageData.total_conversations}
          monthlyLimit={usageData.tier_limit}
          onUpgrade={(targetTier) => {
            console.log('Upgrading to:', targetTier);
            setShowUpgradePrompt(false);
            // TODO: Implement upgrade flow
          }}
          onDismiss={() => setShowUpgradePrompt(false)}
        />
      )}
    </>
  );
}

export default UsageDashboard;