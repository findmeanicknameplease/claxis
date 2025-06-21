import { createClient, SupabaseClient, PostgrestResponse } from '@supabase/supabase-js';
import { PostgrestFilterBuilder } from '@supabase/postgrest-js';
import { 
  DatabaseOperation, 
  DatabaseResult, 
  SalonData,
  ValidationResult,
  isValidSalonId 
} from '@/types';

// =============================================================================
// DATABASE CLIENT SINGLETON
// =============================================================================

class DatabaseManager {
  private static instance: DatabaseManager;
  private client: SupabaseClient | null = null;
  private isInitialized = false;

  private constructor() {}

  public static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  public initialize(supabaseUrl: string, supabaseKey: string): void {
    if (this.isInitialized) {
      return;
    }

    this.client = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        headers: {
          'X-Client-Info': 'gemini-salon-n8n-nodes',
        },
      },
      db: {
        schema: 'public',
      },
    });

    this.isInitialized = true;
  }

  public getClient(): SupabaseClient {
    if (!this.client || !this.isInitialized) {
      throw new Error('Database client not initialized. Call initialize() first.');
    }
    return this.client;
  }

  public isConnected(): boolean {
    return this.isInitialized && this.client !== null;
  }
}

// =============================================================================
// DATABASE OPERATIONS
// =============================================================================

export async function executeDatabaseOperation(
  operation: DatabaseOperation
): Promise<DatabaseResult> {
  const startTime = Date.now();
  
  try {
    validateDatabaseOperation(operation);
    
    const db = DatabaseManager.getInstance().getClient();
    const { type, table, salon_id, data, filters, options } = operation;

    // Ensure salon_id is included in all operations for RLS
    const enhancedFilters = { ...filters, salon_id };
    const enhancedData = data ? { ...data, salon_id } : undefined;

    // This variable will hold the final, awaitable query
    // PostgrestFilterBuilder is the common "thenable" type returned by select, insert, update, etc.
    let finalQuery: PostgrestFilterBuilder<any, any, any>;
    const baseQuery = db.from(table);

    switch (type) {
      case 'select': {
        // Start the query chain within this block's scope
        let queryBuilder = baseQuery.select(options?.select ?? '*');

        Object.entries(enhancedFilters).forEach(([key, value]) => {
          // .eq() is available on PostgrestFilterBuilder
          queryBuilder = queryBuilder.eq(key, value as any);
        });

        if (options?.limit) {
          queryBuilder = queryBuilder.limit(options.limit);
        }
        if (options?.offset) {
          const limit = options.limit ?? 10;
          queryBuilder = queryBuilder.range(options.offset, options.offset + limit - 1);
        }
        if (options?.order_by) {
          queryBuilder = queryBuilder.order(options.order_by);
        }
        
        // Assign the fully constructed builder to finalQuery
        finalQuery = queryBuilder;
        break;
      }

      case 'insert': {
        if (!enhancedData) throw new Error('Insert operation requires data');
        // The insert chain returns a PostgrestTransformBuilder, cast to expected type
        finalQuery = baseQuery.insert(enhancedData).select(options?.select ?? '*') as any;
        break;
      }

      case 'update': {
        if (!enhancedData) throw new Error('Update operation requires data');
        
        // Start the update chain, which returns a PostgrestFilterBuilder
        let queryBuilder = baseQuery.update(enhancedData);
        
        Object.entries(enhancedFilters).forEach(([key, value]) => {
          queryBuilder = queryBuilder.eq(key, value as any);
        });

        // Chain .select() to get the results and assign
        finalQuery = queryBuilder.select(options?.select ?? '*') as any;
        break;
      }

      case 'upsert': {
        if (!enhancedData) throw new Error('Upsert operation requires data');
        finalQuery = baseQuery.upsert(enhancedData).select(options?.select ?? '*') as any;
        break;
      }

      case 'delete': {
        let queryBuilder = baseQuery.delete();
        
        Object.entries(enhancedFilters).forEach(([key, value]) => {
          queryBuilder = queryBuilder.eq(key, value as any);
        });
        
        finalQuery = queryBuilder;
        break;
      }

      default:
        throw new Error(`Unsupported operation type: ${type}`);
    }

    const response: PostgrestResponse<any> = await finalQuery;
    const { data: result, error, count } = response;

    if (error) {
      throw new Error(`Database operation failed: ${error.message}`);
    }

    const executionTime = Date.now() - startTime;

    return {
      success: true,
      data: result,
      affected_rows: count ?? (result ? (Array.isArray(result) ? result.length : 1) : 0),
      execution_time_ms: executionTime,
    };

  } catch (error) {
    const executionTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown database error';

    return {
      success: false,
      error: errorMessage,
      execution_time_ms: executionTime,
    };
  }
}

