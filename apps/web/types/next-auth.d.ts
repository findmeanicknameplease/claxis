import NextAuth from 'next-auth';
import { JWT } from 'next-auth/jwt';

declare module 'next-auth' {
  interface User {
    id: string;
    email: string;
    name?: string;
    image?: string;
  }

  interface Session {
    user: {
      id: string;
      email: string;
      name?: string;
      image?: string;
      staffMemberId: string;
      salonId: string;
      is_owner: boolean;
      role: string;
      salon: {
        id: string;
        business_name: string;
        subscription_tier: 'professional' | 'enterprise';
        subscription_status: string;
      };
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userId: string;
    staffMemberId: string;
    salonId: string;
    is_owner: boolean;
    role: string;
    salon: {
      id: string;
      business_name: string;
      subscription_tier: 'professional' | 'enterprise';
      subscription_status: string;
    };
  }
}