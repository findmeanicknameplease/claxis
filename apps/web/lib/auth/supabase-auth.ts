// =============================================================================
// SUPABASE AUTH CONFIGURATION - PERFECT FOR NON-TECH SALON OWNERS
// =============================================================================
// Email OTP for the easiest possible authentication experience
// No magic links, just simple 6-digit codes sent via email
// Seamless integration with existing Supabase ecosystem and RLS policies
// EU GDPR compliant with Frankfurt data residency
// =============================================================================

import { createClient } from '@supabase/supabase-js';
import { getSupabaseConfig } from '../config';

// Initialize Supabase client with auth persistence
const supabaseConfig = getSupabaseConfig();
export const supabase = createClient(
  supabaseConfig.url,
  supabaseConfig.anonKey,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      storageKey: 'claxis-auth',
    },
    global: {
      headers: {
        'x-application': 'claxis-salon-ai',
        'x-region': 'eu-central-1', // EU data residency
      },
    },
  }
);

// =============================================================================
// AUTHENTICATION TYPES
// =============================================================================

export interface AuthUser {
  id: string;
  email: string;
  phone?: string;
  user_metadata: {
    salon_name?: string;
    full_name?: string;
    plan_type?: 'professional' | 'enterprise';
    onboarding_completed?: boolean;
  };
  app_metadata: {
    salon_id?: string;
    role?: 'owner' | 'admin' | 'staff';
    subscription_status?: 'active' | 'trial' | 'cancelled';
  };
  created_at: string;
  last_sign_in_at?: string;
}

export interface AuthSession {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: AuthUser;
}

export interface AuthResponse {
  success: boolean;
  data?: AuthSession | AuthUser;
  error?: string;
  needsVerification?: boolean;
}

// =============================================================================
// EMAIL OTP AUTHENTICATION - PERFECT FOR SALON OWNERS
// =============================================================================

export class SupabaseAuthManager {
  
  /**
   * Send email OTP for signup/signin - The easiest auth for non-tech users
   * No passwords, no magic links, just simple 6-digit codes
   */
  async sendEmailOTP(
    email: string, 
    options?: {
      salonName?: string;
      data?: Record<string, any>;
    }
  ): Promise<AuthResponse> {
    try {
      console.log(`Sending email OTP to: ${email}`);

      const { data, error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          // Store salon info for new signups
          data: {
            salon_name: options?.salonName,
            full_name: options?.data?.['fullName'],
            plan_type: options?.data?.['planType'] || 'professional',
            ...(options?.data || {}),
          },
          
          // Allow automatic user creation for new signups
          shouldCreateUser: true,
        },
      });

      if (error) {
        console.error('Email OTP error:', error);
        return {
          success: false,
          error: this.getReadableError(error.message),
        };
      }

