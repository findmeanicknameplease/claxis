// =============================================================================
// SIGNUP PAGE - SUPABASE EMAIL OTP AUTHENTICATION
// =============================================================================
// Simple signup page for salon owners using email OTP
// Collects salon name and email, then sends 6-digit code for instant access
// Perfect for non-tech users who want to start automating quickly
// =============================================================================

import EmailOTPAuth from '@/components/auth/MagicLinkAuth';
import { Suspense } from 'react';

export default function SignupPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center p-4">
      <Suspense fallback={<div>Loading...</div>}>
        <EmailOTPAuth mode="signup" />
      </Suspense>
    </div>
  );
}