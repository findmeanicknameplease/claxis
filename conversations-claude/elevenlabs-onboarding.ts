// =============================================================================
// ELEVENLABS VOICE AI EASY ONBOARDING
// Simple setup for premium voice features
// =============================================================================

export function ElevenLabsOnboarding({ salonData, onComplete }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [voicePreferences, setVoicePreferences] = useState({
    selectedVoice: '',
    customVoiceNeeded: false,
    voiceLanguages: ['English'],
    testCallCompleted: false
  });

  const onboardingSteps = [
    {
      id: 'voice_selection',
      title: 'Choose your salon\'s voice',
      description: 'Pick the voice that represents your brand best'
    },
    {
      id: 'language_setup', 
      title: 'Select languages',
      description: 'Which languages do your customers speak?'
    },
    {
      id: 'test_call',
      title: 'Test your voice AI',
      description: 'Make a test call to hear how it sounds'
    },
    {
      id: 'call_scenarios',
      title: 'Configure call types',
      description: 'When should your AI make voice calls?'
    }
  ];

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold flex items-center mb-2">
          🎤 Voice AI Setup
          <span className="ml-2 bg-purple-100 text-purple-600 text-xs px-2 py-1 rounded">
            PREMIUM
          </span>
        </h1>
        <p className="text-gray-600">
          Add voice calling to create the ultimate premium experience for your VIP customers
        </p>
      </div>

      {currentStep === 0 && (
        <VoiceSelectionStep 
          onNext={(voice) => {
            setVoicePreferences({...voicePreferences, selectedVoice: voice});
            setCurrentStep(1);
          }}
        />
      )}

      {currentStep === 1 && (
        <LanguageSetupStep
          onNext={(languages) => {
            setVoicePreferences({...voicePreferences, voiceLanguages: languages});
            setCurrentStep(2);
          }}
        />
      )}

      {currentStep === 2 && (
        <TestCallStep
          voiceId={voicePreferences.selectedVoice}
          salonData={salonData}
          onNext={() => {
            setVoicePreferences({...voicePreferences, testCallCompleted: true});
            setCurrentStep(3);
          }}
        />
      )}

      {currentStep === 3 && (
        <CallScenariosStep
          onComplete={(scenarios) => {
            onComplete({
              ...voicePreferences,
              callScenarios: scenarios
            });
          }}
        />
      )}
    </div>
  );
}

