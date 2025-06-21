import { z } from 'zod';
import { 
  ValidationResult,
  ServiceWindowSettings,
  isValidSalonId,
  isValidTimestamp
} from '@/types';

// =============================================================================
// ZOD SCHEMAS FOR VALIDATION
// =============================================================================

const BusinessHoursSchema = z.record(z.object({
  is_open: z.boolean(),
  open_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
  close_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
  breaks: z.array(z.object({
    start_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
    end_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
    description: z.string().optional(),
  })).optional(),
}));

const SalonDataSchema = z.object({
  id: z.string().uuid(),
  business_name: z.string().min(1).max(255),
  owner_name: z.string().min(1).max(255),
  email: z.string().email(),
  phone: z.string().min(10).max(20),
  whatsapp_number: z.string().min(10).max(20).optional(),
  instagram_handle: z.string().max(100).optional(),
  address: z.object({
    street: z.string().min(1),
    city: z.string().min(1),
    state: z.string().min(1),
    postal_code: z.string().min(1),
    country: z.string().min(2).max(2),
  }),
  timezone: z.string().min(1),
  subscription_tier: z.enum(['professional', 'enterprise']),
  subscription_status: z.string(),
  settings: z.object({
    business_hours: BusinessHoursSchema,
    booking_preferences: z.object({
      advance_booking_days: z.number().min(1).max(365),
      minimum_notice_minutes: z.number().min(0).max(1440),
      cancellation_policy_hours: z.number().min(0).max(168),
      auto_confirm_bookings: z.boolean(),
      require_deposit: z.boolean(),
      deposit_percentage: z.number().min(0).max(100),
    }),
    whatsapp_settings: z.object({
      enabled: z.boolean(),
      phone_number_id: z.string(),
      access_token: z.string(),
      webhook_verify_token: z.string(),
      business_account_id: z.string(),
      message_templates: z.record(z.object({
        name: z.string(),
        content: z.string(),
        language: z.string(),
        category: z.string(),
      })),
      service_window_settings: z.object({
        enabled: z.boolean(),
        cost_threshold_euros: z.number().min(0),
        template_cost_euros: z.number().min(0),
        free_window_hours: z.number().min(0).max(72),
        max_optimization_percentage: z.number().min(0).max(100),
      }),
    }),
    ai_settings: z.object({
      gemini_enabled: z.boolean(),
      deepseek_enabled: z.boolean(),
      elevenlabs_enabled: z.boolean(),
      preferred_language: z.string().min(2).max(5),
      fallback_language: z.string().min(2).max(5),
      confidence_threshold: z.number().min(0).max(1),
      cost_budget_monthly_euros: z.number().min(0),
    }),
    notification_preferences: z.object({
      email_notifications: z.boolean(),
      sms_notifications: z.boolean(),
      slack_webhook: z.string().url().optional(),
      notification_types: z.array(z.string()),
    }),
  }),
  metadata: z.record(z.unknown()),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

const ConversationContextSchema = z.object({
  id: z.string().uuid(),
  salon_id: z.string().uuid(),
  customer_id: z.string().uuid().optional(),
  channel: z.enum(['whatsapp', 'instagram', 'web']),
  external_id: z.string().min(1),
  status: z.enum(['active', 'resolved', 'escalated', 'archived']),
  last_message_at: z.string().datetime().optional(),
  message_count: z.number().min(0),
  customer_sentiment: z.enum(['positive', 'neutral', 'negative', 'unknown']),
  intent_detected: z.string().optional(),
  booking_probability: z.number().min(0).max(1),
});

const BookingRequestSchema = z.object({
  salon_id: z.string().uuid(),
  customer_id: z.string().uuid(),
  service_id: z.string().uuid(),
  staff_member_id: z.string().uuid().optional(),
  preferred_date: z.string().date(),
  preferred_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
  duration_minutes: z.number().min(15).max(480),
  notes: z.string().max(1000).optional(),
  source: z.enum(['whatsapp', 'instagram', 'web', 'manual']),
});

const AIRequestSchema = z.object({
  model: z.enum(['gemini-flash', 'deepseek-r1', 'elevenlabs']),
  salon_id: z.string().uuid(),
  conversation_id: z.string().uuid(),
  message_content: z.string().min(1).max(4000),
  message_type: z.enum(['text', 'image', 'voice']),
  context: ConversationContextSchema,
  salon_data: SalonDataSchema,
  intent_hint: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
});

// =============================================================================
// VALIDATION FUNCTIONS
// =============================================================================

export function validateSalonData(data: unknown): ValidationResult {
  try {
    SalonDataSchema.parse(data);
    return { valid: true, errors: [], warnings: [] };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        valid: false,
        errors: error.errors.map(err => `${err.path.join('.')}: ${err.message}`),
        warnings: [],
      };
    }
    return {
      valid: false,
      errors: ['Unknown validation error'],
      warnings: [],
    };
  }
}

