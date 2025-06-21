// Test Constants for Enterprise n8n Nodes
// Centralized constants to ensure maintainability and consistency

export const TEST_CONSTANTS = {
  // Valid UUIDs for testing
  SALON_IDS: {
    VALID: '12345678-1234-1234-1234-123456789012',
    VALID_ALT: '87654321-4321-4321-4321-210987654321',
    INVALID: 'invalid-salon-id', // For negative testing
  },
  
  CUSTOMER_IDS: {
    VALID: 'customer-123-456-789',
    VALID_ALT: 'customer-987-654-321',
  },
  
  SERVICE_IDS: {
    HAIRCUT: 'service-haircut-123',
    MASSAGE: 'service-massage-456', 
    MANICURE: 'service-manicure-789',
  },
  
  STAFF_IDS: {
    ALICE: 'staff-alice-123',
    BOB: 'staff-bob-456',
  },
  
  // Expected response messages (aligned with implementation)
  MESSAGES: {
    SERVICE_WINDOW: {
      HIGH_CONFIDENCE: 'High confidence optimization',
      SAFE_TO_DELAY: 'Safe to delay response by',
      URGENT_MESSAGE: 'Urgent customer message - immediate response required',
      HIGH_BOOKING_PROBABILITY: 'Too risky to delay response (risk score:',
      FREE_WINDOW_ACTIVE: 'Already within free messaging window',
    },
    
    AI_ORCHESTRATOR: {
      MODEL_SELECTED: 'AI model selected successfully',
      BUDGET_EXCEEDED: 'Budget constraints exceeded',
      ROUTING_DECISION: 'Model routing completed',
    },
    
    BOOKING_ENGINE: {
      BOOKING_CONFIRMED: 'Booking Confirmed Successfully',
      BOOKING_PENDING: 'Booking created and pending confirmation',
      SERVICE_NOT_FOUND: 'Service not found or unavailable',
      CONFLICT_DETECTED: 'Time slot conflict detected',
    },
    
    SALON_CONTEXT: {
      CONTEXT_LOADED: 'Salon context loaded successfully',
      BUSINESS_HOURS_CHECKED: 'Business hours validated',
      SETTINGS_RETRIEVED: 'Salon settings retrieved',
    },
    
    ERRORS: {
      SALON_NOT_FOUND: 'Salon not found or access denied',
      INVALID_CONTEXT: 'Invalid execution context',
      VALIDATION_FAILED: 'Validation failed',
    },
  },
  
  // Alternative action arrays (for consistent testing)
  ALTERNATIVE_ACTIONS: {
    URGENT_RESPONSE: ['Send immediate response', 'Use personalized template'],
    MANUAL_REVIEW: ['Consider manual review', 'Escalate to staff'],
    OPTIMIZE_LATER: ['Schedule response later', 'Use free messaging when customer replies'],
    BROWSE_SERVICES: ['Browse available services', 'Contact salon directly'],
  },
  
  // Output routing indices
  OUTPUT_INDICES: {
    MAIN: 0,
    SUCCESS: 1,
    CONFLICT: 2,
    ERROR: 3,
    
    // ServiceWindow specific
    OPTIMIZED: 1,
    IMMEDIATE: 2,
    
    // AIOrchestrator specific  
    GEMINI: 1,
    DEEPSEEK: 2,
    ELEVENLABS: 3,
  },
  
  // Test data values
  VALUES: {
    TEMPLATE_COST: 0.05,
    HIGH_BOOKING_PROBABILITY: 0.9,
    MEDIUM_BOOKING_PROBABILITY: 0.5,
    LOW_BOOKING_PROBABILITY: 0.2,
    OPTIMIZATION_CONFIDENCE: 0.8,
    DELAY_MINUTES: {
      SHORT: 30,
      MEDIUM: 60,
      LONG: 120,
    },
  },
} as const;

// Type-safe access to constants
export type TestConstants = typeof TEST_CONSTANTS;