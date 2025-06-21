import { IDataObject, INodeExecutionData } from 'n8n-workflow';

// =============================================================================
// CORE BUSINESS TYPES
// =============================================================================

export interface SalonData {
  id: string;
  business_name: string;
  owner_name: string;
  email: string;
  phone: string;
  whatsapp_number?: string;
  instagram_handle?: string;
  address: {
    street: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
  };
  timezone: string;
  subscription_tier: 'professional' | 'enterprise';
  subscription_status: string;
  settings: SalonSettings;
  metadata: IDataObject;
  created_at: string;
  updated_at: string;
}

export interface SalonSettings {
  business_hours: BusinessHours;
  booking_preferences: BookingPreferences;
  whatsapp_settings: WhatsAppSettings;
  ai_settings: AISettings;
  notification_preferences: NotificationPreferences;
}

export interface BusinessHours {
  [day: string]: {
    is_open: boolean;
    open_time?: string; // HH:mm format
    close_time?: string; // HH:mm format
    breaks?: Array<{
      start_time: string;
      end_time: string;
      description?: string;
    }>;
  };
}

export interface BookingPreferences {
  advance_booking_days: number;
  minimum_notice_minutes: number;
  cancellation_policy_hours: number;
  auto_confirm_bookings: boolean;
  require_deposit: boolean;
  deposit_percentage: number;
}

export interface MessageTemplate {
  id: string;
  name: string;
  content: string;
  language: string;
  status: string;
}

export interface WhatsAppSettings {
  enabled: boolean;
  phone_number_id: string;
  access_token: string;
  webhook_verify_token: string;
  business_account_id: string;
  message_templates: Record<string, MessageTemplate>;
  service_window_settings: ServiceWindowSettings;
}

export interface ServiceWindowSettings {
  enabled: boolean;
  cost_threshold_euros: number; // When to trigger optimization
  template_cost_euros: number; // Cost per template message
  free_window_hours: number; // Hours after last message when response is free
  max_optimization_percentage: number; // Max % of conversations to optimize
}

export interface AISettings {
  gemini_enabled: boolean;
  deepseek_enabled: boolean;
  elevenlabs_enabled: boolean;
  preferred_language: string;
  fallback_language: string;
  confidence_threshold: number;
  cost_budget_monthly_euros: number;
}

export interface NotificationPreferences {
  email_notifications: boolean;
  sms_notifications: boolean;
  slack_webhook?: string;
  notification_types: string[];
}

// =============================================================================
// SERVICE WINDOW OPTIMIZATION TYPES
// =============================================================================

export interface ServiceWindow {
  id: string;
  salon_id: string;
  staff_member_id: string;
  start_time: string;
  end_time: string;
  status: 'available' | 'reserved' | 'booked' | 'blocked';
  booking_id?: string;
  price_adjustment: number;
  metadata: ServiceWindowMetadata;
}

export interface ServiceWindowMetadata {
  cost_optimization_applied?: boolean;
  estimated_savings_euros?: number;
  optimization_reason?: string;
  original_response_time?: string;
  delayed_response_time?: string;
}

export interface ServiceWindowOptimizationResult {
  should_optimize: boolean;
  delay_minutes: number;
  estimated_savings_euros: number;
  optimization_confidence: number;
  reasoning: string;
  alternative_actions?: string[];
}

export interface ConversationContext {
  id: string;
  salon_id: string;
  customer_id?: string;
  channel: 'whatsapp' | 'instagram' | 'web';
  external_id: string;
  status: 'active' | 'resolved' | 'escalated' | 'archived';
  last_message_at?: string;
  message_count: number;
  customer_sentiment: 'positive' | 'neutral' | 'negative' | 'unknown';
  intent_detected?: string;
  booking_probability: number; // 0-1 scale
}

// =============================================================================
// AI ORCHESTRATION TYPES
// =============================================================================

export type AIModelType = 'gemini_flash' | 'deepseek_r1' | 'elevenlabs';

export interface AIModelRequest {
  salon_id: string;
  conversation_id: string;
  message_content: string;
  request_type: 'general_inquiry' | 'booking_request' | 'complex_problem_solving' | 'voice_response';
  response_priority: 'speed' | 'quality' | 'balanced';
  budget_constraints?: {
    max_cost_euros: number;
    enforce_limit: boolean;
  };
}

export interface AIModelResponse {
  model_used: AIModelType;
  response_content: string;
  confidence_score: number;
  processing_time_ms: number;
  cost_euros: number;
  token_usage: {
    input: number;
    output: number;
  };
  error?: string;
}


export interface AIRequest {
  model: 'gemini-flash' | 'deepseek-r1' | 'elevenlabs';
  salon_id: string;
  conversation_id: string;
  message_content: string;
  message_type: 'text' | 'image' | 'voice';
  context: ConversationContext;
  salon_data: SalonData;
  intent_hint?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
}

