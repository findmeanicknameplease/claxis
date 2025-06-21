'use client';

import React, { useState } from 'react';

// =============================================================================
// FREEMIUM ONBOARDING FLOW
// Premium SaaS for non-tech savvy beauty/wellness business owners
// =============================================================================
// State-of-art easy onboarding with tier selection
// - Starts with free tier value demonstration
// - Clear progression path to premium features
// - Business verification assistance for Enterprise
// - Facebook/Meta compliance guidance
// =============================================================================

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  component: React.ComponentType<any>;
  required: boolean;
  estimatedTime: string;
}

interface SalonData {
  businessName: string;
  ownerName: string;
  email: string;
  phone: string;
  whatsappNumber: string;
  instagramHandle: string;
  location: string;
  services: string[];
  languages: string[];
  businessHours: Record<string, any>;
  selectedTier: 'free' | 'professional' | 'enterprise';
  wantsBusinessVerification: boolean;
}

interface FreemiumOnboardingProps {
  onComplete: (data: SalonData) => void;
  onTierChange?: (tier: 'free' | 'professional' | 'enterprise') => void;
  className?: string;
}

export function FreemiumOnboarding({ 
  onComplete, 
  onTierChange,
  className = '' 
}: FreemiumOnboardingProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [salonData, setSalonData] = useState<Partial<SalonData>>({
    selectedTier: 'free',
    services: [],
    languages: ['English'],
    businessHours: {},
    wantsBusinessVerification: false
  });
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [showTierComparison, setShowTierComparison] = useState(false);

  const onboardingSteps: OnboardingStep[] = [
    {
      id: 'welcome',
      title: 'Welcome to Claxis AI',
      description: 'Choose your plan and let\'s get started',
      component: WelcomeTierSelection,
      required: true,
      estimatedTime: '2 min'
    },
    {
      id: 'business_basics',
      title: 'Tell us about your salon',
      description: 'Basic information to personalize your experience',
      component: BusinessBasicsForm,
      required: true,
      estimatedTime: '3 min'
    },
    {
      id: 'whatsapp_setup',
      title: 'Connect WhatsApp Business',
      description: 'Start automating customer conversations',
      component: WhatsAppSetupGuide,
      required: true,
      estimatedTime: '3 min'
    },
    {
      id: 'instagram_setup',
      title: 'Connect Instagram (Optional)',
      description: 'Automate lead generation from Instagram',
      component: InstagramSetupGuide,
      required: false,
      estimatedTime: '2 min'
    },
    {
      id: 'business_verification',
      title: 'Business Verification Setup',
      description: 'Unlock premium Facebook/Meta features',
      component: BusinessVerificationGuide,
      required: false,
      estimatedTime: '5 min'
    },
    {
      id: 'ai_demo',
      title: 'Meet Your AI Assistant',
      description: 'See how AI will help your salon',
      component: AIDemo,
      required: false,
      estimatedTime: '2 min'
    }
  ];

  const handleStepComplete = (stepData: any) => {
    const currentStepItem = onboardingSteps[currentStep];
    if (!currentStepItem) return;
    
    const currentStepId = currentStepItem.id;
    setCompletedSteps(prev => new Set([...prev, currentStepId]));
    setSalonData(prev => ({ ...prev, ...stepData }));

    // Move to next required step or complete onboarding
    const nextStep = findNextStep();
    if (nextStep !== -1) {
      setCurrentStep(nextStep);
    } else {
      // All required steps completed
      onComplete(salonData as SalonData);
    }
  };

  const findNextStep = (): number => {
    for (let i = currentStep + 1; i < onboardingSteps.length; i++) {
      const step = onboardingSteps[i];
      if (!step) continue;
      
      // Skip Instagram setup for free tier
      if (step.id === 'instagram_setup' && salonData.selectedTier === 'free') {
        continue;
      }
      
      // Skip business verification unless Enterprise tier
      if (step.id === 'business_verification' && salonData.selectedTier !== 'enterprise') {
        continue;
      }
      
      // Show next required step or optional step
      if (step.required || !completedSteps.has(step.id)) {
        return i;
      }
    }
    return -1;
  };

  const handleTierChange = (tier: 'free' | 'professional' | 'enterprise') => {
    setSalonData(prev => ({ ...prev, selectedTier: tier }));
    if (onTierChange) {
      onTierChange(tier);
    }
  };

  const getCurrentStepComponent = () => {
    const step = onboardingSteps[currentStep];
    if (!step) return null;
    
    const StepComponent = step.component;
    
    return (
      <StepComponent
        salonData={salonData}
        onComplete={handleStepComplete}
        onTierChange={handleTierChange}
        onShowTierComparison={() => setShowTierComparison(true)}
      />
    );
  };

  const progress = ((currentStep + 1) / onboardingSteps.length) * 100;

  return (
    <>
      <div className={`max-w-4xl mx-auto ${className}`}>
        {/* Progress Header */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Set up your AI salon assistant
              </h1>
              <p className="text-gray-600">
                Step {currentStep + 1} of {onboardingSteps.length}: {onboardingSteps[currentStep]?.title || 'Current Step'}
              </p>
            </div>
            
            <div className="text-right">
              <div className="text-sm text-gray-500 mb-1">
                ~{onboardingSteps[currentStep]?.estimatedTime || '5 minutes'} remaining
              </div>
              <div className={`text-sm font-medium px-3 py-1 rounded-full ${
                salonData.selectedTier === 'free' ? 'bg-gray-100 text-gray-800' :
                salonData.selectedTier === 'professional' ? 'bg-purple-100 text-purple-800' :
                'bg-indigo-100 text-indigo-800'
              }`}>
                {salonData.selectedTier ? salonData.selectedTier.charAt(0).toUpperCase() + salonData.selectedTier.slice(1) : 'Free'} Plan
              </div>
            </div>
          </div>
          
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-gradient-to-r from-purple-500 to-purple-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Current Step */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          {getCurrentStepComponent()}
        </div>

        {/* Step Navigation */}
        <div className="mt-6 flex justify-between items-center">
          <button
            onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
            disabled={currentStep === 0}
            className="text-gray-500 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ← Previous
          </button>
          
          <div className="flex space-x-2">
            {onboardingSteps.map((step, index) => (
              <div
                key={step.id}
                className={`w-3 h-3 rounded-full ${
                  index === currentStep ? 'bg-purple-500' :
                  completedSteps.has(step.id) ? 'bg-green-500' :
                  'bg-gray-300'
                }`}
              />
            ))}
          </div>
          
          <button
            onClick={() => setShowTierComparison(true)}
            className="text-purple-600 hover:text-purple-700"
          >
            Compare Plans →
          </button>
        </div>
      </div>

      {/* Tier Comparison Modal */}
      {showTierComparison && (
        <TierComparisonModal
          currentTier={salonData.selectedTier || 'free'}
          onSelectTier={handleTierChange}
          onClose={() => setShowTierComparison(false)}
        />
      )}
    </>
  );
}

// =============================================================================
// STEP COMPONENTS
// =============================================================================

function WelcomeTierSelection({ salonData, onComplete, onTierChange, onShowTierComparison }: any) {
  const [selectedTier, setSelectedTier] = useState<'free' | 'professional' | 'enterprise'>(salonData.selectedTier || 'free');

  const handleContinue = () => {
    onTierChange(selectedTier);
    onComplete({ selectedTier });
  };

  return (
    <div className="text-center">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">
          Welcome to the future of salon automation! 🚀
        </h2>
        <p className="text-lg text-gray-600">
          Start free and scale as you grow. Most salons see ROI within the first week.
        </p>
      </div>

      {/* Tier Selection Cards */}
      <div className="grid md:grid-cols-3 gap-6 mb-8">
        {/* Free Tier */}
        <div 
          className={`border-2 rounded-lg p-6 cursor-pointer transition-all ${
            selectedTier === 'free' ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-gray-300'
          }`}
          onClick={() => setSelectedTier('free')}
        >
          <div className="text-center">
            <h3 className="text-xl font-bold text-gray-900 mb-2">Free</h3>
            <div className="text-3xl font-bold text-gray-900 mb-1">€0</div>
            <div className="text-sm text-gray-500 mb-4">/month</div>
            
            <div className="space-y-2 text-sm text-left">
              <div className="flex items-center">
                <span className="text-green-500 mr-2">✓</span>
                100 conversations/month
              </div>
              <div className="flex items-center">
                <span className="text-green-500 mr-2">✓</span>
                WhatsApp automation
              </div>
              <div className="flex items-center">
                <span className="text-green-500 mr-2">✓</span>
                Basic AI responses
              </div>
              <div className="flex items-center">
                <span className="text-green-500 mr-2">✓</span>
                Community support
              </div>
            </div>
            
            <div className="mt-4 text-sm font-medium text-purple-600">
              Perfect to get started!
            </div>
          </div>
        </div>

        {/* Professional Tier */}
        <div 
          className={`border-2 rounded-lg p-6 cursor-pointer transition-all relative ${
            selectedTier === 'professional' ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-gray-300'
          }`}
          onClick={() => setSelectedTier('professional')}
        >
          <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
            <span className="bg-purple-500 text-white text-xs px-3 py-1 rounded-full">
              Most Popular
            </span>
          </div>
          
          <div className="text-center">
            <h3 className="text-xl font-bold text-gray-900 mb-2">Professional</h3>
            <div className="text-3xl font-bold text-gray-900 mb-1">€99.99</div>
            <div className="text-sm text-gray-500 mb-4">/month</div>
            
            <div className="space-y-2 text-sm text-left">
              <div className="flex items-center">
                <span className="text-green-500 mr-2">✓</span>
                Unlimited conversations
              </div>
              <div className="flex items-center">
                <span className="text-green-500 mr-2">✓</span>
                Instagram automation
              </div>
              <div className="flex items-center">
                <span className="text-green-500 mr-2">✓</span>
                Marketing campaigns
              </div>
              <div className="flex items-center">
                <span className="text-green-500 mr-2">✓</span>
                Win-back automation
              </div>
            </div>
            
            <div className="mt-4 text-sm font-medium text-green-600">
              ROI: €2,800-8,700/month
            </div>
          </div>
        </div>

        {/* Enterprise Tier */}
        <div 
          className={`border-2 rounded-lg p-6 cursor-pointer transition-all ${
            selectedTier === 'enterprise' ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-gray-300'
          }`}
          onClick={() => setSelectedTier('enterprise')}
        >
          <div className="text-center">
            <h3 className="text-xl font-bold text-gray-900 mb-2">Enterprise</h3>
            <div className="text-3xl font-bold text-gray-900 mb-1">€299.99</div>
            <div className="text-sm text-gray-500 mb-4">/month</div>
            
            <div className="space-y-2 text-sm text-left">
              <div className="flex items-center">
                <span className="text-green-500 mr-2">✓</span>
                Everything in Professional
              </div>
              <div className="flex items-center">
                <span className="text-green-500 mr-2">✓</span>
                24/7 Voice AI agent
              </div>
              <div className="flex items-center">
                <span className="text-green-500 mr-2">✓</span>
                Business verification
              </div>
              <div className="flex items-center">
                <span className="text-green-500 mr-2">✓</span>
                Custom voice cloning
              </div>
            </div>
            
            <div className="mt-4 text-sm font-medium text-green-600">
              ROI: €4,600-12,700/month
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center space-x-4">
        <button
          onClick={handleContinue}
          className="bg-purple-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-purple-700 transition-colors"
        >
          Start with {selectedTier.charAt(0).toUpperCase() + selectedTier.slice(1)}
        </button>
        
        <button
          onClick={onShowTierComparison}
          className="text-purple-600 hover:text-purple-700 text-sm underline"
        >
          Compare all features →
        </button>
      </div>

      <div className="mt-6 text-center text-sm text-gray-500">
        💳 No credit card required for Free plan • 🔄 Change plans anytime • 📞 Setup help included
      </div>
    </div>
  );
}

function BusinessBasicsForm({ salonData, onComplete }: any) {
  const [formData, setFormData] = useState({
    businessName: salonData.businessName || '',
    ownerName: salonData.ownerName || '',
    email: salonData.email || '',
    phone: salonData.phone || '',
    whatsappNumber: salonData.whatsappNumber || '',
    location: salonData.location || '',
    services: salonData.services || [],
    languages: salonData.languages || ['English']
  });

  const commonServices = [
    'Haircut', 'Hair Color', 'Highlights', 'Blowout', 'Hair Treatment',
    'Manicure', 'Pedicure', 'Gel Polish', 'Eyebrow Threading', 'Waxing',
    'Facial', 'Massage', 'Makeup', 'Hair Extensions'
  ];

  const languages = [
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'de', name: 'German', flag: '🇩🇪' },
    { code: 'fr', name: 'French', flag: '🇫🇷' },
    { code: 'es', name: 'Spanish', flag: '🇪🇸' },
    { code: 'it', name: 'Italian', flag: '🇮🇹' },
    { code: 'nl', name: 'Dutch', flag: '🇳🇱' }
  ];

  const handleSubmit = () => {
    if (!formData.businessName || !formData.email || !formData.phone) {
      alert('Please fill in all required fields');
      return;
    }
    onComplete(formData);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Tell us about your salon</h2>
        <p className="text-gray-600">This helps us personalize your AI assistant.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Salon Name *
          </label>
          <input
            type="text"
            value={formData.businessName}
            onChange={(e) => setFormData({...formData, businessName: e.target.value})}
            placeholder="e.g., Bella Hair Studio"
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Your Name *
          </label>
          <input
            type="text"
            value={formData.ownerName}
            onChange={(e) => setFormData({...formData, ownerName: e.target.value})}
            placeholder="e.g., Maria Rodriguez"
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Email *
          </label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({...formData, email: e.target.value})}
            placeholder="maria@bellahair.com"
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Phone Number *
          </label>
          <input
            type="tel"
            value={formData.phone}
            onChange={(e) => setFormData({...formData, phone: e.target.value})}
            placeholder="+49 30 12345678"
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            WhatsApp Business Number
          </label>
          <input
            type="tel"
            value={formData.whatsappNumber}
            onChange={(e) => setFormData({...formData, whatsappNumber: e.target.value})}
            placeholder="Same as phone or different number"
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
          <p className="text-xs text-gray-500 mt-1">
            We'll help you set up WhatsApp Business if needed
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Location/City
          </label>
          <input
            type="text"
            value={formData.location}
            onChange={(e) => setFormData({...formData, location: e.target.value})}
            placeholder="e.g., Berlin, Germany"
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Services you offer
        </label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {commonServices.map(service => (
            <label key={service} className="flex items-center">
              <input
                type="checkbox"
                checked={formData.services.includes(service)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setFormData({...formData, services: [...formData.services, service]});
                  } else {
                    setFormData({...formData, services: formData.services.filter((s: string) => s !== service)});
                  }
                }}
                className="mr-2 h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
              />
              <span className="text-sm">{service}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Languages your customers speak
        </label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {languages.map(lang => (
            <label key={lang.code} className="flex items-center">
              <input
                type="checkbox"
                checked={formData.languages.includes(lang.name)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setFormData({...formData, languages: [...formData.languages, lang.name]});
                  } else {
                    setFormData({...formData, languages: formData.languages.filter((l: string) => l !== lang.name)});
                  }
                }}
                className="mr-2 h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
              />
              <span className="text-sm">{lang.flag} {lang.name}</span>
            </label>
          ))}
        </div>
      </div>

      <button
        onClick={handleSubmit}
        className="w-full bg-purple-600 text-white py-3 rounded-lg font-semibold hover:bg-purple-700 transition-colors"
      >
        Continue to WhatsApp Setup →
      </button>
    </div>
  );
}

