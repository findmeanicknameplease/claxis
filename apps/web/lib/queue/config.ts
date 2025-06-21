import { config } from '@/lib/config';
import { Redis } from 'ioredis';
import { Queue, QueueEvents } from 'bullmq';

// =============================================================================
// PREMIUM SAAS QUEUE CONFIGURATION
// =============================================================================
// Enterprise-grade BullMQ setup optimized for €299.99/month tier
// - High reliability with minimal overhead
// - EU data residency compliance (Frankfurt Redis)
// - Premium performance targets: <2s processing, 99.5% uptime
// =============================================================================

// Check if Redis is configured (simplified)
function isRedisConfigured(): boolean {
  return !!(config.REDIS_URL || process.env['REDIS_URL']);
}

// Check if Upstash is configured (simplified)
function isUpstashConfigured(): boolean {
  const upstashUrl = config.UPSTASH_REDIS_REST_URL || process.env['UPSTASH_REDIS_REST_URL'];
  const upstashToken = config.UPSTASH_REDIS_REST_TOKEN || process.env['UPSTASH_REDIS_REST_TOKEN'];
  
  const hasConfig = !!(upstashUrl && upstashToken && upstashUrl.includes('upstash.io'));
  
  console.log('Upstash Configuration Check:', {
    hasConfig,
    upstashUrlPrefix: upstashUrl?.substring(0, 30),
    hasToken: !!upstashToken,
    NODE_ENV: process.env.NODE_ENV
  });
  
  return hasConfig;
}

// Redis connection with premium optimizations (lazy initialization)
export function getRedisConfig() {
  const redisUrl = config.REDIS_URL || process.env['REDIS_URL'];
  
  // For Upstash or other cloud Redis providers
  if (redisUrl && (redisUrl.includes('upstash.io') || redisUrl.includes('redislabs.com'))) {
    return {
      host: getRedisHost(),
      port: getRedisPort(),
      password: getRedisPassword(),
      tls: {}, // Enable TLS for cloud providers
      // Premium SaaS optimizations
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: null, // BullMQ requirement
      lazyConnect: true,
      keepAlive: 30000,
      // EU compliance
      family: 4, // IPv4 for predictable routing in EU
      connectTimeout: 10000,
      commandTimeout: 5000,
    };
  }
  
  // Local Redis configuration
  return {
    host: getRedisHost(),
    port: getRedisPort(),
    password: getRedisPassword(),
    // Premium SaaS optimizations
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: null, // BullMQ requirement
    lazyConnect: true,
    keepAlive: 30000,
    // EU compliance
    family: 4, // IPv4 for predictable routing in EU
    connectTimeout: 10000,
    commandTimeout: 5000,
  };
}

// Lazy Redis connection
let _redis: Redis | null = null;
export function getRedis(): Redis {
  if (!isRedisConfigured()) {
    throw new Error('Redis is not configured. Queue operations are not available.');
  }
  
  if (!_redis) {
    _redis = new Redis(getRedisConfig());
  }
  return _redis;
}

// =============================================================================
// LAZY QUEUE INITIALIZATION
// =============================================================================

let _whatsappQueue: Queue | null = null;
let _instagramQueue: Queue | null = null;
let _aiProcessingQueue: Queue | null = null;

// WhatsApp webhook processing queue (primary business logic)
export function getWhatsAppQueue(): Queue {
  if (!isRedisConfigured()) {
    throw new Error('Redis is not configured. WhatsApp queue is not available.');
  }
  
  if (!_whatsappQueue) {
    _whatsappQueue = new Queue('whatsapp-webhooks', {
      connection: getRedisConfig(),
      defaultJobOptions: {
        // Premium reliability settings
        removeOnComplete: 100, // Keep last 100 successful jobs for debugging
        removeOnFail: 50,     // Keep last 50 failed jobs for analysis
        attempts: 3,          // Enterprise retry policy
        backoff: {
          type: 'exponential',
          delay: 2000,        // Start with 2s delay
        },
        // Premium performance targets
        delay: 0,             // No artificial delays for premium tier
      },
    });
  }
  return _whatsappQueue;
}

// Instagram automation queue (Professional/Enterprise tiers)
export function getInstagramQueue(): Queue {
  if (!isRedisConfigured()) {
    throw new Error('Redis is not configured. Instagram queue is not available.');
  }
  
  if (!_instagramQueue) {
    _instagramQueue = new Queue('instagram-automation', {
      connection: getRedisConfig(),
      defaultJobOptions: {
        removeOnComplete: 50,
        removeOnFail: 25,
        attempts: 2,          // Instagram is less critical than WhatsApp
        backoff: {
          type: 'exponential', 
          delay: 5000,        // 5s delay for social media API limits
        },
      },
    });
  }
  return _instagramQueue;
}

// AI processing queue (Gemini Flash/Lite workloads)
export function getAIProcessingQueue(): Queue {
  if (!isRedisConfigured()) {
    throw new Error('Redis is not configured. AI processing queue is not available.');
  }
  
  if (!_aiProcessingQueue) {
    _aiProcessingQueue = new Queue('ai-processing', {
      connection: getRedisConfig(),
      defaultJobOptions: {
        removeOnComplete: 200, // Keep more AI jobs for learning/optimization
        removeOnFail: 100,
        attempts: 2,           // AI failures are usually permanent (quota/auth)
        backoff: {
          type: 'fixed',
          delay: 1000,         // Quick retry for AI processing
        },
      },
    });
  }
  return _aiProcessingQueue;
}

