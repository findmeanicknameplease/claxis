'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, ArrowLeft, CreditCard, Shield, Euro } from 'lucide-react';
import Link from 'next/link';

type Tier = 'professional' | 'enterprise';

interface TierDetails {
  name: string;
  price: number;
  features: string[];
  roiEstimate: string;
  description: string;
  popular?: boolean;
}

const tierDetails: Record<Tier, TierDetails> = {
  professional: {
    name: 'Professional',
    price: 99.99,
    description: 'Perfect for growing salons with 2-5 staff members',
    roiEstimate: '€2,800-8,700/month',
    features: [
      'Unlimited WhatsApp conversations',
      'Instagram automation & lead capture',
      'Marketing campaigns & win-back automation',
      'Customer analytics & insights',
      'Multi-language support (4 EU languages)',
      'Email support & setup assistance',
      'Calendar integration (Google + Outlook)',
      'Custom business hours & services'
    ],
    popular: true
  },
  enterprise: {
    name: 'Enterprise',
    price: 299.99,
    description: 'For large salons and chains ready for maximum automation',
    roiEstimate: '€4,600-12,700/month',
    features: [
      'Everything in Professional plan',
      '24/7 Voice AI receptionist (replaces €1,200/month staff)',
      'Facebook/Meta business verification (€199 value)',
      'Custom voice cloning for your salon',
      'Advanced spam protection & call filtering',
      'Real-time performance monitoring',
      'Priority support & dedicated success manager',
      'Multi-location management'
    ]
  }
};

