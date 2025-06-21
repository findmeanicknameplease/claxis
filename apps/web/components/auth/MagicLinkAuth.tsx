// =============================================================================
// EMAIL OTP AUTH COMPONENT - PERFECT FOR NON-TECH SALON OWNERS
// =============================================================================
// Simple, beautiful authentication that requires zero technical knowledge
// Email OTP codes eliminate password complexity and provide instant access
// Just enter email, get 6-digit code, and you're in!
// =============================================================================

'use client';

import React, { useState } from 'react';
import { useAuthSession } from '@/lib/auth/hooks/useAuthSession';
import { Mail, Check, AlertCircle, Loader2, Sparkles } from 'lucide-react';

interface EmailOTPAuthProps {
  mode?: 'signup' | 'signin';
  redirectTo?: string;
}

export default function EmailOTPAuth({ 
  mode = 'signup', 
  redirectTo = '/dashboard' 
}: EmailOTPAuthProps) {
  // Auth session management
  const { 
    sendEmailOTP, 
    verifyEmailOTP, 
    loading, 
    errors, 
    clearErrors 
  } = useAuthSession();

  // Form state
  const [email, setEmail] = useState('');
  const [salonName, setSalonName] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [step, setStep] = useState<'input' | 'verify' | 'success'>('input');

  // Handle email OTP
  const handleEmailOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    clearErrors();

    if (!email || !email.includes('@')) {
      return;
    }

    const result = await sendEmailOTP(email, salonName);

    if (result.success) {
      setStep('verify');
    }
  };


  // Handle OTP verification
  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    clearErrors();

    if (!otpCode || otpCode.length !== 6) {
      return;
    }

    const result = await verifyEmailOTP(email, otpCode);

    if (result.success) {
      setStep('success');
      setTimeout(() => {
        window.location.href = redirectTo;
      }, 1500);
    }
  };

  // Success message component
  if (step === 'success') {
    return (
      <div className="max-w-md mx-auto p-8 bg-white rounded-xl shadow-lg border border-gray-100">
        <div className="text-center">
          <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-6">
            <Check className="w-8 h-8 text-green-600" />
          </div>
          
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Success!
          </h2>
          
          <div className="space-y-4">
            <p className="text-gray-600">
              You're all set! Redirecting to your dashboard...
            </p>
            <div className="flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // OTP verification step
  if (step === 'verify') {
    return (
      <div className="max-w-md mx-auto p-8 bg-white rounded-xl shadow-lg border border-gray-100">
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-6">
            <Mail className="w-8 h-8 text-blue-600" />
          </div>
          
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Enter Verification Code
          </h2>
          <p className="text-gray-600">
            We sent a 6-digit code to <strong>{email}</strong>
          </p>
        </div>

        <form onSubmit={handleVerifyOTP} className="space-y-6">
          <div>
            <input
              type="text"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="Enter 6-digit code"
              className="w-full px-4 py-3 text-center text-2xl font-mono tracking-widest border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              maxLength={6}
              required
            />
          </div>

          {errors.verifyOTP && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
              <AlertCircle className="w-5 h-5" />
              <span className="text-sm">{errors.verifyOTP}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading.verifyOTP || otpCode.length !== 6}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading.verifyOTP ? (
              <div className="flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                Verifying...
              </div>
            ) : (
              'Verify & Continue'
            )}
          </button>

          <button
            type="button"
            onClick={() => setStep('input')}
            className="w-full text-gray-600 py-2 hover:text-gray-800 transition-colors"
          >
            ← Back to email
          </button>
        </form>
      </div>
    );
  }

  // Main authentication form
  return (
    <div className="max-w-md mx-auto p-8 bg-white rounded-xl shadow-lg border border-gray-100">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="mx-auto w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mb-6">
          <Sparkles className="w-8 h-8 text-white" />
        </div>
        
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {mode === 'signup' ? 'Start Automating Your Salon' : 'Welcome Back'}
        </h1>
        <p className="text-gray-600">
          {mode === 'signup' 
            ? 'No passwords needed - just enter a 6-digit code and you\'re in!' 
            : 'Access your salon dashboard instantly'
          }
        </p>
      </div>


      {/* Email OTP Form */}
      <form onSubmit={handleEmailOTP} className="space-y-6">
          {mode === 'signup' && (
            <div>
              <label htmlFor="salonName" className="block text-sm font-medium text-gray-700 mb-2">
                Salon Name
              </label>
              <input
                type="text"
                id="salonName"
                value={salonName}
                onChange={(e) => setSalonName(e.target.value)}
                placeholder="Beautiful Hair Salon"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required={mode === 'signup'}
              />
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Email Address
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="owner@yoursalon.com"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          {errors.emailOTP && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
              <AlertCircle className="w-5 h-5" />
              <span className="text-sm">{errors.emailOTP}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading.emailOTP || !email}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 px-4 rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {loading.emailOTP ? (
              <div className="flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                Sending OTP Code...
              </div>
            ) : (
              <>
                <Mail className="w-5 h-5 inline mr-2" />
                {mode === 'signup' ? 'Send OTP Code' : 'Login with OTP Code'}
              </>
            )}
          </button>
        </form>


      {/* Helper Text */}
      <div className="mt-6 text-center text-sm text-gray-500">
        {mode === 'signup' ? (
          <p>
            Already have an account?{' '}
            <button 
              onClick={() => window.location.href = '/auth/login'} 
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              Sign in here
            </button>
          </p>
        ) : (
          <p>
            New to Claxis?{' '}
            <button 
              onClick={() => window.location.href = '/auth/signup'} 
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              Create account
            </button>
          </p>
        )}
      </div>

      {/* Trust Indicators */}
      <div className="mt-8 pt-6 border-t border-gray-200">
        <div className="flex items-center justify-center gap-6 text-xs text-gray-400">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-green-400 rounded-full"></div>
            EU GDPR Compliant
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
            Frankfurt Data
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
            Enterprise Security
          </div>
        </div>
      </div>
    </div>
  );
}