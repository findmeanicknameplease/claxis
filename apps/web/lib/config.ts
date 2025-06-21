import { z } from 'zod';

const configSchema = z.object({
  // App Configuration
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  NEXT_PUBLIC_APP_URL: z.string().url().default('https://getclaxis.com'),
  NEXT_PUBLIC_APP_NAME: z.string().default('Gemini Salon AI'),

  // Supabase Configuration
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_ANON_KEY: z.string().min(1).optional(), // Alias for middleware
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),

  // n8n Configuration
  N8N_WEBHOOK_URL: z.string().url().default('http://localhost:5678'),
  N8N_API_KEY: z.string().min(1).optional(),

  // WhatsApp Configuration
  WHATSAPP_ACCESS_TOKEN: z.string().min(1).optional(),
  WHATSAPP_APP_SECRET: z.string().min(1).optional(),
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: z.string().min(1).optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().min(1).optional(),
  WHATSAPP_BUSINESS_ACCOUNT_ID: z.string().min(1).optional(),

  // Instagram Configuration
  INSTAGRAM_ACCESS_TOKEN: z.string().min(1).optional(),
  INSTAGRAM_APP_SECRET: z.string().min(1).optional(),
  INSTAGRAM_PAGE_ID: z.string().min(1).optional(),
  INSTAGRAM_WEBHOOK_VERIFY_TOKEN: z.string().min(1).optional(),

  // AI Services
  GEMINI_API_KEY: z.string().min(1).optional(),
  DEEPSEEK_API_KEY: z.string().min(1).optional(),
  ELEVENLABS_API_KEY: z.string().min(1).optional(),

  // EU Compliance
  DATA_REGION: z.string().default('eu-central-1'),
  DATA_RESIDENCY: z.string().default('frankfurt'),
  GDPR_DPO_EMAIL: z.string().email().optional(),

  // Authentication
  NEXTAUTH_SECRET: z.string().min(32).optional(),
  NEXTAUTH_URL: z.string().url().optional(),
  
  // OAuth Providers
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  GOOGLE_REDIRECT_URI: z.string().url().optional(),
  
  // Microsoft OAuth
  MICROSOFT_CLIENT_ID: z.string().min(1).optional(),
  MICROSOFT_CLIENT_SECRET: z.string().min(1).optional(),
  MICROSOFT_REDIRECT_URI: z.string().url().optional(),
  
  // Email Configuration
  EMAIL_SERVER_HOST: z.string().optional(),
  EMAIL_SERVER_PORT: z.string().optional(),
  EMAIL_SERVER_USER: z.string().optional(),
  EMAIL_SERVER_PASSWORD: z.string().optional(),
  EMAIL_FROM: z.string().email().optional(),

  // Redis
  REDIS_URL: z.string().url().optional(),
  REDIS_PASSWORD: z.string().optional(),
  
  // Upstash Redis
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),

  // Features
  NEXT_PUBLIC_DEBUG_MODE: z.string().transform((val) => val === 'true').default('false'),
  RATE_LIMIT_ENABLED: z.string().transform((val) => val === 'true').default('true'),
  RATE_LIMIT_REQUESTS_PER_MINUTE: z.string().transform((val) => parseInt(val, 10)).default('100'),
});