function PaymentContent() {
  const searchParams = useSearchParams();
  const [selectedTier, setSelectedTier] = useState<Tier>('professional');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccess] = useState(false);

  useEffect(() => {
    const tier = searchParams.get('tier') as Tier;
    if (tier && tierDetails[tier]) {
      setSelectedTier(tier);
    }
  }, [searchParams]);

  const selectedPlan = tierDetails[selectedTier];

  const handleSubscribe = async () => {
    setIsProcessing(true);
    
    try {
      const { createCheckoutSession } = await import('@/lib/stripe/client');
      
      await createCheckoutSession({
        tier: selectedTier,
        successUrl: `${window.location.origin}/dashboard?welcome=true&tier=${selectedTier}`,
        cancelUrl: window.location.href,
        salonData: {
          businessName: 'Salon Name', // TODO: Get from onboarding data
          ownerName: 'Owner Name', // TODO: Get from onboarding data  
          email: 'owner@salon.com', // TODO: Get from onboarding data
          phone: '+49 30 12345678', // TODO: Get from onboarding data
        },
      });
      
      // If we reach here, something went wrong with the redirect
      throw new Error('Failed to redirect to Stripe Checkout');
      
    } catch (error) {
      console.error('Payment error:', error);
      alert(`Payment error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  if (showSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50 flex items-center justify-center p-4">
        <Card className="max-w-2xl w-full p-8 text-center">
          <div className="space-y-6">
            <div className="text-6xl mb-4">🎉</div>
            
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Welcome to {selectedPlan.name}!
              </h1>
              <p className="text-lg text-gray-600">
                Your subscription is active and your AI is getting smarter
              </p>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-green-800 mb-4">
                🚀 You're all set!
              </h2>
              
              <div className="space-y-2 text-left">
                <div className="flex items-center gap-2 text-sm text-green-700">
                  <CheckCircle className="h-4 w-4" />
                  <span>{selectedPlan.name} features activated</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-green-700">
                  <CheckCircle className="h-4 w-4" />
                  <span>AI is learning your salon's style</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-green-700">
                  <CheckCircle className="h-4 w-4" />
                  <span>Expected ROI: {selectedPlan.roiEstimate}</span>
                </div>
                {selectedTier === 'enterprise' && (
                  <div className="flex items-center gap-2 text-sm text-green-700">
                    <CheckCircle className="h-4 w-4" />
                    <span>Voice AI receptionist activating...</span>
                  </div>
                )}
              </div>
            </div>

            <div>
              <p className="text-sm text-gray-600 mb-4">
                Redirecting to your dashboard where you can start seeing results...
              </p>
              <div className="animate-spin h-6 w-6 border-2 border-purple-500 border-t-transparent rounded-full mx-auto"></div>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/onboarding" className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors">
            <ArrowLeft className="h-4 w-4" />
            <span>Back to setup</span>
          </Link>
          
          <div className="flex items-center space-x-2">
            <div className="text-xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              Claxis AI
            </div>
            <span className="text-sm text-gray-500">Payment</span>
          </div>
          
          <div className="w-20"></div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          
          {/* Page Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-4">Complete Your Subscription</h1>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Join hundreds of salon owners who've transformed their business with AI automation. 
              Most see ROI within their first week!
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-8">
            
            {/* Plan Selection */}
            <div className="space-y-6">
              <h2 className="text-2xl font-semibold">Choose Your Plan</h2>
              
              <div className="space-y-4">
                {(Object.keys(tierDetails) as Tier[]).map((tier) => {
                  const plan = tierDetails[tier];
                  const isSelected = selectedTier === tier;
                  
                  return (
                    <Card 
                      key={tier}
                      className={`cursor-pointer transition-all ${
                        isSelected ? 'border-2 border-purple-500 bg-purple-50' : 'hover:border-gray-300'
                      }`}
                      onClick={() => setSelectedTier(tier)}
                    >
                      <CardHeader>
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <CardTitle className="text-xl">{plan.name}</CardTitle>
                              {plan.popular && (
                                <Badge className="bg-purple-500">Most Popular</Badge>
                              )}
                            </div>
                            <p className="text-sm text-gray-600">{plan.description}</p>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold">€{plan.price}</div>
                            <div className="text-sm text-gray-500">/month</div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="text-sm font-medium text-green-600 mb-3">
                          Expected ROI: {plan.roiEstimate}
                        </div>
                        <div className="grid grid-cols-1 gap-2">
                          {plan.features.slice(0, 4).map((feature, index) => (
                            <div key={index} className="flex items-center gap-2 text-sm">
                              <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                              <span>{feature}</span>
                            </div>
                          ))}
                          {plan.features.length > 4 && (
                            <div className="text-xs text-gray-500 mt-1">
                              +{plan.features.length - 4} more features
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>

            {/* Payment Summary */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Payment Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span>{selectedPlan.name} Plan</span>
                    <span className="font-semibold">€{selectedPlan.price}/month</span>
                  </div>
                  
                  <div className="flex justify-between items-center text-sm text-gray-600">
                    <span>EU VAT (included)</span>
                    <span>€0.00</span>
                  </div>
                  
                  <hr />
                  
                  <div className="flex justify-between items-center text-lg font-bold">
                    <span>Total Today</span>
                    <span>€{selectedPlan.price}</span>
                  </div>
                  
                  <div className="text-xs text-gray-500">
                    Billed monthly • Cancel anytime • EU VAT compliant
                  </div>
                </CardContent>
              </Card>

              {/* ROI Calculator */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-green-600">
                    <Euro className="h-5 w-5" />
                    Your Investment Return
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm">Monthly cost:</span>
                    <span className="font-semibold">€{selectedPlan.price}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Expected monthly ROI:</span>
                    <span className="font-semibold text-green-600">{selectedPlan.roiEstimate}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Payback period:</span>
                    <span className="font-semibold">3-7 days</span>
                  </div>
                  
                  {selectedTier === 'enterprise' && (
                    <div className="bg-blue-50 p-3 rounded-lg mt-4">
                      <div className="text-sm font-medium text-blue-800 mb-1">
                        Voice AI Receptionist Savings:
                      </div>
                      <div className="text-xs text-blue-600">
                        Replaces €1,200/month receptionist salary + benefits
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Payment Button */}
              <Button 
                onClick={handleSubscribe}
                disabled={isProcessing}
                size="lg"
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
              >
                {isProcessing ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                    <span>Activating your subscription...</span>
                  </div>
                ) : (
                  <>Start {selectedPlan.name} Plan - €{selectedPlan.price}/month</>
                )}
              </Button>

              {/* Security */}
              <div className="flex items-center justify-center gap-4 text-xs text-gray-500">
                <div className="flex items-center gap-1">
                  <Shield className="h-3 w-3" />
                  <span>Stripe secured</span>
                </div>
                <span>•</span>
                <span>EU GDPR compliant</span>
                <span>•</span>
                <span>Cancel anytime</span>
              </div>
            </div>
          </div>

          {/* Trust Indicators */}
          <div className="mt-12 bg-white/60 backdrop-blur-sm rounded-lg p-6">
            <div className="text-center mb-4">
              <h3 className="font-semibold text-gray-900">Why salon owners choose Claxis AI</h3>
            </div>
            <div className="grid md:grid-cols-3 gap-4 text-sm text-gray-600">
              <div className="text-center">
                <div className="text-2xl mb-2">⚡</div>
                <div className="font-medium">Setup in 15 minutes</div>
                <div>No technical skills required</div>
              </div>
              <div className="text-center">
                <div className="text-2xl mb-2">📈</div>
                <div className="font-medium">Proven ROI</div>
                <div>Most salons see results in 24h</div>
              </div>
              <div className="text-center">
                <div className="text-2xl mb-2">🇪🇺</div>
                <div className="font-medium">EU Compliant</div>
                <div>Data hosted in Frankfurt</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PaymentPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50 flex items-center justify-center">
        <Card className="w-full max-w-md p-8 text-center">
          <div className="animate-spin h-8 w-8 border-2 border-purple-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Loading payment options...</p>
        </Card>
      </div>
    }>
      <PaymentContent />
    </Suspense>
  );
}