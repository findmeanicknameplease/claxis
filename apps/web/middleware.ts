// =============================================================================
// SUPABASE AUTH MIDDLEWARE - ROUTE PROTECTION
// =============================================================================
// Middleware for protecting routes with Supabase authentication
// Handles authentication checks and redirects for salon owners
// Much simpler than NextAuth.js with better Supabase integration
// =============================================================================

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const { pathname } = req.nextUrl;

  // DEVELOPMENT MODE: Allow access to dashboard without authentication for testing
  if (process.env.NODE_ENV === 'development' && pathname.startsWith('/dashboard')) {
    console.log('Development mode: Allowing dashboard access without auth');
    return res;
  }

  // Always allow access to public routes
  if (
    pathname === '/' ||
    pathname.startsWith('/auth/') ||
    pathname.startsWith('/api/webhooks/') ||
    pathname.startsWith('/api/health') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.startsWith('/public/') ||
    pathname === '/onboarding' ||
    pathname.startsWith('/payment')
  ) {
    return res;
  }

  try {
    // Create Supabase client for middleware using modern SSR approach
    const supabase = createServerClient(
      process.env['NEXT_PUBLIC_SUPABASE_URL']!,
      process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']!,
      {
        cookies: {
          get(name: string) {
            return req.cookies.get(name)?.value;
          },
          set(name: string, value: string, options: CookieOptions) {
            res.cookies.set({
              name,
              value,
              ...options,
            });
          },
          remove(name: string, options: CookieOptions) {
            res.cookies.set({
              name,
              value: '',
              ...options,
            });
          },
        },
      }
    );

    // Get current session
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) {
      console.error('Middleware auth error:', error);
      // On auth error, redirect to login
      const loginUrl = new URL('/auth/login', req.url);
      return NextResponse.redirect(loginUrl);
    }

    // Check if user is authenticated for protected routes
    if (pathname.startsWith('/dashboard') || pathname.startsWith('/admin')) {
      if (!session || !session.user) {
        console.log('No session found, redirecting to login');
        const loginUrl = new URL('/auth/login', req.url);
        loginUrl.searchParams.set('callbackUrl', pathname);
        return NextResponse.redirect(loginUrl);
      }

      // Get user metadata for role-based access
      const user = session.user;
      const isOwner = user.app_metadata?.['role'] === 'owner' || user.user_metadata?.['plan_type'] === 'enterprise';
      
      // Admin routes require owner role
      if (pathname.startsWith('/admin') && !isOwner) {
        console.log('Non-owner trying to access admin, redirecting to dashboard');
        return NextResponse.redirect(new URL('/dashboard', req.url));
      }

      // Add user info to headers for API routes
      const requestHeaders = new Headers(req.headers);
      requestHeaders.set('x-user-id', user.id);
      requestHeaders.set('x-user-email', user.email || '');
      requestHeaders.set('x-salon-id', user.app_metadata?.['salon_id'] || '');
      requestHeaders.set('x-user-role', user.app_metadata?.['role'] || 'user');

      return NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      });
    }

    // API route protection for voice intelligence
    if (pathname.startsWith('/api/voice/intelligence')) {
      if (!session || !session.user) {
        return NextResponse.json(
          { success: false, error: 'Authentication required' },
          { status: 401 }
        );
      }

      // Check if user has access to voice intelligence (Enterprise tier)
      const user = session.user;
      const planType = user.user_metadata?.['plan_type'];
      
      if (planType !== 'enterprise' && planType !== 'professional') {
        return NextResponse.json(
          { success: false, error: 'Voice Intelligence requires Professional or Enterprise plan' },
          { status: 403 }
        );
      }

      // Add user info to headers
      const requestHeaders = new Headers(req.headers);
      requestHeaders.set('x-user-id', user.id);
      requestHeaders.set('x-salon-id', user.app_metadata?.['salon_id'] || '');
      requestHeaders.set('x-plan-type', planType || 'professional');

      return NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      });
    }

    return res;

  } catch (error) {
    console.error('Unexpected middleware error:', error);
    
    // On unexpected error, allow the request but log it
    if (pathname.startsWith('/dashboard') || pathname.startsWith('/admin')) {
      const loginUrl = new URL('/auth/login', req.url);
      return NextResponse.redirect(loginUrl);
    }
    
    return res;
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public (public files)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|public).*)',
  ],
};