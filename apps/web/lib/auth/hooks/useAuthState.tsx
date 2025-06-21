// =============================================================================
// SUPABASE AUTH STATE HOOK - REACT INTEGRATION
// =============================================================================
// Real-time authentication state management for React components
// Automatically handles session changes and user updates
// Perfect for responsive UI updates based on auth status
// =============================================================================

'use client';

import { useState, useEffect, useCallback } from 'react';
import { authManager, AuthUser, AuthSession } from '../supabase-auth';

export interface AuthState {
  user: AuthUser | null;
  session: AuthSession | null;
  loading: boolean;
  isAuthenticated: boolean;
  isOwner: boolean;
  salonId: string | null;
  planType: 'professional' | 'enterprise' | null;
}

export function useAuthState(): AuthState {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
    isAuthenticated: false,
    isOwner: false,
    salonId: null,
    planType: null,
  });

  // Initialize auth state and set up listener
  useEffect(() => {
    let mounted = true;

    // Get initial session
    const initializeAuth = async () => {
      try {
        const sessionResult = await authManager.getCurrentSession();
        
        if (!mounted) return;

        if (sessionResult.success && sessionResult.data) {
          const session = sessionResult.data as AuthSession;
          updateAuthState(session);
        } else {
          updateAuthState(null);
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        if (mounted) {
          updateAuthState(null);
        }
      }
    };

    initializeAuth();

    // Listen for auth changes
    const { data: { subscription } } = authManager.onAuthStateChange((event, session) => {
      if (!mounted) return;
      
      console.log(`Auth state changed: ${event}`);
      updateAuthState(session);
    });

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  // Update auth state helper
  const updateAuthState = useCallback((session: AuthSession | null) => {
    const user = session?.user || null;
    const isAuthenticated = !!session && !!user;
    const isOwner = user?.app_metadata?.role === 'owner' || user?.user_metadata?.plan_type === 'enterprise';
    const salonId = user?.app_metadata?.salon_id || null;
    const planType = user?.user_metadata?.plan_type || null;

    setState({
      user,
      session,
      loading: false,
      isAuthenticated,
      isOwner,
      salonId,
      planType,
    });
  }, []);

  return state;
}