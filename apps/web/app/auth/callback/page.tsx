// =============================================================================
// SUPABASE AUTH CALLBACK - MAGIC LINK HANDLER
// =============================================================================
// Handles magic link authentication redirects from Supabase
// Processes authentication tokens and redirects to appropriate destination
// Includes error handling and loading states for smooth UX
// =============================================================================

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/auth/supabase-auth';
import { Loader2, Check, AlertCircle, Sparkles } from 'lucide-react';

export default function AuthCallbackPage() {
  const router = useRouter();
  
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Handle the auth callback
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          console.error('Auth callback error:', error);
          setErrorMessage(error.message);
          setStatus('error');
          return;
        }

        if (data.session) {
          console.log('Authentication successful');
          setStatus('success');

          // Get user metadata to determine redirect
          const user = data.session.user;
          const isNewUser = !user.user_metadata?.['onboarding_completed'];
          const salonId = user.app_metadata?.['salon_id'];

          // Redirect based on user status
          setTimeout(() => {
            if (isNewUser || !salonId) {
              // New user needs onboarding
              router.push('/onboarding?step=salon-setup');
            } else {
              // Existing user goes to dashboard
              router.push('/dashboard');
            }
          }, 1500);

        } else {
          setErrorMessage('No session found. Please try signing in again.');
          setStatus('error');
        }

      } catch (error) {
        console.error('Unexpected auth callback error:', error);
        setErrorMessage('Something went wrong. Please try again.');
        setStatus('error');
      }
    };

    handleAuthCallback();
  }, [router]);

  // Loading state
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg border border-gray-100 p-8">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-6">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            </div>
            
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Signing You In...
            </h2>
            
            <p className="text-gray-600 mb-6">
              Processing your magic link authentication
            </p>
            
            <div className="flex justify-center">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Success state
  if (status === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg border border-gray-100 p-8">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-6">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Welcome to Claxis! 🎉
            </h2>
            
            <p className="text-gray-600 mb-6">
              Authentication successful! Redirecting to your salon dashboard...
            </p>
            
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center justify-center gap-2 text-green-800">
                <Sparkles className="w-5 h-5" />
                <span className="font-medium">Ready to automate your salon!</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg border border-gray-100 p-8">
        <div className="text-center">
          <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-6">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Authentication Failed
          </h2>
          
          <p className="text-gray-600 mb-6">
            {errorMessage || 'Something went wrong with your login.'}
          </p>
          
          <div className="space-y-3">
            <button
              onClick={() => router.push('/auth/login')}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
            >
              Try Signing In Again
            </button>
            
            <button
              onClick={() => router.push('/auth/signup')}
              className="w-full bg-gray-100 text-gray-700 py-3 px-4 rounded-lg font-semibold hover:bg-gray-200 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
            >
              Create New Account
            </button>
          </div>
          
          <div className="mt-6 text-sm text-gray-500">
            Need help? Contact{' '}
            <a 
              href="mailto:support@claxis.app" 
              className="text-blue-600 hover:text-blue-700"
            >
              support@claxis.app
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}