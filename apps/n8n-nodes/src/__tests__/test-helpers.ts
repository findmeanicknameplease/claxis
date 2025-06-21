// Test Helpers for Enterprise n8n Nodes
// Builders and utilities for maintainable, enterprise-grade testing

import { IExecuteFunctions } from 'n8n-workflow';
import { SalonData } from '../types';
import { TEST_CONSTANTS } from './constants';

/**
 * Creates a mock IExecuteFunctions for testing
 * Enterprise-grade mock with all required methods
 */
export function createMockExecuteFunctions(
  nodeParameters: Record<string, any> = {},
  inputData: any[] = [{ json: {} }]
): jest.Mocked<IExecuteFunctions> {
  return {
    getInputData: jest.fn().mockReturnValue(inputData),
    getNodeParameter: jest.fn().mockImplementation((paramName: string, itemIndex = 0) => {
      return nodeParameters[paramName] || '';
    }),
    getExecutionId: jest.fn().mockReturnValue('exec-test-123'),
    getMode: jest.fn().mockReturnValue('manual'),
    getNode: jest.fn().mockReturnValue({
      id: 'test-node-id',
      name: 'Test Node',
      type: 'testNode',
    }),
  } as unknown as jest.Mocked<IExecuteFunctions>;
}

/**
 * Creates mock salon data for testing
 * Follows the exact structure expected by production
 */
export function createMockSalonData(overrides: Partial<SalonData> = {}): SalonData {
  return {
    id: TEST_CONSTANTS.SALON_IDS.VALID,
    business_name: 'Test Salon Premium',
    owner_name: 'John Doe',
    email: 'john@testsalon.com',
    phone: '+49123456789',
    whatsapp_number: '+49123456789',
    instagram_handle: 'testsalon_premium',
    address: {
      street: '123 Friedrichstraße',
      city: 'Berlin',
      state: 'Berlin',
      postal_code: '10117',
      country: 'DE',
    },
    timezone: 'Europe/Berlin',
    subscription_tier: 'professional',
    subscription_status: 'active',
    settings: {
      business_hours: {
        monday: { is_open: true, open_time: '09:00', close_time: '18:00' },
        tuesday: { is_open: true, open_time: '09:00', close_time: '18:00' },
        wednesday: { is_open: true, open_time: '09:00', close_time: '18:00' },
        thursday: { is_open: true, open_time: '09:00', close_time: '18:00' },
        friday: { is_open: true, open_time: '09:00', close_time: '18:00' },
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
          template_cost_euros: TEST_CONSTANTS.VALUES.TEMPLATE_COST,
          free_window_hours: 24,
          max_optimization_percentage: 80,
        },
      },
      ai_settings: {
        gemini_enabled: true,
        deepseek_enabled: true,
        elevenlabs_enabled: false,
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
    ...overrides,
  };
}

/**
 * Creates mock conversation context for ServiceWindow testing
 */
export function createMockConversationContext(overrides: any = {}) {
  return {
    salon_id: TEST_CONSTANTS.SALON_IDS.VALID,
    customer_phone: '+49987654321',
    conversation_id: 'conv-test-123',
    id: 'conv-test-123',
    last_message_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 minutes ago
    channel: 'whatsapp',
    status: 'active',
    ...overrides,
  };
}

/**
 * Creates standard node parameters for testing
 */
export function createNodeParameters(operation: string, additionalParams: Record<string, any> = {}) {
  const baseParams = {
    operation,
    salonId: TEST_CONSTANTS.SALON_IDS.VALID,
  };
  
  return { ...baseParams, ...additionalParams };
}

/**
 * Validates multiple output structure
 * Ensures enterprise-grade output validation
 */
export function validateMultipleOutputs(
  result: any[], 
  expectedOutputCount: number,
  expectedActiveOutput: number,
  expectedDataLength = 1
) {
  // Validate output array structure
  expect(result).toHaveLength(expectedOutputCount);
  expect(Array.isArray(result)).toBe(true);
  
  // Validate each output is an array
  result.forEach((output, index) => {
    expect(Array.isArray(output)).toBe(true);
  });
  
  // Validate active output has data
  expect(result[expectedActiveOutput]).toHaveLength(expectedDataLength);
  
  // Validate other outputs are empty
  result.forEach((output, index) => {
    if (index !== expectedActiveOutput) {
      expect(output).toHaveLength(0);
    }
  });
  
  return result[expectedActiveOutput][0]; // Return the active output data
}

/**
 * Database operation mock responses
 * Standardized for consistent testing
 */
export const MOCK_DB_RESPONSES = {
  SERVICE_FOUND: {
    success: true,
    data: {
      id: TEST_CONSTANTS.SERVICE_IDS.HAIRCUT,
      name: 'Premium Haircut',
      duration_minutes: 60,
      price: 45.00,
      category: 'hair',
    },
  },
  
  SERVICE_NOT_FOUND: {
    success: true,
    data: [],
  },
  
  BOOKING_CREATED: {
    success: true,
    affected_rows: 1,
  },
  
  NO_CONFLICTS: {
    success: true,
    data: [],
  },
  
  SALON_SETTINGS_UPDATED: {
    success: true,
    affected_rows: 1,
  },
} as const;

/**
 * Error assertion helper for negative testing
 */
export function expectNodeOperationError(fn: () => Promise<any>, expectedMessage: string) {
  return expect(fn()).rejects.toThrow(expectedMessage);
}

/**
 * Performance timer mock for consistent testing
 */
export function createMockPerformanceTimer() {
  return 'timer-test-123';
}