      console.log('Email OTP sent successfully');
      return {
        success: true,
        needsVerification: true,
        data: data.user || undefined,
      };

    } catch (error) {
      console.error('Unexpected email OTP error:', error);
      return {
        success: false,
        error: 'Failed to send OTP code. Please try again.',
      };
    }
  }


  /**
   * Verify email OTP code
   */
  async verifyEmailOTP(
    email: string,
    otp: string
  ): Promise<AuthResponse> {
    try {
      console.log(`Verifying email OTP for: ${email}`);

      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: 'email',
      });

      if (error) {
        console.error('Email OTP verification error:', error);
        return {
          success: false,
          error: this.getReadableError(error.message),
        };
      }

      console.log('Email OTP verified successfully');
      return {
        success: true,
        data: data.session ? (data.session as AuthSession) : undefined,
      };

    } catch (error) {
      console.error('Unexpected email OTP verification error:', error);
      return {
        success: false,
        error: 'Invalid verification code. Please try again.',
      };
    }
  }

  /**
   * Get current authenticated user session
   */
  async getCurrentSession(): Promise<AuthResponse> {
    try {
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        console.error('Session error:', error);
        return {
          success: false,
          error: 'Failed to get user session',
        };
      }

      if (!data.session) {
        return {
          success: false,
          error: 'No active session',
        };
      }

      return {
        success: true,
        data: data.session ? (data.session as AuthSession) : undefined,
      };

    } catch (error) {
      console.error('Unexpected session error:', error);
      return {
        success: false,
        error: 'Failed to retrieve session',
      };
    }
  }

  /**
   * Get current authenticated user
   */
  async getCurrentUser(): Promise<AuthUser | null> {
    try {
      const { data, error } = await supabase.auth.getUser();

      if (error || !data.user) {
        return null;
      }

      return data.user as AuthUser;
    } catch (error) {
      console.error('Get user error:', error);
      return null;
    }
  }

  /**
   * Sign out current user
   */
  async signOut(): Promise<AuthResponse> {
    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        console.error('Sign out error:', error);
        return {
          success: false,
          error: 'Failed to sign out',
        };
      }

      console.log('User signed out successfully');
      return {
        success: true,
      };

    } catch (error) {
      console.error('Unexpected sign out error:', error);
      return {
        success: false,
        error: 'Failed to sign out',
      };
    }
  }

  /**
   * Update user profile information
   */
  async updateProfile(updates: {
    data?: Record<string, any>;
    email?: string;
    phone?: string;
  }): Promise<AuthResponse> {
    try {
      const { data, error } = await supabase.auth.updateUser(updates);

      if (error) {
        console.error('Profile update error:', error);
        return {
          success: false,
          error: this.getReadableError(error.message),
        };
      }

      console.log('Profile updated successfully');
      return {
        success: true,
        data: data.user as AuthUser,
      };

    } catch (error) {
      console.error('Unexpected profile update error:', error);
      return {
        success: false,
        error: 'Failed to update profile',
      };
    }
  }

  /**
   * Listen to authentication state changes
   */
  onAuthStateChange(callback: (event: string, session: AuthSession | null) => void) {
    return supabase.auth.onAuthStateChange((event, session) => {
      console.log(`Auth state changed: ${event}`, session?.user?.email);
      callback(event, session as AuthSession | null);
    });
  }

  /**
   * Convert technical error messages to user-friendly messages
   */
  private getReadableError(error: string): string {
    const errorMap: Record<string, string> = {
      'Invalid login credentials': 'We couldn\'t find an account with that email. Please check your email or sign up.',
      'Email not confirmed': 'Please check your email and click the magic link we sent you.',
      'Too many requests': 'Too many attempts. Please wait a few minutes before trying again.',
      'Invalid email': 'Please enter a valid email address.',
      'Invalid phone number': 'Please enter a valid phone number.',
      'Token has expired': 'Your login link has expired. Please request a new one.',
      'Invalid token': 'Invalid verification code. Please try again.',
      'User not found': 'We couldn\'t find an account with that information.',
    };

    // Return mapped message or original if no mapping found
    return errorMap[error] || error || 'Something went wrong. Please try again.';
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

// Export a singleton instance for consistent usage across the app
export const authManager = new SupabaseAuthManager();

// =============================================================================
// AUTH HOOKS FOR REACT COMPONENTS
// =============================================================================

export { useAuthState } from './hooks/useAuthState';
export { useAuthSession } from './hooks/useAuthSession';

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  const session = await authManager.getCurrentSession();
  return session.success && !!session.data;
}

/**
 * Require authentication for API routes
 */
export async function requireAuth(): Promise<AuthUser> {
  const user = await authManager.getCurrentUser();
  
  if (!user) {
    throw new Error('Authentication required');
  }
  
  return user;
}

/**
 * Get user's salon ID for RLS policies
 */
export async function getUserSalonId(): Promise<string | null> {
  const user = await authManager.getCurrentUser();
  return user?.app_metadata?.salon_id || null;
}