'use client';

import React, { useState, useEffect } from 'react';
import { getUpgradePromptData } from '@/lib/middleware/conversation-tracker';

// =============================================================================
// UPGRADE PROMPT COMPONENT
// Premium SaaS for non-tech savvy beauty/wellness business owners
// =============================================================================
// Intelligent upgrade prompts with compelling ROI calculations
// - Triggers at 80% usage for free tier
// - Facebook/Meta business verification benefits
// - State-of-art easy presentation for beauty salon owners
// =============================================================================

interface UpgradePromptProps {
  salonId: string;
  currentTier: 'free' | 'professional' | 'enterprise';
  conversationsUsed: number;
  monthlyLimit: number;
  onUpgrade?: (targetTier: string) => void;
  onDismiss?: () => void;
  className?: string;
}

interface ROICalculation {
  monthly_cost: number;
  estimated_monthly_roi: string;
  payback_period_days: number;
  annual_savings: string;
  key_benefits: string[];
  feature_comparison: Record<string, boolean>;
}

export function UpgradePrompt({
  salonId,
  currentTier,
  conversationsUsed,
  monthlyLimit,
  onUpgrade,
  onDismiss,
  className = ''
}: UpgradePromptProps) {
  const [showPrompt, setShowPrompt] = useState(false);
  const [recommendations, setRecommendations] = useState<any>(null);
  const [selectedTier, setSelectedTier] = useState<string>('');
  const [showROIDetails, setShowROIDetails] = useState(false);

  useEffect(() => {
    checkUpgradeEligibility();
  }, [salonId, conversationsUsed, monthlyLimit]);

  const checkUpgradeEligibility = async () => {
    try {
      const data = await getUpgradePromptData(salonId);
      
      if (data.should_show_prompt && data.recommendations?.should_upgrade) {
        setRecommendations(data.recommendations);
        setSelectedTier(data.recommendations.recommended_tier);
        setShowPrompt(true);
      }
    } catch (error) {
      console.error('Error checking upgrade eligibility:', error);
    }
  };

  const getROICalculation = (tier: string): ROICalculation => {
    switch (tier) {
      case 'professional':
        return {
          monthly_cost: 99.99,
          estimated_monthly_roi: '€2,800-8,700',
          payback_period_days: 3,
          annual_savings: '€33,600-104,400',
          key_benefits: [
            'Win-back campaigns: €2,000-5,000 monthly revenue',
            'No-show prevention: €300-1,200 monthly savings',
            'Post-service upselling: €500-1,500 monthly revenue',
            'Instagram lead generation: 40% more bookings'
          ],
          feature_comparison: {
            'Unlimited conversations': true,
            'Instagram automation': true,
            'Marketing campaigns': true,
            'Voice AI agent': false,
            'Business verification': false,
            'Custom voice cloning': false
          }
        };
        
      case 'enterprise':
        return {
          monthly_cost: 299.99,
          estimated_monthly_roi: '€4,600-12,700',
          payback_period_days: 7,
          annual_savings: '€55,200-152,400',
          key_benefits: [
            'Voice AI replaces €1,200+ receptionist',
            'Voice campaigns: 85% answer rate vs 20% WhatsApp',
            'VIP follow-up calls: 80% rebooking rate',
            'Business verification: Unlock 20x Facebook limits'
          ],
          feature_comparison: {
            'Everything in Professional': true,
            'Voice AI agent 24/7': true,
            'Voice campaigns': true,
            'Business verification': true,
            'Custom voice cloning': true,
            'Priority support': true
          }
        };
        
      default:
        return {
          monthly_cost: 0,
          estimated_monthly_roi: '€0',
          payback_period_days: 0,
          annual_savings: '€0',
          key_benefits: [],
          feature_comparison: {}
        };
    }
  };

  const handleUpgrade = () => {
    if (onUpgrade) {
      onUpgrade(selectedTier);
    }
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    if (onDismiss) {
      onDismiss();
    }
    setShowPrompt(false);
  };

  if (!showPrompt || !recommendations) {
    return null;
  }

  const usagePercentage = monthlyLimit > 0 ? (conversationsUsed / monthlyLimit) * 100 : 0;
  const roiCalc = getROICalculation(selectedTier);
  const isFreeTier = currentTier === 'free';

  return (
    <div className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 ${className}`}>
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-purple-800 text-white p-6 rounded-t-lg">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold mb-2">
                {isFreeTier ? '🚀 Ready to Grow Your Salon?' : '📈 Unlock Premium Features'}
              </h2>
              <p className="text-purple-100">
                {isFreeTier 
                  ? `You've used ${conversationsUsed} of ${monthlyLimit} free conversations this month`
                  : 'Take your salon automation to the next level'
                }
              </p>
              
              {/* Usage Bar for Free Tier */}
              {isFreeTier && (
                <div className="mt-3">
                  <div className="bg-purple-400 rounded-full h-3 overflow-hidden">
                    <div 
                      className="bg-white h-full transition-all duration-300"
                      style={{ width: `${Math.min(usagePercentage, 100)}%` }}
                    />
                  </div>
                  <p className="text-sm text-purple-100 mt-1">
                    {usagePercentage >= 100 ? 'Limit reached!' : `${usagePercentage.toFixed(0)}% used`}
                  </p>
                </div>
              )}
            </div>
            
            <button
              onClick={handleDismiss}
              className="text-white hover:text-purple-200 text-2xl"
            >
              ×
            </button>
          </div>
        </div>

        <div className="p-6">
          {/* Tier Selection */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-4">Choose Your Upgrade Path:</h3>
            <div className="grid md:grid-cols-2 gap-4">
              {/* Professional Tier */}
              <div 
                className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                  selectedTier === 'professional' 
                    ? 'border-purple-500 bg-purple-50' 
                    : 'border-gray-200 hover:border-purple-300'
                }`}
                onClick={() => setSelectedTier('professional')}
              >
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xl font-bold text-purple-600">Professional</h4>
                  <div className="text-right">
                    <div className="text-2xl font-bold">€99.99</div>
                    <div className="text-sm text-gray-500">/month</div>
                  </div>
                </div>
                
                <div className="text-sm text-gray-600 mb-3">
                  Perfect for growing salons ready for marketing automation
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center text-sm">
                    <span className="text-green-500 mr-2">✓</span>
                    Unlimited customer conversations
                  </div>
                  <div className="flex items-center text-sm">
                    <span className="text-green-500 mr-2">✓</span>
                    Instagram automation
                  </div>
                  <div className="flex items-center text-sm">
                    <span className="text-green-500 mr-2">✓</span>
                    Marketing campaigns
                  </div>
                </div>
                
                <div className="mt-3 text-sm font-semibold text-green-600">
                  ROI: €2,800-8,700/month
                </div>
              </div>

              {/* Enterprise Tier */}
              <div 
                className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                  selectedTier === 'enterprise' 
                    ? 'border-purple-500 bg-purple-50' 
                    : 'border-gray-200 hover:border-purple-300'
                }`}
                onClick={() => setSelectedTier('enterprise')}
              >
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xl font-bold text-purple-600">Enterprise</h4>
                  <div className="text-right">
                    <div className="text-2xl font-bold">€299.99</div>
                    <div className="text-sm text-gray-500">/month</div>
                  </div>
                </div>
                
                <div className="text-sm text-gray-600 mb-3">
                  Premium salons with Voice AI and full automation
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center text-sm">
                    <span className="text-green-500 mr-2">✓</span>
                    Everything in Professional
                  </div>
                  <div className="flex items-center text-sm">
                    <span className="text-green-500 mr-2">✓</span>
                    24/7 Voice AI agent
                  </div>
                  <div className="flex items-center text-sm">
                    <span className="text-green-500 mr-2">✓</span>
                    Business verification service
                  </div>
                </div>
                
                <div className="mt-3 text-sm font-semibold text-green-600">
                  ROI: €4,600-12,700/month
                </div>
              </div>
            </div>
          </div>

          {/* ROI Calculator */}
          {selectedTier && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-green-800">
                  💰 Your ROI with {selectedTier.charAt(0).toUpperCase() + selectedTier.slice(1)}
                </h3>
                <button
                  onClick={() => setShowROIDetails(!showROIDetails)}
                  className="text-green-600 text-sm underline"
                >
                  {showROIDetails ? 'Hide Details' : 'Show Calculation'}
                </button>
              </div>
              
              <div className="grid md:grid-cols-3 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {roiCalc.estimated_monthly_roi}
                  </div>
                  <div className="text-sm text-green-700">Monthly ROI</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {roiCalc.payback_period_days} days
                  </div>
                  <div className="text-sm text-green-700">Payback Period</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {roiCalc.annual_savings}
                  </div>
                  <div className="text-sm text-green-700">Annual Savings</div>
                </div>
              </div>
              
              {showROIDetails && (
                <div className="border-t border-green-200 pt-4">
                  <h4 className="font-semibold text-green-800 mb-2">Revenue Breakdown:</h4>
                  <div className="space-y-1">
                    {roiCalc.key_benefits.map((benefit, index) => (
                      <div key={index} className="flex items-center text-sm text-green-700">
                        <span className="text-green-500 mr-2">→</span>
                        {benefit}
                      </div>
                    ))}
                  </div>
                  
                  <div className="mt-3 text-sm text-green-600">
                    <strong>Net monthly profit after upgrade cost: 
                    €{((parseInt(roiCalc.estimated_monthly_roi.split('-')[0]?.replace('€', '').replace(',', '') || '0') || 0) - roiCalc.monthly_cost).toLocaleString()}-{((parseInt((roiCalc.estimated_monthly_roi.split('-')[1]?.replace('€', '').replace(',', '') || '0'))) - roiCalc.monthly_cost).toLocaleString()}</strong>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Special Offers */}
          {isFreeTier && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <h3 className="font-semibold text-blue-800 mb-2">🎁 Limited Time Offer</h3>
              <p className="text-blue-700 text-sm">
                Upgrade now and get <strong>business verification assistance worth €199</strong> included 
                with Enterprise tier. Plus, <strong>first month 50% off</strong> for early adopters!
              </p>
            </div>
          )}

          {/* Facebook/Meta Business Benefits */}
          {selectedTier === 'enterprise' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <h3 className="font-semibold text-blue-800 mb-2">
                📱 Facebook/Meta Business Verification Benefits
              </h3>
              <div className="space-y-2 text-sm text-blue-700">
                <div className="flex items-center">
                  <span className="text-blue-500 mr-2">✓</span>
                  Increase daily conversation limit from 250 to 1,000+
                </div>
                <div className="flex items-center">
                  <span className="text-blue-500 mr-2">✓</span>
                  Instagram automation with verified business account
                </div>
                <div className="flex items-center">
                  <span className="text-blue-500 mr-2">✓</span>
                  Green tick verification for professional credibility
                </div>
                <div className="flex items-center">
                  <span className="text-blue-500 mr-2">✓</span>
                  White-glove setup service included (€199 value)
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleUpgrade}
              className="flex-1 bg-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-purple-700 transition-colors"
            >
              Upgrade to {selectedTier?.charAt(0).toUpperCase() + selectedTier?.slice(1)} - €{roiCalc.monthly_cost}/month
            </button>
            
            <button
              onClick={() => {/* Schedule demo */}}
              className="flex-1 bg-white border-2 border-purple-600 text-purple-600 px-6 py-3 rounded-lg font-semibold hover:bg-purple-50 transition-colors"
            >
              Schedule 15min Demo
            </button>
            
            <button
              onClick={handleDismiss}
              className="text-gray-500 px-4 py-3 hover:text-gray-700"
            >
              Maybe Later
            </button>
          </div>

          {/* Trust Signals */}
          <div className="mt-6 text-center text-sm text-gray-500">
            <p>💳 Cancel anytime • 🔒 EU data privacy compliant • 📞 Setup assistance included</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// USAGE TRACKING HOOK
// =============================================================================

export function useUpgradePrompt(salonId: string) {
  const [promptData, setPromptData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const checkUpgradeEligibility = async () => {
    if (!salonId) return;
    
    setLoading(true);
    try {
      const data = await getUpgradePromptData(salonId);
      setPromptData(data);
    } catch (error) {
      console.error('Error checking upgrade eligibility:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkUpgradeEligibility();
  }, [salonId]);

  return {
    promptData,
    loading,
    shouldShow: promptData?.should_show_prompt || false,
    refresh: checkUpgradeEligibility
  };
}

export default UpgradePrompt;