export function validateConversationContext(data: unknown): ValidationResult {
  try {
    ConversationContextSchema.parse(data);
    return { valid: true, errors: [], warnings: [] };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        valid: false,
        errors: error.errors.map(err => `${err.path.join('.')}: ${err.message}`),
        warnings: [],
      };
    }
    return {
      valid: false,
      errors: ['Unknown validation error'],
      warnings: [],
    };
  }
}

export function validateBookingRequest(data: unknown): ValidationResult {
  try {
    BookingRequestSchema.parse(data);
    return { valid: true, errors: [], warnings: [] };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        valid: false,
        errors: error.errors.map(err => `${err.path.join('.')}: ${err.message}`),
        warnings: [],
      };
    }
    return {
      valid: false,
      errors: ['Unknown validation error'],
      warnings: [],
    };
  }
}

export function validateAIRequest(data: unknown): ValidationResult {
  try {
    AIRequestSchema.parse(data);
    return { valid: true, errors: [], warnings: [] };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        valid: false,
        errors: error.errors.map(err => `${err.path.join('.')}: ${err.message}`),
        warnings: [],
      };
    }
    return {
      valid: false,
      errors: ['Unknown validation error'],
      warnings: [],
    };
  }
}

// =============================================================================
// BUSINESS LOGIC VALIDATION
// =============================================================================

