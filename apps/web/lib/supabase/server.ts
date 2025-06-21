import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from './types';

// Check if Supabase is configured (server-side)
function isSupabaseConfigured(): boolean {
  const supabaseUrl = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const supabaseAnonKey = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];
  return !!(supabaseUrl && supabaseAnonKey && supabaseUrl.length > 0 && supabaseAnonKey.length > 0);
}

export async function createClient() {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables.');
  }

  const cookieStore = cookies();
  const supabaseUrl = process.env['NEXT_PUBLIC_SUPABASE_URL']!;
  const supabaseAnonKey = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']!;

  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options as any)
          );
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing
          // user sessions.
        }
      },
    },
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
    global: {
      headers: {
        'X-Client-Info': 'claxisapp-server',
      },
    },
    db: {
      schema: 'public',
    },
  });
}