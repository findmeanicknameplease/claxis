// =============================================================================
// SIMPLE YET SMART ONBOARDING FLOW
// Perfect for non-tech savvy salon owners
// =============================================================================

// Onboarding Component for Cursor + Claude Code Implementation
export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  action: 'input' | 'whatsapp_connect' | 'calendar_connect' | 'ai_demo';
  estimatedTime: string;
  required: boolean;
}

// Step-by-Step Onboarding Configuration
export const onboardingSteps: OnboardingStep[] = [
  {
    id: 'business_basics',
    title: 'Tell us about your salon',
    description: 'Just your name, location, and what services you offer',
    action: 'input',
    estimatedTime: '1 minute',
    required: true
  },
  {
    id: 'whatsapp_connect',
    title: 'Connect your WhatsApp Business',
    description: 'We\'ll help you set this up - no technical knowledge needed!',
    action: 'whatsapp_connect',
    estimatedTime: '2 minutes',
    required: true
  },
  {
    id: 'calendar_connect',
    title: 'Connect your calendar',
    description: 'Link Google Calendar so customers can see your real availability',
    action: 'calendar_connect',
    estimatedTime: '1 minute',
    required: false
  },
  {
    id: 'ai_demo',
    title: 'See your AI assistant in action',
    description: 'Watch how it handles a booking - you can modify the responses anytime',
    action: 'ai_demo',
    estimatedTime: '1 minute',
    required: false
  }
];

