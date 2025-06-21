'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FreemiumOnboarding } from '@/components/freemium-onboarding';
import { Card } from '@/components/ui/card';
import { CheckCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

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
  whatsappConnected?: boolean;
  instagramConnected?: boolean;
}

export default function OnboardingPage() {
  const router = useRouter();
  const [showSuccess, setShowSuccess] = useState(false);
  const [completedData, setCompletedData] = useState<SalonData | null>(null);

  const handleOnboardingComplete = async (data: SalonData) => {
    console.log('Onboarding completed with data:', data);
    
    try {
      // TODO: Send data to backend API to create salon account
      // const response = await fetch('/api/salons', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(data)
      // });
      
      setCompletedData(data);
      setShowSuccess(true);
      
      // Auto-redirect to payment/activation after showing success
      setTimeout(() => {
        if (data.selectedTier === 'free') {
          router.push('/dashboard');
        } else {
          router.push(`/payment?tier=${data.selectedTier}`);
        }
      }, 3000);
      
    } catch (error) {
      console.error('Error creating salon account:', error);
      // TODO: Show error message to user
    }
  };

  const handleTierChange = (tier: 'free' | 'professional' | 'enterprise') => {
    console.log('Tier changed to:', tier);
    // Track tier selection for analytics
  };

  if (showSuccess && completedData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50 flex items-center justify-center p-4">
        <Card className="max-w-2xl w-full p-8 text-center">
          <div className="space-y-6">
            <div className="text-6xl mb-4">🎉</div>
            
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Welcome to Claxis AI, {completedData.ownerName}!
              </h1>
              <p className="text-lg text-gray-600">
                {completedData.businessName} is now powered by AI automation
              </p>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-green-800 mb-4">
                ✅ Your Setup is Complete!
              </h2>
              
              <div className="grid md:grid-cols-2 gap-4 text-left">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-green-700">
                    <CheckCircle className="h-4 w-4" />
                    <span>AI assistant configured for {completedData.languages.join(', ')}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-green-700">
                    <CheckCircle className="h-4 w-4" />
                    <span>{completedData.services.length} services added</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-green-700">
                    <CheckCircle className="h-4 w-4" />
                    <span>{completedData.selectedTier.charAt(0).toUpperCase() + completedData.selectedTier.slice(1)} plan selected</span>
                  </div>
                </div>
                
                <div className="space-y-2">
                  {completedData.whatsappConnected && (
                    <div className="flex items-center gap-2 text-sm text-green-700">
                      <CheckCircle className="h-4 w-4" />
                      <span>WhatsApp connected</span>
                    </div>
                  )}
                  {completedData.instagramConnected && (
                    <div className="flex items-center gap-2 text-sm text-green-700">
                      <CheckCircle className="h-4 w-4" />
                      <span>Instagram connected</span>
                    </div>
                  )}
                  {completedData.selectedTier === 'enterprise' && completedData.wantsBusinessVerification && (
                    <div className="flex items-center gap-2 text-sm text-green-700">
                      <CheckCircle className="h-4 w-4" />
                      <span>Business verification requested</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {completedData.selectedTier === 'free' ? (
                <div>
                  <p className="text-sm text-gray-600 mb-4">
                    You're starting with our Free plan (100 conversations/month). 
                    Redirecting to your dashboard...
                  </p>
                  <div className="animate-spin h-6 w-6 border-2 border-purple-500 border-t-transparent rounded-full mx-auto"></div>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-gray-600 mb-4">
                    Ready to unlock the full power of {completedData.selectedTier} features? 
                    Redirecting to secure payment...
                  </p>
                  <div className="animate-spin h-6 w-6 border-2 border-purple-500 border-t-transparent rounded-full mx-auto"></div>
                </div>
              )}
              
              <p className="text-xs text-gray-500">
                💡 Your AI assistant is already learning about {completedData.businessName} and will be ready to help customers immediately!
              </p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50">
      {/* Header with back button */}
      <header className="bg-white/80 backdrop-blur-sm border-b sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/" className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors">
            <ArrowLeft className="h-4 w-4" />
            <span>Back to home</span>
          </Link>
          
          <div className="flex items-center space-x-2">
            <div className="text-xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              Claxis AI
            </div>
            <span className="text-sm text-gray-500">Setup</span>
          </div>
          
          <div className="w-20"></div> {/* Spacer for center alignment */}
        </div>
      </header>

      {/* Onboarding Content */}
      <div className="container mx-auto px-4 py-8">
        <FreemiumOnboarding
          onComplete={handleOnboardingComplete}
          onTierChange={handleTierChange}
          className="max-w-none"
        />
      </div>

      {/* Trust Footer */}
      <footer className="bg-white/60 backdrop-blur-sm border-t mt-16">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-wrap justify-center items-center gap-6 text-sm text-gray-500">
            <div className="flex items-center gap-1">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>🔒 EU GDPR Compliant</span>
            </div>
            <div className="flex items-center gap-1">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>📍 Data hosted in Frankfurt</span>
            </div>
            <div className="flex items-center gap-1">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>🔄 Cancel anytime</span>
            </div>
            <div className="flex items-center gap-1">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>🎧 Setup support included</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}