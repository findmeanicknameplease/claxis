import { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { config } from '../config';
import { findStaffMemberByEmail, updateStaffMemberActivity } from './database';

export const authOptions: NextAuthOptions = {
  // For now, we'll use the default database adapter and integrate with our custom schema in the callbacks
  // adapter: SupabaseAdapter({
  //   url: config.NEXT_PUBLIC_SUPABASE_URL,
  //   secret: config.SUPABASE_SERVICE_ROLE_KEY || '',
  // }),
  
  providers: [
    // Commented out for development to avoid authentication issues
    // EmailProvider({
    //   server: {
    //     host: process.env['EMAIL_SERVER_HOST'],
    //     port: Number(process.env['EMAIL_SERVER_PORT']),
    //     auth: {
    //       user: process.env['EMAIL_SERVER_USER'],
    //       pass: process.env['EMAIL_SERVER_PASSWORD'],
    //     },
    //   },
    //   from: process.env['EMAIL_FROM'] || 'noreply@claxis.app',
    // }),
    
    // Google OAuth for quick signup (optional in development)
    GoogleProvider({
      clientId: process.env['GOOGLE_CLIENT_ID'] || 'development-placeholder',
      clientSecret: process.env['GOOGLE_CLIENT_SECRET'] || 'development-placeholder',
    }),
  ],

  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  pages: {
    signIn: '/auth/login',
    signOut: '/auth/logout',
    error: '/auth/error',
    verifyRequest: '/auth/verify-request',
  },

  callbacks: {
    async jwt({ token, user, account }) {
      if (user && account) {
        // First time user signs in
        token.userId = user.id;
        
        // Fetch user's salon and staff information
        try {
          const staffMember = await findStaffMemberByEmail(user.email || '');

          if (staffMember) {
            token.staffMemberId = staffMember.id;
            token.salonId = staffMember.salon_id;
            token.is_owner = staffMember.is_owner;
            token.role = staffMember.role;
            token.salon = staffMember.salons;
            
            // Update last activity
            await updateStaffMemberActivity(staffMember.id);
          }
        } catch (error) {
          console.error('Error fetching staff information:', error);
        }
      }
      return token;
    },

    async session({ session, token }) {
      // Add custom properties to session
      if (token) {
        session.user.id = token.userId as string;
        session.user.staffMemberId = token.staffMemberId as string;
        session.user.salonId = token.salonId as string;
        session.user.is_owner = token.is_owner as boolean;
        session.user.role = token.role as string;
        session.user.salon = token.salon as any;
      }
      return session;
    },

    async redirect({ url, baseUrl }) {
      // Redirect to dashboard after successful login
      if (url.startsWith('/')) return `${baseUrl}${url}`;
      if (new URL(url).origin === baseUrl) return url;
      return `${baseUrl}/dashboard`;
    },
  },

  events: {
    async signIn({ user, account, isNewUser }) {
      // Log successful sign-ins for security auditing
      console.log(`User ${user.email} signed in via ${account?.provider}`, {
        userId: user.id,
        isNewUser,
        timestamp: new Date().toISOString(),
        gdprCompliant: true, // EU data residency
      });
    },
  },

  // EU GDPR Compliance
  cookies: {
    sessionToken: {
      name: 'next-auth.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        domain: config.NODE_ENV === 'production' ? '.claxis.app' : undefined,
      },
    },
  },

  debug: config.NODE_ENV === 'development',
};