// =============================================================================
// LAZY QUEUE EVENTS FOR MONITORING
// =============================================================================

let _whatsappQueueEvents: QueueEvents | null = null;
let _instagramQueueEvents: QueueEvents | null = null;
let _aiQueueEvents: QueueEvents | null = null;

export function getWhatsAppQueueEvents(): QueueEvents {
  if (!isRedisConfigured()) {
    throw new Error('Redis is not configured. Queue events are not available.');
  }
  
  if (!_whatsappQueueEvents) {
    _whatsappQueueEvents = new QueueEvents('whatsapp-webhooks', {
      connection: getRedisConfig(),
    });
  }
  return _whatsappQueueEvents;
}

export function getInstagramQueueEvents(): QueueEvents {
  if (!isRedisConfigured()) {
    throw new Error('Redis is not configured. Queue events are not available.');
  }
  
  if (!_instagramQueueEvents) {
    _instagramQueueEvents = new QueueEvents('instagram-automation', {
      connection: getRedisConfig(),
    });
  }
  return _instagramQueueEvents;
}

export function getAIQueueEvents(): QueueEvents {
  if (!isRedisConfigured()) {
    throw new Error('Redis is not configured. Queue events are not available.');
  }
  
  if (!_aiQueueEvents) {
    _aiQueueEvents = new QueueEvents('ai-processing', {
      connection: getRedisConfig(),
    });
  }
  return _aiQueueEvents;
}

// =============================================================================
// JOB TYPES & INTERFACES
// =============================================================================

export interface WhatsAppWebhookJob {
  type: 'incoming_message' | 'message_status' | 'account_update';
  webhookData: any;
  metadata: {
    salon_id?: string;
    customer_phone?: string;
    message_id?: string;
    timestamp: string;
    ip_address?: string;
  };
  priority?: number; // 1-10, higher = more urgent
}

export interface InstagramJob {
  type: 'comment_monitoring' | 'dm_processing' | 'post_analysis';
  data: any;
  metadata: {
    salon_id: string;
    instagram_page_id: string;
    timestamp: string;
  };
}

export interface AIProcessingJob {
  type: 'intent_detection' | 'response_generation' | 'image_analysis';
  input: {
    message?: string;
    image_url?: string;
    context?: any;
  };
  config: {
    model: 'flash' | 'flash-lite' | 'vision';
    max_tokens?: number;
    temperature?: number;
  };
  metadata: {
    salon_id: string;
    conversation_id?: string;
    priority: 'high' | 'normal' | 'low';
  };
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function getRedisHost(): string {
  if (config.REDIS_URL) {
    const url = new URL(config.REDIS_URL);
    return url.hostname;
  }
  return 'localhost';
}

function getRedisPort(): number {
  if (config.REDIS_URL) {
    const url = new URL(config.REDIS_URL);
    return parseInt(url.port) || 6379;
  }
  return 6379;
}

function getRedisPassword(): string | undefined {
  if (config.REDIS_URL) {
    const url = new URL(config.REDIS_URL);
    return url.password || undefined;
  }
  return config.REDIS_PASSWORD;
}

// =============================================================================
// QUEUE HEALTH MONITORING
// =============================================================================

export async function getQueueHealthStatus() {
  try {
    if (!isRedisConfigured()) {
      return {
        status: 'unavailable',
        message: 'Redis is not configured. Queue operations are disabled.',
        timestamp: new Date().toISOString(),
      };
    }

    const whatsappQueue = getWhatsAppQueue();
    const redis = getRedis();
    
    const [whatsappWaiting, whatsappActive, whatsappFailed] = await Promise.all([
      whatsappQueue.getWaiting(),
      whatsappQueue.getActive(), 
      whatsappQueue.getFailed(),
    ]);

    return {
      status: 'healthy',
      queues: {
        whatsapp: {
          waiting: whatsappWaiting.length,
          active: whatsappActive.length,
          failed: whatsappFailed.length,
        },
      },
      redis: {
        status: redis.status,
      },
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Queue health check failed:', error);
    return {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    };
  }
}

// =============================================================================
// GRACEFUL SHUTDOWN
// =============================================================================

export async function closeQueues() {
  console.log('Closing BullMQ queues...');
  
  try {
    const promises: Promise<void>[] = [];
    
    if (_whatsappQueue) promises.push(_whatsappQueue.close());
    if (_instagramQueue) promises.push(_instagramQueue.close());
    if (_aiProcessingQueue) promises.push(_aiProcessingQueue.close());
    if (_whatsappQueueEvents) promises.push(_whatsappQueueEvents.close());
    if (_instagramQueueEvents) promises.push(_instagramQueueEvents.close());
    if (_aiQueueEvents) promises.push(_aiQueueEvents.close());
    
    await Promise.all(promises);

    if (_redis) {
      await _redis.disconnect();
    }
    
    console.log('All queues closed successfully');
  } catch (error) {
    console.error('Error closing queues:', error);
  }
}

// Handle graceful shutdown
process.on('SIGINT', closeQueues);
process.on('SIGTERM', closeQueues);