function getConfig() {
  try {
    return configSchema.parse({
      NODE_ENV: process.env['NODE_ENV'],
      NEXT_PUBLIC_APP_URL: process.env['NEXT_PUBLIC_APP_URL'],
      NEXT_PUBLIC_APP_NAME: process.env['NEXT_PUBLIC_APP_NAME'],
      NEXT_PUBLIC_SUPABASE_URL: process.env['NEXT_PUBLIC_SUPABASE_URL'],
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'],
      SUPABASE_ANON_KEY: process.env['SUPABASE_ANON_KEY'] || process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'], // Fallback to public key
      SUPABASE_SERVICE_ROLE_KEY: process.env['SUPABASE_SERVICE_ROLE_KEY'],
      N8N_WEBHOOK_URL: process.env['N8N_WEBHOOK_URL'],
      N8N_API_KEY: process.env['N8N_API_KEY'],
      WHATSAPP_ACCESS_TOKEN: process.env['WHATSAPP_ACCESS_TOKEN'],
      WHATSAPP_APP_SECRET: process.env['WHATSAPP_APP_SECRET'],
      WHATSAPP_WEBHOOK_VERIFY_TOKEN: process.env['WHATSAPP_WEBHOOK_VERIFY_TOKEN'],
      WHATSAPP_PHONE_NUMBER_ID: process.env['WHATSAPP_PHONE_NUMBER_ID'],
      WHATSAPP_BUSINESS_ACCOUNT_ID: process.env['WHATSAPP_BUSINESS_ACCOUNT_ID'],
      INSTAGRAM_ACCESS_TOKEN: process.env['INSTAGRAM_ACCESS_TOKEN'],
      INSTAGRAM_APP_SECRET: process.env['INSTAGRAM_APP_SECRET'],
      INSTAGRAM_PAGE_ID: process.env['INSTAGRAM_PAGE_ID'],
      INSTAGRAM_WEBHOOK_VERIFY_TOKEN: process.env['INSTAGRAM_WEBHOOK_VERIFY_TOKEN'],
      GEMINI_API_KEY: process.env['GEMINI_API_KEY'],
      DEEPSEEK_API_KEY: process.env['DEEPSEEK_API_KEY'],
      ELEVENLABS_API_KEY: process.env['ELEVENLABS_API_KEY'],
      DATA_REGION: process.env['DATA_REGION'],
      DATA_RESIDENCY: process.env['DATA_RESIDENCY'],
      GDPR_DPO_EMAIL: process.env['GDPR_DPO_EMAIL'],
      NEXTAUTH_SECRET: process.env['NEXTAUTH_SECRET'],
      NEXTAUTH_URL: process.env['NEXTAUTH_URL'],
      GOOGLE_CLIENT_ID: process.env['GOOGLE_CLIENT_ID'],
      GOOGLE_CLIENT_SECRET: process.env['GOOGLE_CLIENT_SECRET'],
      GOOGLE_REDIRECT_URI: process.env['GOOGLE_REDIRECT_URI'],
      MICROSOFT_CLIENT_ID: process.env['MICROSOFT_CLIENT_ID'],
      MICROSOFT_CLIENT_SECRET: process.env['MICROSOFT_CLIENT_SECRET'],
      MICROSOFT_REDIRECT_URI: process.env['MICROSOFT_REDIRECT_URI'],
      EMAIL_SERVER_HOST: process.env['EMAIL_SERVER_HOST'],
      EMAIL_SERVER_PORT: process.env['EMAIL_SERVER_PORT'],
      EMAIL_SERVER_USER: process.env['EMAIL_SERVER_USER'],
      EMAIL_SERVER_PASSWORD: process.env['EMAIL_SERVER_PASSWORD'],
      EMAIL_FROM: process.env['EMAIL_FROM'],
      REDIS_URL: process.env['REDIS_URL'],
      REDIS_PASSWORD: process.env['REDIS_PASSWORD'],
      UPSTASH_REDIS_REST_URL: process.env['UPSTASH_REDIS_REST_URL'],
      UPSTASH_REDIS_REST_TOKEN: process.env['UPSTASH_REDIS_REST_TOKEN'],
      NEXT_PUBLIC_DEBUG_MODE: process.env['NEXT_PUBLIC_DEBUG_MODE'],
      RATE_LIMIT_ENABLED: process.env['RATE_LIMIT_ENABLED'],
      RATE_LIMIT_REQUESTS_PER_MINUTE: process.env['RATE_LIMIT_REQUESTS_PER_MINUTE'],
    });
  } catch (error) {
    console.error('❌ Invalid environment configuration:', error);
    throw new Error('Invalid environment configuration');
  }
}

export const config = getConfig();

// EU Compliance helpers
export const isEUCompliant = () => {
  return config.DATA_RESIDENCY === 'frankfurt' && config.DATA_REGION === 'eu-central-1';
};

export const getDataResidencyInfo = () => ({
  region: config.DATA_REGION,
  residency: config.DATA_RESIDENCY,
  isEUCompliant: isEUCompliant(),
  dpoEmail: config.GDPR_DPO_EMAIL,
});

// Supabase Auth helpers
export const getSupabaseConfig = () => ({
  url: config.NEXT_PUBLIC_SUPABASE_URL,
  anonKey: config.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  serviceRoleKey: config.SUPABASE_SERVICE_ROLE_KEY,
});

// Feature flags
export const features = {
  debugMode: config.NEXT_PUBLIC_DEBUG_MODE,
  rateLimitEnabled: config.RATE_LIMIT_ENABLED,
  rateLimitPerMinute: config.RATE_LIMIT_REQUESTS_PER_MINUTE,
} as const;