function VoiceSelectionStep({ onNext }) {
  const [selectedVoice, setSelectedVoice] = useState('');
  const [isPlaying, setIsPlaying] = useState('');

  const availableVoices = [
    {
      id: 'bella_professional',
      name: 'Bella - Professional Female',
      description: 'Warm, professional tone perfect for upscale salons',
      language: 'English',
      accent: 'Neutral',
      sample: 'Hello! Thank you for calling Bella Hair Studio. I\'d love to help you book your appointment today.'
    },
    {
      id: 'sophia_friendly',
      name: 'Sophia - Friendly Female', 
      description: 'Friendly, approachable voice ideal for family salons',
      language: 'English',
      accent: 'Slightly British',
      sample: 'Hi there! This is a friendly reminder about your hair appointment tomorrow at 2 PM. Looking forward to seeing you!'
    },
    {
      id: 'anna_luxury',
      name: 'Anna - Luxury Female',
      description: 'Sophisticated, elegant tone for premium salons',
      language: 'English', 
      accent: 'Refined',
      sample: 'Good afternoon. This is Anna from your salon. I\'m calling to confirm your luxury treatment appointment.'
    },
    {
      id: 'maria_multilingual',
      name: 'Maria - Multilingual',
      description: 'Perfect German-English speaker for European salons',
      language: 'German/English',
      accent: 'European',
      sample: 'Hallo! This is Maria from your hair salon. Ich möchte your appointment bestätigen.'
    }
  ];

  const playVoiceSample = async (voiceId, sampleText) => {
    setIsPlaying(voiceId);
    
    try {
      // Generate voice sample using ElevenLabs
      const audioBlob = await generateVoiceSample(voiceId, sampleText);
      const audio = new Audio(URL.createObjectURL(audioBlob));
      
      audio.onended = () => setIsPlaying('');
      audio.play();
    } catch (error) {
      console.error('Error playing voice sample:', error);
      setIsPlaying('');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-4">Choose Your Salon's Voice</h2>
        <p className="text-gray-600 mb-6">
          This voice will represent your salon when making confirmation calls and VIP follow-ups.
          You can always change it later.
        </p>
      </div>

      <div className="grid gap-4">
        {availableVoices.map((voice) => (
          <div
            key={voice.id}
            className={`p-4 border rounded-lg cursor-pointer transition-all ${
              selectedVoice === voice.id 
                ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-200' 
                : 'border-gray-200 hover:border-gray-300'
            }`}
            onClick={() => setSelectedVoice(voice.id)}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center mb-2">
                  <h3 className="font-medium text-lg">{voice.name}</h3>
                  <span className="ml-2 text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                    {voice.language}
                  </span>
                </div>
                <p className="text-gray-600 text-sm mb-3">{voice.description}</p>
                
                <div className="bg-gray-50 p-3 rounded text-sm italic text-gray-700 mb-3">
                  "{voice.sample}"
                </div>
                
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    playVoiceSample(voice.id, voice.sample);
                  }}
                  disabled={isPlaying === voice.id}
                  className="flex items-center text-sm text-purple-600 hover:text-purple-700"
                >
                  {isPlaying === voice.id ? (
                    <>🔊 Playing...</>
                  ) : (
                    <>▶️ Play Sample</>
                  )}
                </button>
              </div>
              
              {selectedVoice === voice.id && (
                <div className="text-purple-600 text-xl">✓</div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-blue-50 p-4 rounded-lg">
        <h4 className="font-medium text-blue-800 mb-2">Want a custom voice?</h4>
        <p className="text-blue-700 text-sm mb-3">
          We can create a custom voice that sounds exactly like you or your preferred style. 
          This is included in the Enterprise plan.
        </p>
        <button className="text-blue-600 text-sm underline hover:text-blue-700">
          Learn about custom voice cloning →
        </button>
      </div>

      <button
        onClick={() => onNext(selectedVoice)}
        disabled={!selectedVoice}
        className="w-full bg-purple-600 text-white py-3 rounded-lg disabled:bg-gray-300 hover:bg-purple-700"
      >
        Continue with {availableVoices.find(v => v.id === selectedVoice)?.name || 'Selected Voice'}
      </button>
    </div>
  );
}

function LanguageSetupStep({ onNext }) {
  const [selectedLanguages, setSelectedLanguages] = useState(['English']);

  const availableLanguages = [
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'de', name: 'German', flag: '🇩🇪' },
    { code: 'fr', name: 'French', flag: '🇫🇷' },
    { code: 'es', name: 'Spanish', flag: '🇪🇸' },
    { code: 'it', name: 'Italian', flag: '🇮🇹' },
    { code: 'nl', name: 'Dutch', flag: '🇳🇱' },
    { code: 'pt', name: 'Portuguese', flag: '🇵🇹' },
    { code: 'pl', name: 'Polish', flag: '🇵🇱' }
  ];

  const toggleLanguage = (languageName) => {
    if (selectedLanguages.includes(languageName)) {
      if (selectedLanguages.length > 1) {
        setSelectedLanguages(selectedLanguages.filter(l => l !== languageName));
      }
    } else {
      setSelectedLanguages([...selectedLanguages, languageName]);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-4">Language Support</h2>
        <p className="text-gray-600 mb-6">
          Select the languages your customers speak. Your AI will automatically detect 
          the customer's language and respond accordingly.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {availableLanguages.map((language) => (
          <button
            key={language.code}
            onClick={() => toggleLanguage(language.name)}
            className={`flex items-center p-3 border rounded-lg text-left transition-all ${
              selectedLanguages.includes(language.name)
                ? 'border-purple-500 bg-purple-50 text-purple-700'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <span className="text-2xl mr-3">{language.flag}</span>
            <span className="font-medium">{language.name}</span>
            {selectedLanguages.includes(language.name) && (
              <span className="ml-auto text-purple-600">✓</span>
            )}
          </button>
        ))}
      </div>

      <div className="bg-green-50 p-4 rounded-lg">
        <h4 className="font-medium text-green-800 mb-2">💡 Pro Tip</h4>
        <p className="text-green-700 text-sm">
          European customers appreciate when businesses speak their language. 
          Adding German and French can increase your booking rates by 30%!
        </p>
      </div>

      <button
        onClick={() => onNext(selectedLanguages)}
        className="w-full bg-purple-600 text-white py-3 rounded-lg hover:bg-purple-700"
      >
        Continue with {selectedLanguages.length} language{selectedLanguages.length > 1 ? 's' : ''}
      </button>
    </div>
  );
}

function TestCallStep({ voiceId, salonData, onNext }) {
  const [testPhone, setTestPhone] = useState('');
  const [callInProgress, setCallInProgress] = useState(false);
  const [callCompleted, setCallCompleted] = useState(false);
  const [callRating, setCallRating] = useState(0);

  const makeTestCall = async () => {
    setCallInProgress(true);
    
    try {
      // Generate test call script
      const testScript = `Hello! This is a test call from ${salonData.businessName}. 
      I'm calling to confirm your haircut appointment for tomorrow at 2 PM. 
      If you can attend this appointment, please press 1.
      If you need to reschedule, please press 2.
      Thank you!`;

      // Make test call via ElevenLabs + Twilio
      const callResult = await makeVoiceCall({
        to: testPhone,
        voiceId: voiceId,
        script: testScript,
        isTest: true
      });

      // Simulate call completion
      setTimeout(() => {
        setCallInProgress(false);
        setCallCompleted(true);
      }, 3000);

    } catch (error) {
      console.error('Test call failed:', error);
      setCallInProgress(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-4">Test Your Voice AI</h2>
        <p className="text-gray-600 mb-6">
          Let's make a quick test call so you can hear exactly how your AI will sound 
          when calling customers. Don't worry - this is just a test!
        </p>
      </div>

      {!callCompleted ? (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Phone number for test call
            </label>
            <input
              type="tel"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              placeholder="+49 30 12345678"
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-purple-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              We'll call this number to test the voice. Call charges may apply.
            </p>
          </div>

          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="font-medium text-blue-800 mb-2">Test Call Preview</h4>
            <p className="text-blue-700 text-sm italic">
              "Hello! This is a test call from {salonData.businessName}. 
              I'm calling to confirm your haircut appointment for tomorrow at 2 PM..."
            </p>
          </div>

          <button
            onClick={makeTestCall}
            disabled={!testPhone || callInProgress}
            className="w-full bg-purple-600 text-white py-3 rounded-lg disabled:bg-gray-300 hover:bg-purple-700"
          >
            {callInProgress ? '📞 Calling...' : '📞 Make Test Call'}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="text-center py-6">
            <div className="text-6xl mb-4">✅</div>
            <h3 className="text-lg font-semibold text-green-600">Test Call Completed!</h3>
            <p className="text-gray-600">How did your AI voice sound?</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-3">Rate the call quality:</label>
            <div className="flex justify-center space-x-2">
              {[1, 2, 3, 4, 5].map((rating) => (
                <button
                  key={rating}
                  onClick={() => setCallRating(rating)}
                  className={`text-3xl ${
                    rating <= callRating ? 'text-yellow-400' : 'text-gray-300'
                  }`}
                >
                  ⭐
                </button>
              ))}
            </div>
            <p className="text-center text-sm text-gray-500 mt-2">
              {callRating === 0 && 'Click to rate'}
              {callRating === 1 && 'Poor - needs improvement'}
              {callRating === 2 && 'Fair - could be better'}
              {callRating === 3 && 'Good - acceptable quality'}
              {callRating === 4 && 'Great - very satisfied'}
              {callRating === 5 && 'Excellent - perfect quality'}
            </p>
          </div>

          {callRating > 0 && callRating < 4 && (
            <div className="bg-yellow-50 p-4 rounded-lg">
              <p className="text-yellow-700 text-sm">
                Would you like to try a different voice or adjust the settings?
              </p>
              <button className="text-yellow-600 text-sm underline mt-2">
                Go back to voice selection
              </button>
            </div>
          )}

          <button
            onClick={onNext}
            disabled={callRating === 0}
            className="w-full bg-purple-600 text-white py-3 rounded-lg disabled:bg-gray-300 hover:bg-purple-700"
          >
            Continue Setup
          </button>
        </div>
      )}
    </div>
  );
}

function CallScenariosStep({ onComplete }) {
  const [selectedScenarios, setSelectedScenarios] = useState([]);

  const callScenarios = [
    {
      id: 'high_value_confirmation',
      title: 'High-Value Appointment Confirmations',
      description: 'Call to confirm appointments worth €100+ or VIP customers',
      recommended: true,
      cost: '~€2.50 per call',
      roi: 'Prevents €100+ no-shows'
    },
    {
      id: 'vip_post_service',
      title: 'VIP Post-Service Follow-up',
      description: 'Call VIP customers after their appointment for feedback',
      recommended: true,
      cost: '~€3.00 per call',
      roi: '40% higher rebooking rate'
    },
    {
      id: 'emergency_rescheduling',
      title: 'Emergency Rescheduling',
      description: 'Call customers when you need to cancel/reschedule urgently',
      recommended: true,
      cost: '~€2.00 per call',
      roi: 'Saves customer relationships'
    },
    {
      id: 'no_show_follow_up',
      title: 'No-Show Follow-up',
      description: 'Call customers who missed their appointment to reschedule',
      recommended: false,
      cost: '~€2.50 per call',
      roi: '25% recover lost appointments'
    },
    {
      id: 'birthday_calls',
      title: 'Birthday VIP Calls',
      description: 'Personal birthday calls to your top customers',
      recommended: false,
      cost: '~€3.50 per call',
      roi: '80% book within 30 days'
    },
    {
      id: 'win_back_calls',
      title: 'Win-Back Campaigns',
      description: 'Call customers who haven\'t booked in 3+ months',
      recommended: false,
      cost: '~€3.00 per call',
      roi: '35% conversion rate'
    }
  ];

  const toggleScenario = (scenarioId) => {
    if (selectedScenarios.includes(scenarioId)) {
      setSelectedScenarios(selectedScenarios.filter(id => id !== scenarioId));
    } else {
      setSelectedScenarios([...selectedScenarios, scenarioId]);
    }
  };

  // Auto-select recommended scenarios
  useEffect(() => {
    const recommended = callScenarios.filter(s => s.recommended).map(s => s.id);
    setSelectedScenarios(recommended);
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-4">Configure Voice Call Scenarios</h2>
        <p className="text-gray-600 mb-6">
          Choose when your AI should make voice calls. We recommend starting with 
          the essential scenarios and adding more as you see the value.
        </p>
      </div>

      <div className="space-y-3">
        {callScenarios.map((scenario) => (
          <div
            key={scenario.id}
            className={`p-4 border rounded-lg cursor-pointer transition-all ${
              selectedScenarios.includes(scenario.id)
                ? 'border-purple-500 bg-purple-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
            onClick={() => toggleScenario(scenario.id)}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center mb-2">
                  <h3 className="font-medium">{scenario.title}</h3>
                  {scenario.recommended && (
                    <span className="ml-2 bg-green-100 text-green-600 text-xs px-2 py-1 rounded">
                      Recommended
                    </span>
                  )}
                </div>
                <p className="text-gray-600 text-sm mb-2">{scenario.description}</p>
                
                <div className="flex items-center text-xs text-gray-500 space-x-4">
                  <span>💰 {scenario.cost}</span>
                  <span>📈 {scenario.roi}</span>
                </div>
              </div>
              
              <div className="ml-4">
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                  selectedScenarios.includes(scenario.id)
                    ? 'bg-purple-600 border-purple-600 text-white'
                    : 'border-gray-300'
                }`}>
                  {selectedScenarios.includes(scenario.id) && '✓'}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-green-50 p-4 rounded-lg">
        <h4 className="font-medium text-green-800 mb-2">Estimated Monthly Impact</h4>
        <div className="text-green-700 text-sm space-y-1">
          <p>• Voice calls have 85% answer rate vs 20% WhatsApp read rate</p>
          <p>• High-value confirmations prevent 80% of potential no-shows</p>
          <p>• VIP follow-ups increase rebooking by 40%</p>
          <p>• Expected ROI: 300-500% within first month</p>
        </div>
      </div>

      <button
        onClick={() => onComplete(selectedScenarios)}
        className="w-full bg-purple-600 text-white py-3 rounded-lg hover:bg-purple-700"
      >
        Complete Voice AI Setup ({selectedScenarios.length} scenarios selected)
      </button>
    </div>
  );
}

// Helper functions
async function generateVoiceSample(voiceId: string, text: string): Promise<Blob> {
  // Implementation would call ElevenLabs API
  // For demo, return empty blob
  return new Blob([''], { type: 'audio/mpeg' });
}

async function makeVoiceCall(callData: any): Promise<any> {
  // Implementation would integrate with Twilio + ElevenLabs
  return { success: true, callId: 'test-call-123' };
}

export { ElevenLabsOnboarding };