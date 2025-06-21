import { LogLevel, LogEntry, NodePerformanceMetrics } from '@/types';

// =============================================================================
// LOGGER CONFIGURATION
// =============================================================================

interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableDatabase: boolean;
  enableFile: boolean;
  maxMemoryLogs: number;
  includeStack: boolean;
  sensitiveFields: string[];
}

const DEFAULT_CONFIG: LoggerConfig = {
  level: process.env['NODE_ENV'] === 'production' ? 'info' : 'debug',
  enableConsole: true,
  enableDatabase: true,
  enableFile: false,
  maxMemoryLogs: 1000,
  includeStack: true,
  sensitiveFields: [
    'password', 'token', 'api_key', 'secret', 'authorization',
    'whatsapp_access_token', 'instagram_access_token',
    'gemini_api_key', 'deepseek_api_key', 'elevenlabs_api_key'
  ],
};

// =============================================================================
// LOGGER CLASS
// =============================================================================

class Logger {
  private static instance: Logger;
  private config: LoggerConfig;
  private memoryLogs: LogEntry[] = [];
  private performanceMetrics: Map<string, NodePerformanceMetrics> = new Map();

  private constructor(config: Partial<LoggerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  public static getInstance(config?: Partial<LoggerConfig>): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger(config);
    }
    return Logger.instance;
  }

  // =============================================================================
  // CORE LOGGING METHODS
  // =============================================================================

  public debug(message: string, metadata?: Record<string, unknown>, salon_id?: string, execution_id?: string): void {
    this.log('debug', message, metadata, salon_id, execution_id);
  }

  public info(message: string, metadata?: Record<string, unknown>, salon_id?: string, execution_id?: string): void {
    this.log('info', message, metadata, salon_id, execution_id);
  }

  public warn(message: string, metadata?: Record<string, unknown>, salon_id?: string, execution_id?: string): void {
    this.log('warn', message, metadata, salon_id, execution_id);
  }

  public error(message: string, error?: Error, metadata?: Record<string, unknown>, salon_id?: string, execution_id?: string): void {
    const enhancedMetadata = { ...metadata };
    
    if (error) {
      enhancedMetadata['error_name'] = error.name;
      enhancedMetadata['error_message'] = error.message;
      if (this.config.includeStack && error.stack) {
        enhancedMetadata['error_stack'] = error.stack;
      }
    }

    this.log('error', message, enhancedMetadata, salon_id, execution_id);
  }

  // =============================================================================
  // PERFORMANCE TRACKING
  // =============================================================================

  public startTimer(operation_name: string, salon_id?: string): string {
    const timer_id = `${operation_name}_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    
    this.performanceMetrics.set(timer_id, {
      node_name: operation_name,
      execution_time_ms: Date.now(),
      memory_usage_mb: process.memoryUsage().heapUsed / 1024 / 1024,
      database_queries: 0,
      api_calls: 0,
      errors: 0,
      warnings: 0,
      salon_id: salon_id || 'unknown',
      timestamp: new Date().toISOString(),
    });

    return timer_id;
  }

  public endTimer(timer_id: string, additional_metrics?: Partial<NodePerformanceMetrics>): NodePerformanceMetrics | null {
    const metrics = this.performanceMetrics.get(timer_id);
    if (!metrics) {
      this.warn(`Timer not found: ${timer_id}`);
      return null;
    }

    const endTime = Date.now();
    const finalMetrics: NodePerformanceMetrics = {
      ...metrics,
      ...additional_metrics,
      execution_time_ms: endTime - metrics.execution_time_ms,
      memory_usage_mb: process.memoryUsage().heapUsed / 1024 / 1024,
      timestamp: new Date().toISOString(),
    };

    this.performanceMetrics.delete(timer_id);

    // Log performance metrics
    this.info('Performance metrics recorded', finalMetrics, finalMetrics.salon_id);

    // Log performance warnings if needed
    if (finalMetrics.execution_time_ms > 5000) {
      this.warn(`Slow operation detected: ${finalMetrics.node_name} took ${finalMetrics.execution_time_ms}ms`, finalMetrics, finalMetrics.salon_id);
    }

    if (finalMetrics.memory_usage_mb > 100) {
      this.warn(`High memory usage detected: ${finalMetrics.node_name} used ${finalMetrics.memory_usage_mb}MB`, finalMetrics, finalMetrics.salon_id);
    }

    return finalMetrics;
  }

  // =============================================================================
  // BUSINESS LOGIC LOGGING
  // =============================================================================

  public logServiceWindowOptimization(
    salon_id: string,
    conversation_id: string,
    should_optimize: boolean,
    estimated_savings: number,
    reasoning: string,
    execution_id?: string
  ): void {
    this.info('Service window optimization decision', {
      conversation_id,
      should_optimize,
      estimated_savings_euros: estimated_savings,
      reasoning,
      event_type: 'service_window_optimization',
    }, salon_id, execution_id);
  }

  public logAIInteraction(
    salon_id: string,
    model: string,
    input_length: number,
    output_length: number,
    cost_euros: number,
    response_time_ms: number,
    execution_id?: string
  ): void {
    this.info('AI interaction completed', {
      model,
      input_length,
      output_length,
      cost_euros,
      response_time_ms,
      event_type: 'ai_interaction',
    }, salon_id, execution_id);
  }

  public logBookingCreated(
    salon_id: string,
    booking_id: string,
    customer_id: string,
    service_id: string,
    source: string,
    execution_id?: string
  ): void {
    this.info('Booking created successfully', {
      booking_id,
      customer_id,
      service_id,
      source,
      event_type: 'booking_created',
    }, salon_id, execution_id);
  }

  public logWorkflowExecution(
    salon_id: string,
    workflow_name: string,
    execution_time_ms: number,
    success: boolean,
    error_message?: string,
    execution_id?: string
  ): void {
    const level = success ? 'info' : 'error';
    const message = success ? 'Workflow executed successfully' : 'Workflow execution failed';
    
    this.log(level, message, {
      workflow_name,
      execution_time_ms,
      success,
      error_message,
      event_type: 'workflow_execution',
    }, salon_id, execution_id);
  }

  // =============================================================================
  // PRIVATE METHODS
  // =============================================================================

  private log(level: LogLevel, message: string, metadata?: Record<string, unknown>, salon_id?: string, execution_id?: string): void {
    // Check if we should log this level
    if (!this.shouldLog(level)) {
      return;
    }

    const logEntry: LogEntry = {
      level,
      message,
      salon_id,
      execution_id,
      timestamp: new Date().toISOString(),
      metadata: this.sanitizeMetadata(metadata) as any,
    };

    // Console logging
    if (this.config.enableConsole) {
      this.logToConsole(logEntry);
    }

    // Memory logging
    this.addToMemoryLogs(logEntry);

    // Database logging (async, don't wait)
    if (this.config.enableDatabase && salon_id) {
      this.logToDatabase(logEntry).catch((error) => {
        console.error('Failed to log to database:', error);
      });
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    const currentLevelIndex = levels.indexOf(this.config.level);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex >= currentLevelIndex;
  }

  private sanitizeMetadata(metadata?: Record<string, unknown>): Record<string, unknown> | undefined {
    if (!metadata) {
      return undefined;
    }

    const sanitized = { ...metadata };
    
    for (const field of this.config.sensitiveFields) {
      if (field in sanitized) {
        sanitized[field] = '[REDACTED]';
      }
    }

    return sanitized;
  }

  private logToConsole(entry: LogEntry): void {
    const timestamp = entry.timestamp;
    const prefix = `[${timestamp}] [${entry.level.toUpperCase()}]`;
    const suffix = entry.salon_id ? `[salon:${entry.salon_id}]` : '';
    const message = `${prefix} ${entry.message} ${suffix}`;

    switch (entry.level) {
      case 'debug':
        console.debug(message, entry.metadata);
        break;
      case 'info':
        console.log(message, entry.metadata);
        break;
      case 'warn':
        console.warn(message, entry.metadata);
        break;
      case 'error':
        console.error(message, entry.metadata);
        break;
    }
  }

  private addToMemoryLogs(entry: LogEntry): void {
    this.memoryLogs.push(entry);
    
    // Keep only the most recent logs
    if (this.memoryLogs.length > this.config.maxMemoryLogs) {
      this.memoryLogs = this.memoryLogs.slice(-this.config.maxMemoryLogs);
    }
  }

  private async logToDatabase(entry: LogEntry): Promise<void> {
    try {
      // Import here to avoid circular dependencies
      const { executeDatabaseOperation } = await import('./database');

      await executeDatabaseOperation({
        type: 'insert',
        table: 'analytics_events',
        salon_id: entry.salon_id!,
        data: {
          salon_id: entry.salon_id!,
          event_type: 'log_entry',
          event_data: {
            level: entry.level,
            message: entry.message,
            execution_id: entry.execution_id,
            metadata: entry.metadata,
          },
          created_at: entry.timestamp,
        },
      });
    } catch (error) {
      // Don't throw here to avoid infinite logging loops
      console.error('Failed to log to database:', error);
    }
  }

  // =============================================================================
  // PUBLIC UTILITY METHODS
  // =============================================================================

  public getRecentLogs(limit: number = 100): LogEntry[] {
    return this.memoryLogs.slice(-limit);
  }

  public getLogsByLevel(level: LogLevel, limit: number = 100): LogEntry[] {
    return this.memoryLogs.filter(log => log.level === level).slice(-limit);
  }

  public getLogsBySalon(salon_id: string, limit: number = 100): LogEntry[] {
    return this.memoryLogs.filter(log => log.salon_id === salon_id).slice(-limit);
  }

  public clearMemoryLogs(): void {
    this.memoryLogs = [];
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

export const logger = Logger.getInstance();

// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================

export function logDebug(message: string, metadata?: Record<string, unknown>, salon_id?: string, execution_id?: string): void {
  logger.debug(message, metadata, salon_id, execution_id);
}

export function logInfo(message: string, metadata?: Record<string, unknown>, salon_id?: string, execution_id?: string): void {
  logger.info(message, metadata, salon_id, execution_id);
}

export function logWarn(message: string, metadata?: Record<string, unknown>, salon_id?: string, execution_id?: string): void {
  logger.warn(message, metadata, salon_id, execution_id);
}

export function logError(message: string, error?: Error, metadata?: Record<string, unknown>, salon_id?: string, execution_id?: string): void {
  logger.error(message, error, metadata, salon_id, execution_id);
}

export function startPerformanceTimer(operation_name: string, salon_id?: string): string {
  return logger.startTimer(operation_name, salon_id);
}

export function endPerformanceTimer(timer_id: string, additional_metrics?: Partial<NodePerformanceMetrics>): NodePerformanceMetrics | null {
  return logger.endTimer(timer_id, additional_metrics);
}

// =============================================================================
// BUSINESS LOGIC LOGGING HELPERS
// =============================================================================

export function logServiceWindowOptimization(
  salon_id: string,
  conversation_id: string,
  should_optimize: boolean,
  estimated_savings: number,
  reasoning: string,
  execution_id?: string
): void {
  logger.logServiceWindowOptimization(salon_id, conversation_id, should_optimize, estimated_savings, reasoning, execution_id);
}

export function logAIInteraction(
  salon_id: string,
  model: string,
  input_length: number,
  output_length: number,
  cost_euros: number,
  response_time_ms: number,
  execution_id?: string
): void {
  logger.logAIInteraction(salon_id, model, input_length, output_length, cost_euros, response_time_ms, execution_id);
}

export function logBookingCreated(
  salon_id: string,
  booking_id: string,
  customer_id: string,
  service_id: string,
  source: string,
  execution_id?: string
): void {
  logger.logBookingCreated(salon_id, booking_id, customer_id, service_id, source, execution_id);
}

export function logWorkflowExecution(
  salon_id: string,
  workflow_name: string,
  execution_time_ms: number,
  success: boolean,
  error_message?: string,
  execution_id?: string
): void {
  logger.logWorkflowExecution(salon_id, workflow_name, execution_time_ms, success, error_message, execution_id);
}

export function logAIModelUsage(
  salon_id: string,
  conversation_id: string,
  model: string,
  cost_euros: number,
  execution_id?: string
): void {
  logger.logAIInteraction(salon_id, model, 0, 0, cost_euros, 0, execution_id);
  // Log conversation context
  logger.debug(`AI model usage for conversation ${conversation_id}`, { model, cost_euros }, salon_id, execution_id);
}