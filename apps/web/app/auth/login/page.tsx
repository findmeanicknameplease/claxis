// =============================================================================
// LOGIN PAGE - SUPABASE EMAIL OTP AUTHENTICATION
// =============================================================================
// Simple login page using email OTP for non-tech salon owners
// No passwords, no complexity - just enter email and get 6-digit code
// =============================================================================

import EmailOTPAuth from '@/components/auth/MagicLinkAuth';
import { Suspense } from 'react';

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center p-4">
      <Suspense fallback={<div>Loading...</div>}>
        <EmailOTPAuth mode="signin" />
      </Suspense>
    </div>
  );
}