export interface AIResponse {
  success: boolean;
  response_text?: string;
  response_audio_url?: string;
  confidence: number;
  intent_detected?: string;
  suggested_actions?: string[];
  booking_intent?: BookingIntent;
  cost_euros: number;
  processing_time_ms: number;
  model_used: string;
  error_message?: string;
}

// =============================================================================
// PREMIUM AI ORCHESTRATION TYPES
// =============================================================================

export interface AIModelSelection {
  selected_model: AIModelType;
  confidence_score: number;
  reasoning: string;
  estimated_cost_euros: number;
  capabilities?: any;
  model_capabilities?: {
    strengths: string[];
    limitations: string[];
    use_cases: string[];
  };
  performance_metrics?: any;
  cost_optimization?: any;
  alternatives?: any[];
  ensemble_available?: boolean;
  optimization_mode?: string;
  conversation_analysis?: any;
}

export interface PerformanceMetrics {
  response_time_ms: number;
  accuracy: number;
  cost_efficiency: number;
  customer_satisfaction: number;
  [key: string]: unknown;
}

export interface BookingIntent {
  detected: boolean;
  confidence: number;
  preferred_service?: string;
  preferred_date?: string;
  preferred_time?: string;
  preferred_staff?: string;
  customer_notes?: string;
}

// =============================================================================
// BOOKING ENGINE TYPES
// =============================================================================

export interface BookingRequest {
  salon_id: string;
  customer_id: string;
  service_id: string;
  staff_member_id?: string;
  preferred_date: string;
  preferred_time?: string;
  duration_minutes: number;
  notes?: string;
  source: 'whatsapp' | 'instagram' | 'web' | 'manual';
}

export interface BookingResult {
  success: boolean;
  booking_id?: string;
  scheduled_time?: string;
  alternative_slots?: TimeSlot[];
  conflict_reason?: string;
  calendar_event_id?: string;
  confirmation_message: string;
  next_actions: string[];
}

export interface TimeSlot {
  start_time: string;
  end_time: string;
  staff_member_id: string;
  staff_member_name: string;
  price: number;
  availability_confidence: number;
}

export interface CalendarConflict {
  type: 'existing_booking' | 'staff_unavailable' | 'outside_hours' | 'too_short_notice';
  description: string;
  conflicting_booking_id?: string;
  suggested_resolution?: string;
}

// =============================================================================
// N8N NODE INTERFACES
// =============================================================================

export interface NodeExecutionContext {
  salon_id: string;
  user_id?: string;
  conversation_id?: string;
  execution_id: string;
  timestamp: string;
  debug_mode: boolean;
  node_id?: string;
  [key: string]: unknown;
}

export interface GeminiSalonNodeData extends INodeExecutionData {
  json: IDataObject & {
    salon_id: string;
    execution_context: NodeExecutionContext;
    [key: string]: unknown;
  };
}

export interface ErrorResponse {
  error: true;
  error_code: string;
  error_message: string;
  error_details?: Record<string, unknown>;
  timestamp: string;
  execution_id: string;
  [key: string]: unknown;
}

// =============================================================================
// DATABASE OPERATION TYPES
// =============================================================================

export interface DatabaseOperation {
  type: 'select' | 'insert' | 'update' | 'delete' | 'upsert';
  table: string;
  salon_id: string;
  data?: IDataObject;
  filters?: IDataObject;
  options?: {
    limit?: number;
    offset?: number;
    order_by?: string;
    include_deleted?: boolean;
    select?: string;
  };
}

export interface DatabaseResult {
  success: boolean;
  data?: unknown;
  error?: string;
  affected_rows?: number;
  execution_time_ms: number;
}

// =============================================================================
// PERFORMANCE MONITORING TYPES
// =============================================================================

export interface NodePerformanceMetrics {
  node_name: string;
  execution_time_ms: number;
  memory_usage_mb: number;
  database_queries: number;
  api_calls: number;
  errors: number;
  warnings: number;
  salon_id: string;
  timestamp: string;
  [key: string]: unknown;
}

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  response_time_ms: number;
  database_connected: boolean;
  apis_accessible: boolean;
  last_error?: string;
  uptime_seconds: number;
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  level: LogLevel;
  message: string;
  salon_id?: string;
  execution_id?: string;
  timestamp: string;
  metadata?: IDataObject;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// =============================================================================
// TYPE GUARDS
// =============================================================================

export function isValidSalonId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.includes('-');
}

export function isValidTimestamp(value: unknown): value is string {
  return typeof value === 'string' && !isNaN(Date.parse(value));
}

export function isServiceWindowOptimizationResult(
  value: unknown
): value is ServiceWindowOptimizationResult {
  return (
    typeof value === 'object' &&
    value !== null &&
    'should_optimize' in value &&
    'delay_minutes' in value &&
    'estimated_savings_euros' in value
  );
}

export function isAIResponse(value: unknown): value is AIResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    'success' in value &&
    'confidence' in value &&
    'cost_euros' in value
  );
}

export function isBookingResult(value: unknown): value is BookingResult {
  return (
    typeof value === 'object' &&
    value !== null &&
    'success' in value &&
    'confirmation_message' in value
  );
}