function WhatsAppSetupGuide({ salonData, onComplete }: any) {
  const [setupMethod, setSetupMethod] = useState<'existing' | 'new' | 'help'>('existing');
  const [isConnected, setIsConnected] = useState(false);
  const [showQRCode, setShowQRCode] = useState(false);
  const [qrStep, setQrStep] = useState(1);
  const [isScanning, setIsScanning] = useState(false);

  const handleConnectExisting = () => {
    setShowQRCode(true);
    setQrStep(1);
  };

  const handleQRScan = () => {
    setIsScanning(true);
    setQrStep(2);
    
    // Simulate QR code scanning process
    setTimeout(() => {
      setQrStep(3);
      setIsScanning(false);
      setTimeout(() => {
        setIsConnected(true);
        setQrStep(4);
      }, 2000);
    }, 3000);
  };

  const handleComplete = () => {
    onComplete({ whatsappConnected: true, whatsappSetupMethod: setupMethod });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Connect WhatsApp Business</h2>
        <p className="text-gray-600">
          WhatsApp is where most of your customers prefer to communicate. Let's get you set up!
        </p>
      </div>

      <div className="space-y-4">
        <div 
          className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
            setupMethod === 'existing' ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-gray-300'
          }`}
          onClick={() => setSetupMethod('existing')}
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900">✅ I already have WhatsApp Business</h3>
              <p className="text-sm text-gray-600">Perfect! We'll help you connect it to our AI.</p>
            </div>
            <div className="text-2xl">📱</div>
          </div>
        </div>

        <div 
          className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
            setupMethod === 'new' ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-gray-300'
          }`}
          onClick={() => setSetupMethod('new')}
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900">📲 I need to set up WhatsApp Business</h3>
              <p className="text-sm text-gray-600">No problem! We'll guide you through the process.</p>
            </div>
            <div className="text-2xl">🆕</div>
          </div>
        </div>

        <div 
          className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
            setupMethod === 'help' ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-gray-300'
          }`}
          onClick={() => setSetupMethod('help')}
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900">🤝 I want help with setup</h3>
              <p className="text-sm text-gray-600">We'll schedule a quick call to set everything up for you.</p>
            </div>
            <div className="text-2xl">📞</div>
          </div>
        </div>
      </div>

      {setupMethod === 'existing' && !showQRCode && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h4 className="font-semibold text-green-800 mb-2">Connect Your Existing WhatsApp Business</h4>
          <div className="space-y-3">
            <p className="text-sm text-green-700">
              1. Make sure WhatsApp Business is installed on your phone<br/>
              2. We'll show you a QR code to scan<br/>
              3. Your AI assistant will be ready in under 2 minutes!
            </p>
            <button
              onClick={handleConnectExisting}
              className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700"
            >
              📱 Start Connection Process
            </button>
          </div>
        </div>
      )}

      {setupMethod === 'existing' && showQRCode && (
        <div className="bg-white border-2 border-green-500 rounded-lg p-6">
          <div className="text-center space-y-4">
            
            {qrStep === 1 && (
              <>
                <h4 className="text-xl font-semibold text-gray-900 mb-4">
                  📱 Scan QR Code with WhatsApp Business
                </h4>
                
                {/* Simulated QR Code */}
                <div className="bg-white border-2 border-gray-300 rounded-lg p-8 max-w-xs mx-auto">
                  <div className="w-48 h-48 bg-gradient-to-br from-gray-900 via-gray-700 to-gray-900 rounded-lg flex items-center justify-center relative">
                    {/* QR Code pattern simulation */}
                    <div className="grid grid-cols-8 gap-1 w-40 h-40">
                      {Array.from({length: 64}).map((_, i) => (
                        <div 
                          key={i} 
                          className={`w-4 h-4 ${Math.random() > 0.5 ? 'bg-white' : 'bg-black'} rounded-sm`}
                        />
                      ))}
                    </div>
                    
                    {/* WhatsApp logo in center */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="bg-green-500 rounded-full p-2">
                        <span className="text-white text-2xl">📱</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-md mx-auto">
                  <h5 className="font-medium text-blue-800 mb-2">📋 Follow these steps:</h5>
                  <ol className="text-sm text-blue-700 space-y-1 text-left">
                    <li>1. Open WhatsApp Business on your phone</li>
                    <li>2. Tap the menu (three dots) in top-right corner</li>
                    <li>3. Select "Linked Devices"</li>
                    <li>4. Tap "Link a Device"</li>
                    <li>5. Point your camera at this QR code</li>
                  </ol>
                </div>

                <button
                  onClick={handleQRScan}
                  className="bg-green-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-green-700"
                >
                  I Scanned the QR Code ✅
                </button>
              </>
            )}

            {qrStep === 2 && (
              <>
                <div className="text-6xl mb-4">{isScanning ? '📱' : '🔄'}</div>
                <h4 className="text-xl font-semibold text-gray-900">
                  {isScanning ? 'Scanning QR Code...' : 'Connecting...'}
                </h4>
                <p className="text-gray-600">
                  {isScanning 
                    ? 'Processing your QR code scan. This may take a moment.' 
                    : 'Please wait while we establish the connection with your WhatsApp Business account.'
                  }
                </p>
                <div className="animate-spin h-8 w-8 border-4 border-green-500 border-t-transparent rounded-full mx-auto"></div>
              </>
            )}

            {qrStep === 3 && (
              <>
                <div className="text-6xl mb-4">⚡</div>
                <h4 className="text-xl font-semibold text-gray-900">Almost there!</h4>
                <p className="text-gray-600">Setting up your AI assistant for {salonData.businessName || 'your salon'}...</p>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 max-w-md mx-auto">
                  <p className="text-sm text-yellow-700">
                    🤖 Teaching your AI about your services and personality...
                  </p>
                </div>
              </>
            )}

            {qrStep === 4 && isConnected && (
              <>
                <div className="text-6xl mb-4">🎉</div>
                <h4 className="text-xl font-semibold text-green-800">WhatsApp Connected!</h4>
                <p className="text-green-600">Your AI assistant is now ready to help customers on WhatsApp.</p>
                
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 max-w-md mx-auto">
                  <h5 className="font-medium text-green-800 mb-2">🚀 What happens next:</h5>
                  <ul className="text-sm text-green-700 space-y-1 text-left">
                    <li>• AI will respond to customer messages 24/7</li>
                    <li>• Booking requests will be handled automatically</li>
                    <li>• You'll get notifications for important messages</li>
                    <li>• Training your AI continues as it learns</li>
                  </ul>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {setupMethod === 'new' && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-semibold text-blue-800 mb-2">Set Up WhatsApp Business</h4>
          <div className="space-y-3">
            <p className="text-sm text-blue-700">
              1. Download WhatsApp Business from App Store or Google Play<br/>
              2. Set up your business profile with salon information<br/>
              3. We'll help you connect it to our AI system
            </p>
            <div className="flex space-x-3">
              <a 
                href="https://apps.apple.com/app/whatsapp-business/id1386412985"
                target="_blank"
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700"
              >
                📱 Download for iPhone
              </a>
              <a 
                href="https://play.google.com/store/apps/details?id=com.whatsapp.w4b"
                target="_blank"
                className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700"
              >
                🤖 Download for Android
              </a>
            </div>
          </div>
        </div>
      )}

      {setupMethod === 'help' && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <h4 className="font-semibold text-purple-800 mb-2">Personal Setup Assistance</h4>
          <div className="space-y-3">
            <p className="text-sm text-purple-700">
              Our team will help you set up everything perfectly:<br/>
              • WhatsApp Business account creation<br/>
              • Business profile optimization<br/>
              • AI integration and testing<br/>
              • Training on how to use your new system
            </p>
            <button
              onClick={() => {/* Schedule call */}}
              className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-purple-700"
            >
              📅 Schedule 15-minute Setup Call
            </button>
          </div>
        </div>
      )}

      {isConnected && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
          <div className="text-4xl mb-2">✅</div>
          <h3 className="font-semibold text-green-800 mb-1">WhatsApp Connected!</h3>
          <p className="text-sm text-green-700">Your AI assistant is ready to help customers on WhatsApp.</p>
        </div>
      )}

      <div className="flex justify-between">
        <div></div>
        <button
          onClick={handleComplete}
          disabled={!isConnected && setupMethod !== 'help'}
          className="bg-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          {isConnected || setupMethod === 'help' ? 'Continue →' : 'Complete Setup First'}
        </button>
      </div>
    </div>
  );
}

function InstagramSetupGuide({ salonData, onComplete }: any) {
  const [setupStep, setSetupStep] = useState<'intro' | 'requirements' | 'connect' | 'success'>('intro');
  const [hasBusinessAccount, setHasBusinessAccount] = useState<boolean | null>(null);
  const [connectionMethod, setConnectionMethod] = useState<'self' | 'help' | null>(null);
  const [showBenefitsDemo, setShowBenefitsDemo] = useState(false);
  
  const isAvailable = salonData.selectedTier !== 'free';
  
  if (!isAvailable) {
    return (
      <div className="text-center py-8">
        <div className="text-6xl mb-4">📸</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Instagram Lead Generation</h2>
        <p className="text-gray-600 mb-6">
          Turn your Instagram followers into paying customers automatically.
        </p>
        <div className="bg-gradient-to-r from-pink-50 to-purple-50 border border-purple-200 rounded-lg p-6 max-w-lg mx-auto">
          <h3 className="font-semibold text-purple-800 mb-3">🚀 What you're missing:</h3>
          <div className="grid md:grid-cols-2 gap-3 text-left">
            <div className="bg-white rounded-lg p-3 border border-purple-100">
              <div className="text-2xl mb-1">💬</div>
              <div className="text-sm">
                <div className="font-medium text-purple-700">Auto-Reply Comments</div>
                <div className="text-gray-600">Never miss a booking inquiry</div>
              </div>
            </div>
            <div className="bg-white rounded-lg p-3 border border-purple-100">
              <div className="text-2xl mb-1">📊</div>
              <div className="text-sm">
                <div className="font-medium text-purple-700">Lead Analytics</div>
                <div className="text-gray-600">Track which posts convert</div>
              </div>
            </div>
            <div className="bg-white rounded-lg p-3 border border-purple-100">
              <div className="text-2xl mb-1">🎯</div>
              <div className="text-sm">
                <div className="font-medium text-purple-700">Smart Targeting</div>
                <div className="text-gray-600">Find ready-to-book clients</div>
              </div>
            </div>
            <div className="bg-white rounded-lg p-3 border border-purple-100">
              <div className="text-2xl mb-1">📈</div>
              <div className="text-sm">
                <div className="font-medium text-purple-700">40% More Bookings</div>
                <div className="text-gray-600">Proven results for salons</div>
              </div>
            </div>
          </div>
          <div className="mt-4 text-center">
            <div className="text-sm text-purple-600 font-medium">💰 ROI: €150-400 extra revenue/month</div>
          </div>
        </div>
        <button
          onClick={() => onComplete({})}
          className="mt-6 text-purple-600 hover:text-purple-700 underline"
        >
          Skip for now →
        </button>
      </div>
    );
  }

  if (setupStep === 'intro') {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <div className="text-6xl mb-4">📸✨</div>
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Instagram Lead Generation</h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Turn your Instagram posts into automatic booking machines. See how it works:
          </p>
        </div>

        <div className="bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 text-white rounded-xl p-8">
          <div className="text-center mb-6">
            <h3 className="text-2xl font-bold mb-2">🎯 Real Salon Success Story</h3>
            <p className="text-pink-100">"We went from 12 to 28 bookings per month just from Instagram!"</p>
            <p className="text-sm text-pink-200 mt-1">- Maria, Bella Vista Salon, Munich</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-4">
            <div className="bg-white/10 rounded-lg p-4 text-center">
              <div className="text-3xl mb-2">💬</div>
              <div className="font-semibold mb-1">Auto-Comments</div>
              <div className="text-sm text-pink-100">AI responds to "Price?" "Available?" comments instantly</div>
            </div>
            <div className="bg-white/10 rounded-lg p-4 text-center">
              <div className="text-3xl mb-2">🔄</div>
              <div className="font-semibold mb-1">DM Conversion</div>
              <div className="text-sm text-pink-100">Moves conversations to WhatsApp for booking</div>
            </div>
            <div className="bg-white/10 rounded-lg p-4 text-center">
              <div className="text-3xl mb-2">📈</div>
              <div className="font-semibold mb-1">Smart Analytics</div>
              <div className="text-sm text-pink-100">Shows which content generates most bookings</div>
            </div>
          </div>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <h4 className="font-bold text-green-800 mb-3 text-center">💰 ROI Calculator for Your Salon</h4>
          <div className="grid md:grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-green-700">+16</div>
              <div className="text-sm text-green-600">Extra bookings/month</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-700">×€25</div>
              <div className="text-sm text-green-600">Average service price</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-700">=€400</div>
              <div className="text-sm text-green-600">Extra monthly revenue</div>
            </div>
          </div>
          <div className="text-center mt-3 text-sm text-green-700">
            <strong>That's €4,800 extra per year from Instagram alone!</strong>
          </div>
        </div>

        <div className="flex justify-center space-x-4">
          <button
            onClick={() => setSetupStep('requirements')}
            className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-8 py-4 rounded-lg font-bold text-lg hover:from-purple-700 hover:to-pink-700 transform hover:scale-105 transition-all"
          >
            🚀 Set Up Instagram Lead Generation
          </button>
          
          <button
            onClick={() => setShowBenefitsDemo(!showBenefitsDemo)}
            className="border border-purple-300 text-purple-600 px-6 py-4 rounded-lg font-semibold hover:bg-purple-50"
          >
            📹 Watch Demo
          </button>
        </div>

        {showBenefitsDemo && (
          <div className="bg-gray-900 rounded-lg p-6 text-white">
            <h4 className="font-bold mb-4 text-center">📹 See Instagram Automation in Action</h4>
            <div className="bg-gray-800 rounded-lg p-4 mb-4">
              <div className="text-sm mb-2 text-gray-300">Instagram Post: "Fresh highlights ✨ #salonlife #haircolor"</div>
              <div className="space-y-2">
                <div className="bg-blue-600 rounded-lg p-2 max-w-xs">
                  <div className="text-xs text-blue-100">@sarah_m23</div>
                  <div>Price for highlights?</div>
                </div>
                <div className="bg-purple-600 rounded-lg p-2 max-w-xs ml-auto">
                  <div className="text-xs text-purple-100">Your AI Assistant</div>
                  <div>Hi Sarah! 💜 Highlights start at €65. I can check availability - sent you a DM!</div>
                </div>
              </div>
            </div>
            <div className="text-center text-sm text-gray-300">
              ⚡ Response time: Under 30 seconds • 🎯 Conversion rate: 65% of inquiries become bookings
            </div>
          </div>
        )}

        <div className="text-center">
          <button
            onClick={() => onComplete({})}
            className="text-gray-500 hover:text-gray-700 underline"
          >
            Skip Instagram setup for now →
          </button>
        </div>
      </div>
    );
  }

  if (setupStep === 'requirements') {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Instagram Business Account Required</h2>
          <p className="text-gray-600">
            To automate Instagram lead generation, you need an Instagram Business account (it's free to convert).
          </p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="font-semibold text-blue-800 mb-4">✅ Quick Check: Do you have this?</h3>
          <div className="space-y-3">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-sm font-bold">1</div>
              <div>
                <div className="font-medium text-blue-800">Instagram Business Account</div>
                <div className="text-sm text-blue-600">Shows "Contact," "Call," or "Email" buttons on your profile</div>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-sm font-bold">2</div>
              <div>
                <div className="font-medium text-blue-800">Facebook Page Connected</div>
                <div className="text-sm text-blue-600">Your Instagram is linked to a Facebook business page</div>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-sm font-bold">3</div>
              <div>
                <div className="font-medium text-blue-800">Admin Access</div>
                <div className="text-sm text-blue-600">You can change settings and connect apps</div>
              </div>
            </div>
          </div>
        </div>

        <div className="text-center">
          <p className="text-gray-700 mb-6 font-medium">Do you already have an Instagram Business account?</p>
          <div className="flex justify-center space-x-4">
            <button
              onClick={() => {
                setHasBusinessAccount(true);
                setSetupStep('connect');
              }}
              className="bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700"
            >
              ✅ Yes, I have Instagram Business
            </button>
            
            <button
              onClick={() => {
                setHasBusinessAccount(false);
                setSetupStep('connect');
              }}
              className="bg-orange-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-orange-700"
            >
              🔄 No, help me convert
            </button>
          </div>
        </div>

        <div className="text-center">
          <button
            onClick={() => setSetupStep('intro')}
            className="text-gray-500 hover:text-gray-700 underline"
          >
            ← Back to overview
          </button>
        </div>
      </div>
    );
  }

  if (setupStep === 'connect') {
    if (!hasBusinessAccount) {
      return (
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Convert to Instagram Business</h2>
            <p className="text-gray-600">
              Don't worry! Converting to a Business account is free and takes 2 minutes.
            </p>
          </div>

          <div className="bg-orange-50 border border-orange-200 rounded-lg p-6">
            <h3 className="font-semibold text-orange-800 mb-4">📱 Step-by-Step Conversion:</h3>
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-orange-100 rounded-full flex items-center justify-center text-orange-600 text-sm font-bold flex-shrink-0 mt-0.5">1</div>
                <div>
                  <div className="font-medium text-orange-800">Open Instagram App</div>
                  <div className="text-sm text-orange-600">Go to your profile → Settings (three lines) → Account</div>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-orange-100 rounded-full flex items-center justify-center text-orange-600 text-sm font-bold flex-shrink-0 mt-0.5">2</div>
                <div>
                  <div className="font-medium text-orange-800">Switch to Professional Account</div>
                  <div className="text-sm text-orange-600">Tap "Switch to Professional Account" → Choose "Business"</div>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-orange-100 rounded-full flex items-center justify-center text-orange-600 text-sm font-bold flex-shrink-0 mt-0.5">3</div>
                <div>
                  <div className="font-medium text-orange-800">Add Business Info</div>
                  <div className="text-sm text-orange-600">Enter your salon details, phone number, and location</div>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-orange-100 rounded-full flex items-center justify-center text-orange-600 text-sm font-bold flex-shrink-0 mt-0.5">4</div>
                <div>
                  <div className="font-medium text-orange-800">Create/Connect Facebook Page</div>
                  <div className="text-sm text-orange-600">Link to existing page or create a new one (required for automation)</div>
                </div>
              </div>
            </div>
          </div>

          <div className="text-center">
            <p className="text-gray-700 mb-6">How would you like to proceed?</p>
            <div className="flex justify-center space-x-4">
              <button
                onClick={() => {
                  setConnectionMethod('self');
                }}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700"
              >
                📱 I'll do it myself (2 min)
              </button>
              
              <button
                onClick={() => {
                  setConnectionMethod('help');
                }}
                className="bg-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-purple-700"
              >
                🤝 Help me over video call (5 min)
              </button>
            </div>
          </div>

          {connectionMethod === 'self' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-semibold text-blue-800 mb-2">✅ After Converting to Business Account:</h4>
              <div className="text-sm text-blue-700 space-y-1">
                <p>1. Come back here and click "I'm Ready to Connect"</p>
                <p>2. We'll guide you through the final connection steps</p>
                <p>3. Your Instagram AI will be live in under 5 minutes!</p>
              </div>
              <button
                onClick={() => setSetupStep('success')}
                className="mt-3 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700"
              >
                ✅ I'm Ready to Connect
              </button>
            </div>
          )}

          {connectionMethod === 'help' && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <h4 className="font-semibold text-purple-800 mb-2">🤝 Personal Setup Assistance</h4>
              <div className="text-sm text-purple-700 space-y-1">
                <p>• Screen share to convert your account together</p>
                <p>• Connect to our automation system</p>
                <p>• Test your first automated response</p>
                <p>• 5-minute setup, done right the first time</p>
              </div>
              <button
                onClick={() => {/* Schedule call logic */}}
                className="mt-3 bg-purple-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-purple-700"
              >
                📅 Schedule 5-Minute Setup Call
              </button>
            </div>
          )}
        </div>
      );
    }

    // Has business account - direct connection flow
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Connect Your Instagram Business</h2>
          <p className="text-gray-600">
            Final step: Connect your Instagram Business account to activate AI automation.
          </p>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <h3 className="font-semibold text-green-800 mb-4">🔗 Secure Instagram Connection</h3>
          <div className="space-y-3">
            <div className="flex items-center space-x-3">
              <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center text-green-600 text-sm">✓</div>
              <span className="text-sm text-green-700">Safe OAuth connection (no password needed)</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center text-green-600 text-sm">✓</div>
              <span className="text-sm text-green-700">Read-only access to comments and DMs</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center text-green-600 text-sm">✓</div>
              <span className="text-sm text-green-700">You can disconnect anytime</span>
            </div>
          </div>
        </div>

        <div className="text-center">
          <button
            onClick={() => setSetupStep('success')}
            className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-8 py-4 rounded-lg font-bold text-lg hover:from-purple-700 hover:to-pink-700 transform hover:scale-105 transition-all"
          >
            🔗 Connect Instagram Business Account
          </button>
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h4 className="font-medium text-gray-800 mb-2">🚀 What happens after connection:</h4>
          <div className="text-sm text-gray-600 space-y-1">
            <p>• AI starts monitoring your posts for booking-related comments</p>
            <p>• Automatic responses guide interested clients to WhatsApp</p>
            <p>• Analytics dashboard shows which posts generate leads</p>
            <p>• First automated response typically within 24 hours</p>
          </div>
        </div>
      </div>
    );
  }

  if (setupStep === 'success') {
    return (
      <div className="text-center py-8">
        <div className="text-6xl mb-4">🎉</div>
        <h2 className="text-3xl font-bold text-gray-900 mb-4">Instagram Connected Successfully!</h2>
        <p className="text-xl text-gray-600 mb-6">
          Your AI assistant is now monitoring your Instagram for potential customers.
        </p>

        <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-6 max-w-2xl mx-auto mb-6">
          <h3 className="font-bold text-green-800 mb-4">🚀 Your Instagram AI is Now Active:</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-white rounded-lg p-3 border border-green-100">
              <div className="text-2xl mb-1">👀</div>
              <div className="text-sm">
                <div className="font-medium text-green-700">Smart Monitoring</div>
                <div className="text-gray-600">Watching for booking-related comments</div>
              </div>
            </div>
            <div className="bg-white rounded-lg p-3 border border-green-100">
              <div className="text-2xl mb-1">⚡</div>
              <div className="text-sm">
                <div className="font-medium text-green-700">Instant Response</div>
                <div className="text-gray-600">Replies within 30 seconds</div>
              </div>
            </div>
            <div className="bg-white rounded-lg p-3 border border-green-100">
              <div className="text-2xl mb-1">🔄</div>
              <div className="text-sm">
                <div className="font-medium text-green-700">Lead Conversion</div>
                <div className="text-gray-600">Moves conversations to WhatsApp</div>
              </div>
            </div>
            <div className="bg-white rounded-lg p-3 border border-green-100">
              <div className="text-2xl mb-1">📊</div>
              <div className="text-sm">
                <div className="font-medium text-green-700">Performance Tracking</div>
                <div className="text-gray-600">See which posts convert best</div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 max-w-lg mx-auto mb-6">
          <h4 className="font-semibold text-purple-800 mb-2">💡 Pro Tips for Maximum Results:</h4>
          <ul className="text-sm text-purple-700 space-y-1 text-left">
            <li>• Post before/after photos to attract comment engagement</li>
            <li>• Use hashtags like #salonlife #hairgoals to increase visibility</li>
            <li>• Post during peak hours (6-8 PM) for maximum reach</li>
            <li>• Your AI will learn your style and improve responses over time</li>
          </ul>
        </div>

        <button
          onClick={() => onComplete({ instagramConnected: true })}
          className="bg-purple-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-purple-700 transform hover:scale-105 transition-all"
        >
          Continue to Final Setup →
        </button>
      </div>
    );
  }

  return null;
}

function BusinessVerificationGuide({ salonData, onComplete }: any) {
  const isEnterprise = salonData.selectedTier === 'enterprise';
  
  if (!isEnterprise) {
    return (
      <div className="text-center py-8">
        <div className="text-6xl mb-4">🏢</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Business Verification</h2>
        <p className="text-gray-600 mb-6">
          Facebook/Meta business verification is included with Enterprise plans.
        </p>
        <button
          onClick={() => onComplete({})}
          className="text-purple-600 hover:text-purple-700 underline"
        >
          Continue to AI Demo →
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Facebook/Meta Business Verification</h2>
        <p className="text-gray-600">
          Unlock premium features and increase your daily conversation limits from 250 to 1,000+.
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="font-semibold text-blue-800 mb-4">✨ Verification Benefits:</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <h4 className="font-medium text-blue-700 mb-2">Increased Limits:</h4>
            <ul className="text-sm text-blue-600 space-y-1">
              <li>• 1,000+ daily conversations (vs 250)</li>
              <li>• Up to 20 phone numbers</li>
              <li>• Green tick verification badge</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-blue-700 mb-2">Premium Features:</h4>
            <ul className="text-sm text-blue-600 space-y-1">
              <li>• Instagram automation</li>
              <li>• Advanced templates</li>
              <li>• Business analytics</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="bg-green-50 border border-green-200 rounded-lg p-6">
        <h3 className="font-semibold text-green-800 mb-3">🤝 White-Glove Verification Service</h3>
        <p className="text-sm text-green-700 mb-4">
          Our team will handle the entire verification process for you:
        </p>
        <ul className="text-sm text-green-600 space-y-1">
          <li>• Document collection and preparation</li>
          <li>• Facebook Business Manager setup</li>
          <li>• Template submission and approval</li>
          <li>• Complete technical integration</li>
        </ul>
        
        <div className="mt-4 text-sm font-medium text-green-800">
          Included with Enterprise plan (€199 value)
        </div>
      </div>

      <div className="flex justify-center space-x-4">
        <button
          onClick={() => onComplete({ wantsBusinessVerification: true })}
          className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700"
        >
          Yes, Set Up Verification
        </button>
        
        <button
          onClick={() => onComplete({ wantsBusinessVerification: false })}
          className="text-gray-500 px-6 py-3 hover:text-gray-700"
        >
          Maybe Later
        </button>
      </div>
    </div>
  );
}

function AIDemo({ salonData, onComplete }: any) {
  const [demoStep, setDemoStep] = useState(0);
  
  const demoSteps = [
    {
      customer: "Hi! Can I book a haircut for tomorrow?",
      ai: `Hello! I'd love to help you book a haircut at ${salonData.businessName || 'your salon'}. What time works best for you tomorrow?`
    },
    {
      customer: "Around 2pm?",
      ai: "Perfect! I have 2:15pm available. Shall I book that for you? I'll just need your name and phone number."
    },
    {
      customer: "Yes please! My name is Sarah and my number is +49 30 555-1234",
      ai: "Excellent! ✅ I've booked your haircut for tomorrow at 2:15pm. You'll receive a confirmation message shortly. See you tomorrow, Sarah!"
    }
  ];

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Meet Your AI Assistant</h2>
        <p className="text-gray-600">
          Watch how your AI will handle customer conversations automatically.
        </p>
      </div>

      <div className="bg-gray-50 rounded-lg p-6 max-w-md mx-auto">
        <div className="space-y-4">
          {demoSteps.slice(0, demoStep + 1).map((step, index) => (
            <div key={index} className="space-y-2">
              <div className="bg-blue-500 text-white p-3 rounded-lg rounded-br-none ml-8">
                {step.customer}
              </div>
              <div className="bg-white border p-3 rounded-lg rounded-bl-none mr-8">
                {step.ai}
              </div>
            </div>
          ))}
        </div>
        
        {demoStep < demoSteps.length - 1 && (
          <div className="text-center mt-4">
            <button
              onClick={() => setDemoStep(demoStep + 1)}
              className="text-purple-600 hover:text-purple-700 text-sm"
            >
              Continue demo →
            </button>
          </div>
        )}
      </div>

      {demoStep === demoSteps.length - 1 && (
        <div className="text-center">
          <div className="bg-green-50 border border-green-200 rounded-lg p-6 max-w-md mx-auto mb-6">
            <h3 className="font-semibold text-green-800 mb-2">🎉 That's it!</h3>
            <p className="text-sm text-green-700">
              Your AI assistant will handle conversations like this 24/7, even when you're busy with clients.
            </p>
          </div>
          
          <button
            onClick={() => onComplete({})}
            className="bg-purple-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-purple-700"
          >
            Complete Setup →
          </button>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// TIER COMPARISON MODAL
// =============================================================================

function TierComparisonModal({ currentTier: _currentTier, onSelectTier: _onSelectTier, onClose }: any) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">Compare Plans</h2>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">×</button>
          </div>
        </div>
        
        <div className="p-6">
          {/* Tier comparison table would go here */}
          <div className="text-center py-8">
            <p className="text-gray-600 mb-4">Detailed comparison table coming soon...</p>
            <button
              onClick={onClose}
              className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default FreemiumOnboarding;