export function validateServiceWindowSettings(settings: ServiceWindowSettings): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (settings.cost_threshold_euros < 0.01) {
    errors.push('Cost threshold must be at least €0.01');
  }

  if (settings.template_cost_euros < 0.01) {
    errors.push('Template cost must be at least €0.01');
  }

  if (settings.free_window_hours > 72) {
    errors.push('Free window cannot exceed 72 hours');
  }

  if (settings.max_optimization_percentage > 90) {
    warnings.push('High optimization percentage (>90%) may impact customer experience');
  }

  if (settings.template_cost_euros > settings.cost_threshold_euros) {
    warnings.push('Template cost is higher than threshold - optimization may not be effective');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export function validateBusinessHours(hours: Record<string, unknown>): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const validDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  
  for (const day of validDays) {
    if (!(day in hours)) {
      errors.push(`Missing business hours for ${day}`);
      continue;
    }

    const dayHours = hours[day] as Record<string, unknown>;
    
    if (typeof dayHours['is_open'] !== 'boolean') {
      errors.push(`Invalid is_open value for ${day}`);
      continue;
    }

    if (dayHours['is_open']) {
      if (!dayHours['open_time'] || !dayHours['close_time']) {
        errors.push(`Open and close times required for ${day} when salon is open`);
        continue;
      }

      // Validate time format and logic
      const openTime = dayHours['open_time'] as string;
      const closeTime = dayHours['close_time'] as string;

      if (!isValidTimeFormat(openTime)) {
        errors.push(`Invalid open time format for ${day}: ${openTime}`);
      }

      if (!isValidTimeFormat(closeTime)) {
        errors.push(`Invalid close time format for ${day}: ${closeTime}`);
      }

      if (isValidTimeFormat(openTime) && isValidTimeFormat(closeTime)) {
        if (timeToMinutes(closeTime) <= timeToMinutes(openTime)) {
          errors.push(`Close time must be after open time for ${day}`);
        }

        const totalHours = (timeToMinutes(closeTime) - timeToMinutes(openTime)) / 60;
        if (totalHours > 16) {
          warnings.push(`Very long business hours (${totalHours}h) for ${day}`);
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export function validateBookingTimeSlot(
  preferredDate: string,
  preferredTime: string | undefined,
  durationMinutes: number,
  businessHours: Record<string, unknown>
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate date format
  if (!isValidDateFormat(preferredDate)) {
    errors.push('Invalid date format. Use YYYY-MM-DD');
    return { valid: false, errors, warnings };
  }

  const date = new Date(preferredDate);
  const now = new Date();

  // Check if date is in the past
  if (date < now) {
    errors.push('Cannot book appointments in the past');
  }

  // Check if date is too far in the future (1 year max)
  const oneYearFromNow = new Date();
  oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
  if (date > oneYearFromNow) {
    errors.push('Cannot book appointments more than 1 year in advance');
  }

  // Get day of week
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayName = dayNames[date.getDay()];

  // Check business hours
  const dayHours = businessHours[dayName!] as Record<string, unknown>;
  if (!dayHours || !dayHours['is_open']) {
    errors.push(`Salon is closed on ${dayName}`);
    return { valid: false, errors, warnings };
  }

  // Validate time if provided
  if (preferredTime) {
    if (!isValidTimeFormat(preferredTime)) {
      errors.push('Invalid time format. Use HH:MM');
    } else {
      const requestedMinutes = timeToMinutes(preferredTime);
      const openMinutes = timeToMinutes(dayHours['open_time'] as string);
      const closeMinutes = timeToMinutes(dayHours['close_time'] as string);

      if (requestedMinutes < openMinutes) {
        errors.push(`Requested time is before opening time (${dayHours['open_time']})`);
      }

      if (requestedMinutes + durationMinutes > closeMinutes) {
        errors.push(`Appointment would extend past closing time (${dayHours['close_time']})`);
      }

      // Check for adequate notice (minimum 2 hours)
      const appointmentDateTime = new Date(`${preferredDate}T${preferredTime}`);
      const hoursNotice = (appointmentDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
      
      if (hoursNotice < 2) {
        errors.push('Minimum 2 hours notice required for bookings');
      } else if (hoursNotice < 24) {
        warnings.push('Less than 24 hours notice - subject to availability');
      }
    }
  }

  // Validate duration
  if (durationMinutes < 15) {
    errors.push('Minimum appointment duration is 15 minutes');
  }

  if (durationMinutes > 480) {
    errors.push('Maximum appointment duration is 8 hours');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function isValidTimeFormat(time: string): boolean {
  return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time);
}

function isValidDateFormat(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && !isNaN(Date.parse(date));
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

export function validateNodeExecutionContext(context: unknown): ValidationResult {
  if (!context || typeof context !== 'object') {
    return {
      valid: false,
      errors: ['Execution context is required'],
      warnings: [],
    };
  }

  const ctx = context as Record<string, unknown>;
  const errors: string[] = [];

  if (!ctx['salon_id'] || !isValidSalonId(ctx['salon_id'])) {
    errors.push('Valid salon_id is required in execution context');
  }

  if (!ctx['execution_id'] || typeof ctx['execution_id'] !== 'string') {
    errors.push('Valid execution_id is required in execution context');
  }

  if (!ctx['timestamp'] || !isValidTimestamp(ctx['timestamp'])) {
    errors.push('Valid timestamp is required in execution context');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings: [],
  };
}

export function validateEnvironmentVariables(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const required = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
  ];

  const optional = [
    'GEMINI_API_KEY',
    'DEEPSEEK_API_KEY',
    'ELEVENLABS_API_KEY',
    'WHATSAPP_ACCESS_TOKEN',
    'INSTAGRAM_ACCESS_TOKEN',
  ];

  for (const envVar of required) {
    if (!process.env[envVar]) {
      errors.push(`Required environment variable missing: ${envVar}`);
    }
  }

  for (const envVar of optional) {
    if (!process.env[envVar]) {
      warnings.push(`Optional environment variable missing: ${envVar} (some features may not work)`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// =============================================================================
// SANITIZATION FUNCTIONS
// =============================================================================

export function sanitizeUserInput(input: string): string {
  // Remove potentially harmful characters while preserving useful content
  return input
    .replace(/[<>\"'&]/g, '') // Remove HTML/XML characters
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim()
    .substring(0, 4000); // Limit length
}

export function sanitizePhoneNumber(phone: string): string {
  // Remove all non-digit characters except +
  return phone.replace(/[^\d+]/g, '');
}

export function sanitizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

export function sanitizeInstagramHandle(handle: string): string {
  // Remove @ symbol and ensure valid Instagram username format
  return handle.replace(/^@/, '').replace(/[^a-zA-Z0-9._]/g, '').toLowerCase();
}