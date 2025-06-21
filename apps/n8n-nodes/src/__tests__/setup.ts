// Jest test setup file for n8n custom nodes
// This file is executed before each test file

// Extend Jest matchers
expect.extend({
  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () =>
          `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      };
    }
  },
});

// Global test constants
global.TEST_SALON_ID = '12345678-1234-1234-1234-123456789012';
global.TEST_CONVERSATION_ID = '98765432-1234-1234-1234-123456789012';
global.TEST_CUSTOMER_ID = '11111111-1111-1111-1111-111111111111';
global.TEST_EXECUTION_ID = 'exec-123';

// Global test utilities
global.createMockSalonData = () => ({
  id: global.TEST_SALON_ID,
  business_name: 'Test Salon',
  owner_name: 'John Doe',
  email: 'john@testsalon.com',
  phone: '+1234567890',
  whatsapp_number: '+1234567890',
  instagram_handle: 'testsalon',
  address: {
    street: '123 Test Street',
    city: 'Test City',
    state: 'Test State',
    postal_code: '12345',
    country: 'DE',
  },
  timezone: 'Europe/Berlin',
  subscription_tier: 'professional' as const,
  subscription_status: 'active' as const,
  settings: {
    business_hours: {
      monday: { is_open: true, open_time: '09:00', close_time: '17:00' },
      tuesday: { is_open: true, open_time: '09:00', close_time: '17:00' },
      wednesday: { is_open: true, open_time: '09:00', close_time: '17:00' },
      thursday: { is_open: true, open_time: '09:00', close_time: '17:00' },
      friday: { is_open: true, open_time: '09:00', close_time: '17:00' },
      saturday: { is_open: true, open_time: '10:00', close_time: '16:00' },
      sunday: { is_open: false },
    },
    booking_preferences: {
      advance_booking_days: 30,
      minimum_notice_minutes: 120,
      cancellation_policy_hours: 24,
      auto_confirm_bookings: true,
      require_deposit: false,
      deposit_percentage: 0,
    },
    whatsapp_settings: {
      enabled: true,
      phone_number_id: 'test_phone_id',
      access_token: 'test_access_token',
      webhook_verify_token: 'test_verify_token',
      business_account_id: 'test_business_id',
      message_templates: {},
      service_window_settings: {
        enabled: true,
        cost_threshold_euros: 0.10,
        template_cost_euros: 0.05,
        free_window_hours: 24,
        max_optimization_percentage: 80,
      },
    },
    ai_settings: {
      gemini_enabled: true,
      deepseek_enabled: true,
      elevenlabs_enabled: true,
      preferred_language: 'de',
      fallback_language: 'en',
      confidence_threshold: 0.8,
      cost_budget_monthly_euros: 100,
    },
    notification_preferences: {
      email_notifications: true,
      sms_notifications: false,
      notification_types: ['booking_created', 'booking_cancelled'],
    },
  },
  metadata: {},
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
});

global.createMockConversationContext = () => ({
  id: global.TEST_CONVERSATION_ID,
  salon_id: global.TEST_SALON_ID,
  customer_id: global.TEST_CUSTOMER_ID,
  channel: 'whatsapp' as const,
  external_id: 'whatsapp_123456',
  status: 'active' as const,
  last_message_at: new Date().toISOString(),
  message_count: 3,
  customer_sentiment: 'neutral' as const,
  intent_detected: 'general_inquiry',
  booking_probability: 0.3,
});

// Set up console mocking for cleaner test output
const originalConsole = { ...console };

global.mockConsole = () => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'info').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
};

global.restoreConsole = () => {
  Object.assign(console, originalConsole);
  jest.restoreAllMocks();
};

// Set up environment variables for testing
process.env['NODE_ENV'] = 'test';
process.env['SUPABASE_URL'] = 'https://test.supabase.co';
process.env['SUPABASE_ANON_KEY'] = 'test-anon-key';
process.env['SUPABASE_SERVICE_ROLE_KEY'] = 'test-service-role-key';

// Mock timers setup
global.setupMockTimers = () => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2024-06-17T12:00:00Z'));
};

global.teardownMockTimers = () => {
  jest.useRealTimers();
};

// Cleanup function to be called after each test
global.cleanupTest = () => {
  jest.clearAllMocks();
  global.restoreConsole();
  global.teardownMockTimers();
};

// Type definitions for global test utilities
declare global {
  var TEST_SALON_ID: string;
  var TEST_CONVERSATION_ID: string;
  var TEST_CUSTOMER_ID: string;
  var TEST_EXECUTION_ID: string;
  var createMockSalonData: () => any;
  var createMockConversationContext: () => any;
  var mockConsole: () => void;
  var restoreConsole: () => void;
  var setupMockTimers: () => void;
  var teardownMockTimers: () => void;
  var cleanupTest: () => void;

  namespace jest {
    interface Matchers<R> {
      toBeWithinRange(floor: number, ceiling: number): R;
    }
  }
}

export {};