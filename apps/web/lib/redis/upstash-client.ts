import { Redis } from '@upstash/redis';
import { config } from '@/lib/config';

// =============================================================================
// UPSTASH REDIS CLIENT - REST API Optimized
// =============================================================================
// Premium Upstash client for high-performance, low-latency operations
// Optimized for EU data residency and enterprise reliability
// =============================================================================

let _upstashClient: Redis | null = null;

export function getUpstashClient(): Redis {
  if (!config.UPSTASH_REDIS_REST_URL || !config.UPSTASH_REDIS_REST_TOKEN) {
    throw new Error('Upstash Redis configuration is missing. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.');
  }

  if (!_upstashClient) {
    _upstashClient = new Redis({
      url: config.UPSTASH_REDIS_REST_URL,
      token: config.UPSTASH_REDIS_REST_TOKEN,
    });
  }

  return _upstashClient;
}

// Health check for Upstash client
export async function checkUpstashHealth(): Promise<{
  status: 'healthy' | 'error';
  responseTime?: number;
  error?: string;
}> {
  try {
    const start = Date.now();
    const testKey = `health_check_${Date.now()}`;
    
    await getUpstashClient().set(testKey, 'test', { ex: 60 }); // Expire in 60 seconds
    const result = await getUpstashClient().get(testKey);
    await getUpstashClient().del(testKey);
    
    const responseTime = Date.now() - start;
    
    if (result === 'test') {
      return { status: 'healthy', responseTime };
    } else {
      return { status: 'error', error: 'Test value mismatch' };
    }
  } catch (error) {
    return {
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Caching utilities for premium performance
export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const client = getUpstashClient();
    const result = await client.get(key);
    return result as T | null;
  } catch (error) {
    console.warn(`Cache get failed for key ${key}:`, error);
    return null;
  }
}

export async function cacheSet<T>(
  key: string, 
  value: T, 
  ttlSeconds: number = 3600
): Promise<boolean> {
  try {
    const client = getUpstashClient();
    await client.set(key, JSON.stringify(value), { ex: ttlSeconds });
    return true;
  } catch (error) {
    console.warn(`Cache set failed for key ${key}:`, error);
    return false;
  }
}

export async function cacheDel(key: string): Promise<boolean> {
  try {
    const client = getUpstashClient();
    await client.del(key);
    return true;
  } catch (error) {
    console.warn(`Cache delete failed for key ${key}:`, error);
    return false;
  }
}

// Analytics and metrics utilities
export async function incrementCounter(
  key: string, 
  increment: number = 1
): Promise<number> {
  try {
    const client = getUpstashClient();
    return await client.incrby(key, increment);
  } catch (error) {
    console.warn(`Counter increment failed for key ${key}:`, error);
    return 0;
  }
}

export async function getCounter(key: string): Promise<number> {
  try {
    const client = getUpstashClient();
    const result = await client.get(key);
    return typeof result === 'number' ? result : 0;
  } catch (error) {
    console.warn(`Counter get failed for key ${key}:`, error);
    return 0;
  }
}

// Rate limiting utilities for premium tier
export async function checkRateLimit(
  identifier: string,
  limit: number,
  windowSeconds: number
): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
  try {
    const client = getUpstashClient();
    const key = `rate_limit:${identifier}`;
    const now = Date.now();
    const windowStart = now - (windowSeconds * 1000);
    
    // Remove old entries
    await client.zremrangebyscore(key, 0, windowStart);
    
    // Count current requests
    const current = await client.zcard(key);
    
    if (current >= limit) {
      const resetTime = await client.zrange(key, 0, 0, { withScores: true });
      const oldestTime = resetTime.length > 0 ? resetTime[1] as number : now;
      return {
        allowed: false,
        remaining: 0,
        resetTime: oldestTime + (windowSeconds * 1000),
      };
    }
    
    // Add current request
    await client.zadd(key, { score: now, member: `${now}_${Math.random()}` });
    await client.expire(key, windowSeconds);
    
    return {
      allowed: true,
      remaining: limit - current - 1,
      resetTime: now + (windowSeconds * 1000),
    };
  } catch (error) {
    console.warn(`Rate limit check failed for ${identifier}:`, error);
    // Fail open for premium service reliability
    return { allowed: true, remaining: limit, resetTime: Date.now() + (windowSeconds * 1000) };
  }
}