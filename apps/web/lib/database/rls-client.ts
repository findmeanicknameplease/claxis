// Database client with Row-Level Security support
// Phase 1C: API Integration

import { Pool } from 'pg';

interface DatabaseConfig {
  connectionString: string;
  ssl?: boolean;
}

export class RLSClient {
  private pool: Pool;

  constructor(config: DatabaseConfig) {
    this.pool = new Pool({
      connectionString: config.connectionString,
      ssl: config.ssl === true ? { rejectUnauthorized: false } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    // Handle pool errors
    this.pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
    });
  }

  /**
   * Execute query with tenant context for RLS
   * @param salonId - Salon UUID for tenant isolation
   * @param query - SQL query string
   * @param params - Query parameters
   */
  async queryWithTenant<T = Record<string, unknown>>(
    salonId: string, 
    query: string, 
    params?: unknown[]
  ): Promise<T[]> {
    const client = await this.pool.connect();
    
    try {
      // Start transaction and set tenant context
      await client.query('BEGIN');
      await client.query('SET LOCAL app.current_salon_id = $1', [salonId]);
      
      // Execute the actual query (RLS policies will automatically filter)
      const result = await client.query(query, params);
      
      await client.query('COMMIT');
      return result.rows as T[];
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Execute multiple queries in a single transaction with tenant context
   */
  async transactionWithTenant<T = Record<string, unknown>>(
    salonId: string,
    queries: { query: string; params?: unknown[] }[]
  ): Promise<T[][]> {
    const client = await this.pool.connect();
    
    try {
      // Start transaction and set tenant context
      await client.query('BEGIN');
      await client.query('SET LOCAL app.current_salon_id = $1', [salonId]);
      
      const results: T[][] = [];
      
      for (const { query, params } of queries) {
        const result = await client.query(query, params);
        results.push(result.rows as T[]);
      }
      
      await client.query('COMMIT');
      return results;
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Insert data with automatic salon_id injection
   */
  async insertWithTenant(
    salonId: string,
    table: string,
    data: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const columns = Object.keys(data);
    const values = Object.values(data);
    const placeholders = values.map((_, index) => `$${index + 2}`).join(', ');
    
    const query = `
      INSERT INTO ${table} (salon_id, ${columns.join(', ')})
      VALUES ($1, ${placeholders})
      RETURNING *
    `;
    
    const result = await this.queryWithTenant(salonId, query, [salonId, ...values]);
    return result[0] ?? {};
  }

  /**
   * Update data with tenant context
   */
  async updateWithTenant(
    salonId: string,
    table: string,
    data: Record<string, unknown>,
    where: string,
    whereParams: unknown[] = []
  ): Promise<Record<string, unknown>[]> {
    const updates = Object.keys(data)
      .map((key, index) => `${key} = $${index + 2}`)
      .join(', ');
    
    const query = `
      UPDATE ${table} 
      SET ${updates}, updated_at = now()
      WHERE ${where}
      RETURNING *
    `;
    
    return await this.queryWithTenant(
      salonId, 
      query, 
      [salonId, ...Object.values(data), ...whereParams]
    );
  }

  /**
   * Get health status
   */
  async getHealth(): Promise<{ connected: boolean; pool_stats: Record<string, number> }> {
    try {
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();
      
      return {
        connected: true,
        pool_stats: {
          total_count: this.pool.totalCount,
          idle_count: this.pool.idleCount,
          waiting_count: this.pool.waitingCount
        }
      };
    } catch (error) {
      return {
        connected: false,
        pool_stats: {
          total_count: 0,
          idle_count: 0,
          waiting_count: 0
        }
      };
    }
  }

  /**
   * Close all connections
   */
  async close(): Promise<void> {
    await this.pool.end();
  }
}

// Singleton instance
let dbClient: RLSClient | null = null;

export function getDatabase(): RLSClient {
  if (dbClient === null) {
    const connectionString = process.env['DATABASE_URL'];
    if (!connectionString || connectionString.length === 0) {
      throw new Error('DATABASE_URL environment variable is required');
    }
    
    dbClient = new RLSClient({
      connectionString,
      ssl: process.env.NODE_ENV === 'production'
    });
  }
  return dbClient;
}