// Smart Onboarding React Component
export function SmartOnboarding() {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [salonData, setSalonData] = useState<Partial<SalonOnboardingData>>({});

  // WhatsApp Connection Helper (No Business Verification Required)
  const handleWhatsAppConnect = async () => {
    // Start with WhatsApp Business App (no API initially)
    // This avoids the business verification requirement
    const whatsappSetup = {
      step1: "Download WhatsApp Business app",
      step2: "Use existing phone number or get new one",
      step3: "Connect via QR code scan",
      step4: "Upgrade to API when ready for scale"
    };
    
    // Guide them through non-API setup first
    await initiateWhatsAppBusinessSetup(salonData.phoneNumber);
  };

  // Calendar Connection (OAuth simplified)
  const handleCalendarConnect = async () => {
    try {
      // Use Google Calendar's simplified OAuth flow
      const authUrl = generateGoogleCalendarAuthUrl({
        clientId: process.env['NEXT_PUBLIC_GOOGLE_CLIENT_ID'],
        redirectUri: `${window.location.origin}/onboarding/calendar-callback`,
        scope: 'https://www.googleapis.com/auth/calendar.readonly'
      });
      
      // Open in popup to avoid navigation
      window.open(authUrl, 'calendar-auth', 'width=500,height=600');
    } catch (error) {
      // Fallback: Manual calendar sharing instructions
      showManualCalendarInstructions();
    }
  };

  // AI Demo without technical complexity
  const showAIDemo = () => {
    const demoConversation = [
      {
        sender: 'customer',
        message: 'Hi! Can I book a haircut for tomorrow?',
        timestamp: new Date()
      },
      {
        sender: 'ai',
        message: `Hi! I'd love to help you book a haircut at ${salonData.businessName}. What time works best for you tomorrow?`,
        timestamp: new Date(Date.now() + 2000)
      },
      {
        sender: 'customer', 
        message: 'Around 2pm?',
        timestamp: new Date(Date.now() + 5000)
      },
      {
        sender: 'ai',
        message: 'Perfect! I have 2:15pm available. Shall I book that for you?',
        timestamp: new Date(Date.now() + 7000)
      }
    ];
    
    // Animate the conversation to show AI in action
    animateConversationDemo(demoConversation);
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      {/* Progress Indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">Set up your AI assistant</h1>
          <span className="text-sm text-gray-500">
            {currentStep + 1} of {onboardingSteps.length}
          </span>
        </div>
        
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-purple-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${((currentStep + 1) / onboardingSteps.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Current Step */}
      <OnboardingStepComponent
        step={onboardingSteps[currentStep]}
        salonData={salonData}
        onDataUpdate={setSalonData}
        onComplete={() => {
          setCompletedSteps(prev => new Set([...prev, onboardingSteps[currentStep].id]));
          if (currentStep < onboardingSteps.length - 1) {
            setCurrentStep(currentStep + 1);
          }
        }}
        onWhatsAppConnect={handleWhatsAppConnect}
        onCalendarConnect={handleCalendarConnect}
        onAIDemo={showAIDemo}
      />

      {/* Success State */}
      {completedSteps.size === onboardingSteps.filter(s => s.required).length && (
        <div className="mt-8 p-6 bg-green-50 rounded-lg border border-green-200">
          <h3 className="text-lg font-semibold text-green-800 mb-2">
            🎉 Your AI assistant is ready!
          </h3>
          <p className="text-green-700 mb-4">
            You're all set! Your WhatsApp AI will now handle bookings automatically. 
            You can always modify responses or take over conversations anytime.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => window.location.href = '/dashboard'}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
            >
              Go to Dashboard
            </button>
            <button
              onClick={() => sendTestMessage()}
              className="bg-white text-green-600 border border-green-600 px-4 py-2 rounded-lg hover:bg-green-50"
            >
              Send Test Message
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Business Basics Input Form
function BusinessBasicsForm({ onComplete, onDataUpdate }) {
  const [formData, setFormData] = useState({
    businessName: '',
    location: '',
    services: [],
    phoneNumber: '',
    workingHours: ''
  });

  const commonServices = [
    'Haircut', 'Hair Color', 'Highlights', 'Blowout', 'Hair Treatment',
    'Manicure', 'Pedicure', 'Gel Polish', 'Eyebrow Threading', 'Waxing',
    'Facial', 'Massage', 'Makeup', 'Hair Extensions'
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-4">Tell us about your salon</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Salon Name</label>
            <input
              type="text"
              value={formData.businessName}
              onChange={(e) => setFormData({...formData, businessName: e.target.value})}
              placeholder="e.g., Bella Hair Studio"
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Location/City</label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({...formData, location: e.target.value})}
              placeholder="e.g., Berlin, Germany"
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">WhatsApp Business Number</label>
            <input
              type="tel"
              value={formData.phoneNumber}
              onChange={(e) => setFormData({...formData, phoneNumber: e.target.value})}
              placeholder="+49 30 12345678"
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-purple-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              We'll help you set up WhatsApp Business if you don't have it yet
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Services you offer</label>
            <div className="grid grid-cols-2 gap-2">
              {commonServices.map(service => (
                <label key={service} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.services.includes(service)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFormData({...formData, services: [...formData.services, service]});
                      } else {
                        setFormData({...formData, services: formData.services.filter(s => s !== service)});
                      }
                    }}
                    className="mr-2"
                  />
                  <span className="text-sm">{service}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <button
          onClick={() => {
            onDataUpdate(formData);
            onComplete();
          }}
          disabled={!formData.businessName || !formData.phoneNumber}
          className="w-full mt-6 bg-purple-600 text-white py-3 rounded-lg disabled:bg-gray-300 hover:bg-purple-700"
        >
          Continue
        </button>
      </div>
    </div>
  );
}

// WhatsApp Setup Helper (Without Business Verification)
function WhatsAppSetupGuide({ phoneNumber, onComplete }) {
  const [setupStep, setSetupStep] = useState(0);
  
  const setupSteps = [
    {
      title: "Download WhatsApp Business",
      description: "Get the WhatsApp Business app on your phone",
      action: "download",
      icon: "📱"
    },
    {
      title: "Set up your business profile", 
      description: "Add your salon name, hours, and services",
      action: "profile",
      icon: "✏️"
    },
    {
      title: "Connect to Gemini AI",
      description: "We'll link your WhatsApp to our AI assistant",
      action: "connect",
      icon: "🤖"
    }
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Connect WhatsApp Business</h2>
      
      <div className="space-y-4">
        {setupSteps.map((step, index) => (
          <div 
            key={index}
            className={`p-4 border rounded-lg ${
              index === setupStep ? 'border-purple-500 bg-purple-50' : 
              index < setupStep ? 'border-green-500 bg-green-50' : 'border-gray-200'
            }`}
          >
            <div className="flex items-center">
              <span className="text-2xl mr-3">{step.icon}</span>
              <div className="flex-1">
                <h3 className="font-medium">{step.title}</h3>
                <p className="text-sm text-gray-600">{step.description}</p>
              </div>
              {index < setupStep && <span className="text-green-500 text-xl">✅</span>}
            </div>
            
            {index === setupStep && (
              <div className="mt-3">
                {step.action === 'download' && (
                  <div className="space-y-2">
                    <a 
                      href="https://play.google.com/store/apps/details?id=com.whatsapp.w4b"
                      target="_blank"
                      className="inline-block bg-green-600 text-white px-4 py-2 rounded-lg text-sm"
                    >
                      Download for Android
                    </a>
                    <a 
                      href="https://apps.apple.com/app/whatsapp-business/id1386412985"
                      target="_blank"
                      className="inline-block bg-blue-600 text-white px-4 py-2 rounded-lg text-sm ml-2"
                    >
                      Download for iPhone
                    </a>
                    <button
                      onClick={() => setSetupStep(setupStep + 1)}
                      className="block w-full mt-3 bg-purple-600 text-white py-2 rounded-lg"
                    >
                      I've downloaded it
                    </button>
                  </div>
                )}
                
                {step.action === 'profile' && (
                  <div className="space-y-2">
                    <p className="text-sm">Open WhatsApp Business and:</p>
                    <ul className="text-sm text-gray-600 ml-4 space-y-1">
                      <li>• Tap "Settings" → "Business settings"</li>
                      <li>• Add your salon name: "{formData.businessName}"</li>
                      <li>• Set your hours and location</li>
                      <li>• Add a description with your services</li>
                    </ul>
                    <button
                      onClick={() => setSetupStep(setupStep + 1)}
                      className="w-full mt-3 bg-purple-600 text-white py-2 rounded-lg"
                    >
                      Profile is set up
                    </button>
                  </div>
                )}
                
                {step.action === 'connect' && (
                  <WhatsAppQRConnection onComplete={onComplete} />
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// QR Code Connection (Simplified)
function WhatsAppQRConnection({ onComplete }) {
  const [qrCode, setQrCode] = useState('');
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // Generate connection QR code
    generateWhatsAppConnectionQR().then(setQrCode);
    
    // Poll for connection status
    const pollConnection = setInterval(() => {
      checkWhatsAppConnection().then(isConnected => {
        if (isConnected) {
          setConnected(true);
          clearInterval(pollConnection);
          setTimeout(onComplete, 2000);
        }
      });
    }, 2000);

    return () => clearInterval(pollConnection);
  }, []);

  if (connected) {
    return (
      <div className="text-center py-6">
        <div className="text-6xl mb-4">✅</div>
        <h3 className="text-lg font-semibold text-green-600">Connected!</h3>
        <p className="text-gray-600">Your WhatsApp is now connected to Gemini AI</p>
      </div>
    );
  }

  return (
    <div className="text-center space-y-4">
      <p className="text-sm">Scan this QR code with WhatsApp Business:</p>
      
      <div className="bg-white p-4 border rounded-lg inline-block">
        {qrCode ? (
          <img src={qrCode} alt="WhatsApp QR Code" className="w-48 h-48" />
        ) : (
          <div className="w-48 h-48 bg-gray-100 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          </div>
        )}
      </div>
      
      <div className="text-xs text-gray-500 space-y-1">
        <p>1. Open WhatsApp Business on your phone</p>
        <p>2. Tap Menu (3 dots) → "Linked devices"</p>
        <p>3. Tap "Link a device" and scan this code</p>
      </div>
    </div>
  );
}

// Helper functions for implementation
async function generateWhatsAppConnectionQR(): Promise<string> {
  // Implementation would generate QR for WhatsApp Web API connection
  // For now, return placeholder
  return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCI+PHJlY3Qgd2lkdGg9IjIwMCIgaGVpZ2h0PSIyMDAiIGZpbGw9IiNmMGYwZjAiLz48L3N2Zz4=';
}

async function checkWhatsAppConnection(): Promise<boolean> {
  // Implementation would check connection status
  // For demo, simulate connection after 10 seconds
  return new Promise(resolve => {
    setTimeout(() => resolve(Math.random() > 0.8), 100);
  });
}

export { SmartOnboarding, BusinessBasicsForm, WhatsAppSetupGuide };