// =============================================================================
// SALON-SPECIFIC OPERATIONS
// =============================================================================

export async function getSalonData(salon_id: string): Promise<SalonData | null> {
  if (!isValidSalonId(salon_id)) {
    throw new Error('Invalid salon_id format');
  }

  const result = await executeDatabaseOperation({
    type: 'select',
    table: 'salons',
    salon_id,
    filters: { id: salon_id },
    options: { limit: 1 },
  });

  if (!result.success || !result.data) {
    return null;
  }

  const salons = Array.isArray(result.data) ? result.data : [result.data];
  return salons.length > 0 ? salons[0] as SalonData : null;
}

export async function updateSalonSettings(
  salon_id: string, 
  settings: Partial<SalonData['settings']>
): Promise<boolean> {
  if (!isValidSalonId(salon_id)) {
    throw new Error('Invalid salon_id format');
  }

  const result = await executeDatabaseOperation({
    type: 'update',
    table: 'salons',
    salon_id,
    data: { settings },
    filters: { id: salon_id },
  });

  return result.success;
}

export async function logAnalyticsEvent(
  salon_id: string,
  event_type: string,
  event_data: Record<string, unknown>
): Promise<boolean> {
  if (!isValidSalonId(salon_id)) {
    throw new Error('Invalid salon_id format');
  }

  const result = await executeDatabaseOperation({
    type: 'insert',
    table: 'analytics_events',
    salon_id,
    data: {
      salon_id,
      event_type,
      event_data,
      created_at: new Date().toISOString(),
    },
  });

  return result.success;
}

// =============================================================================
// HEALTH CHECK OPERATIONS
// =============================================================================

export async function checkDatabaseHealth(): Promise<{
  connected: boolean;
  response_time_ms: number;
  error?: string;
}> {
  const startTime = Date.now();

  try {
    const db = DatabaseManager.getInstance().getClient();
    
    // Simple health check query
    const { error } = await db
      .from('salons')
      .select('id')
      .limit(1);

    const responseTime = Date.now() - startTime;

    if (error) {
      return {
        connected: false,
        response_time_ms: responseTime,
        error: error.message,
      };
    }

    return {
      connected: true,
      response_time_ms: responseTime,
    };

  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return {
      connected: false,
      response_time_ms: responseTime,
      error: errorMessage,
    };
  }
}

// =============================================================================
// VALIDATION HELPERS
// =============================================================================

function validateDatabaseOperation(operation: DatabaseOperation): ValidationResult {
  const errors: string[] = [];
  
  if (!operation.type) {
    errors.push('Operation type is required');
  }

  if (!operation.table) {
    errors.push('Table name is required');
  }

  if (!operation.salon_id || !isValidSalonId(operation.salon_id)) {
    errors.push('Valid salon_id is required');
  }

  if ((operation.type === 'insert' || operation.type === 'update' || operation.type === 'upsert') && !operation.data) {
    errors.push(`Data is required for ${operation.type} operations`);
  }

  if (errors.length > 0) {
    throw new Error(`Invalid database operation: ${errors.join(', ')}`);
  }

  return {
    valid: true,
    errors: [],
    warnings: [],
  };
}

// =============================================================================
// INITIALIZATION HELPER
// =============================================================================

export function initializeDatabase(): void {
  const supabaseUrl = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const supabaseKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase configuration missing. Check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.');
  }

  DatabaseManager.getInstance().initialize(supabaseUrl, supabaseKey);
}

export function isDatabaseInitialized(): boolean {
  return DatabaseManager.getInstance().isConnected();
}