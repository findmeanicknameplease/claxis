// =============================================================================
// SUPABASE AUTH SESSION HOOK - SESSION MANAGEMENT
// =============================================================================
// Provides session management functions for authentication flows
// Handles signup, signin, signout with loading states and error handling
// Perfect for login/signup forms and auth-protected components
// =============================================================================

'use client';

import { useState, useCallback } from 'react';
import { authManager, AuthResponse } from '../supabase-auth';

export interface AuthActions {
  // Email OTP Authentication (Primary)
  sendEmailOTP: (email: string, salonName?: string) => Promise<AuthResponse>;
  verifyEmailOTP: (email: string, otp: string) => Promise<AuthResponse>;
  
  // Session Management
  signOut: () => Promise<AuthResponse>;
  updateProfile: (updates: { data?: Record<string, any>; email?: string }) => Promise<AuthResponse>;
  
  // Loading States
  loading: {
    emailOTP: boolean;
    verifyOTP: boolean;
    signOut: boolean;
    updateProfile: boolean;
  };
  
  // Error States
  errors: {
    emailOTP: string | null;
    verifyOTP: string | null;
    signOut: string | null;
    updateProfile: string | null;
  };
  
  // Clear Errors
  clearErrors: () => void;
}

export function useAuthSession(): AuthActions {
  // Loading states for different operations
  const [loading, setLoading] = useState({
    emailOTP: false,
    verifyOTP: false,
    signOut: false,
    updateProfile: false,
  });

  // Error states for different operations
  const [errors, setErrors] = useState({
    emailOTP: null as string | null,
    verifyOTP: null as string | null,
    signOut: null as string | null,
    updateProfile: null as string | null,
  });

  // ==========================================================================
  // EMAIL OTP AUTHENTICATION (PRIMARY METHOD)
  // ==========================================================================

  const sendEmailOTP = useCallback(async (
    email: string, 
    salonName?: string
  ): Promise<AuthResponse> => {
    setLoading(prev => ({ ...prev, emailOTP: true }));
    setErrors(prev => ({ ...prev, emailOTP: null }));

    try {
      const result = await authManager.sendEmailOTP(email, {
        salonName,
        data: {
          fullName: salonName ? `${salonName} Owner` : undefined,
          planType: 'professional', // Default to professional plan
        },
      });

      if (!result.success) {
        setErrors(prev => ({ ...prev, emailOTP: result.error || 'Failed to send OTP code' }));
      }

      return result;

    } catch (error) {
      const errorMessage = 'Failed to send OTP code. Please try again.';
      setErrors(prev => ({ ...prev, emailOTP: errorMessage }));
      return { success: false, error: errorMessage };
    } finally {
      setLoading(prev => ({ ...prev, emailOTP: false }));
    }
  }, []);

  const verifyEmailOTP = useCallback(async (
    email: string, 
    otp: string
  ): Promise<AuthResponse> => {
    setLoading(prev => ({ ...prev, verifyOTP: true }));
    setErrors(prev => ({ ...prev, verifyOTP: null }));

    try {
      const result = await authManager.verifyEmailOTP(email, otp);

      if (!result.success) {
        setErrors(prev => ({ ...prev, verifyOTP: result.error || 'Invalid verification code' }));
      }

      return result;

    } catch (error) {
      const errorMessage = 'Invalid verification code. Please try again.';
      setErrors(prev => ({ ...prev, verifyOTP: errorMessage }));
      return { success: false, error: errorMessage };
    } finally {
      setLoading(prev => ({ ...prev, verifyOTP: false }));
    }
  }, []);

  // ==========================================================================
  // SESSION MANAGEMENT
  // ==========================================================================

  const signOut = useCallback(async (): Promise<AuthResponse> => {
    setLoading(prev => ({ ...prev, signOut: true }));
    setErrors(prev => ({ ...prev, signOut: null }));

    try {
      const result = await authManager.signOut();

      if (!result.success) {
        setErrors(prev => ({ ...prev, signOut: result.error || 'Failed to sign out' }));
      } else {
        // Clear all errors on successful signout
        setErrors({
          emailOTP: null,
          verifyOTP: null,
          signOut: null,
          updateProfile: null,
        });
      }

      return result;

    } catch (error) {
      const errorMessage = 'Failed to sign out. Please try again.';
      setErrors(prev => ({ ...prev, signOut: errorMessage }));
      return { success: false, error: errorMessage };
    } finally {
      setLoading(prev => ({ ...prev, signOut: false }));
    }
  }, []);

  const updateProfile = useCallback(async (updates: {
    data?: Record<string, any>;
    email?: string;
  }): Promise<AuthResponse> => {
    setLoading(prev => ({ ...prev, updateProfile: true }));
    setErrors(prev => ({ ...prev, updateProfile: null }));

    try {
      const result = await authManager.updateProfile(updates);

      if (!result.success) {
        setErrors(prev => ({ ...prev, updateProfile: result.error || 'Failed to update profile' }));
      }

      return result;

    } catch (error) {
      const errorMessage = 'Failed to update profile. Please try again.';
      setErrors(prev => ({ ...prev, updateProfile: errorMessage }));
      return { success: false, error: errorMessage };
    } finally {
      setLoading(prev => ({ ...prev, updateProfile: false }));
    }
  }, []);

  // ==========================================================================
  // UTILITY FUNCTIONS
  // ==========================================================================

  const clearErrors = useCallback(() => {
    setErrors({
      emailOTP: null,
      verifyOTP: null,
      signOut: null,
      updateProfile: null,
    });
  }, []);

  return {
    // Authentication Methods
    sendEmailOTP,
    verifyEmailOTP,
    
    // Session Management
    signOut,
    updateProfile,
    
    // State Management
    loading,
    errors,
    clearErrors,
  };
}