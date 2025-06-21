import { getUpstashClient } from '@/lib/redis/upstash-client';

// =============================================================================
// SIMPLIFIED UPSTASH QUEUE SYSTEM
// =============================================================================
// Lightweight queue implementation using Upstash REST API
// Perfect for premium SaaS with <2s processing requirements
// =============================================================================

export interface QueueJob {
  id: string;
  type: string;
  data: any;
  priority: number;
  createdAt: string;
  attempts: number;
  maxAttempts: number;
}

// Queue implementation using Upstash Redis
export class UpstashQueue {
  private queueName: string;
  private client: ReturnType<typeof getUpstashClient>;

  constructor(queueName: string) {
    this.queueName = queueName;
    this.client = getUpstashClient();
  }

  // Add job to queue
  async add(jobType: string, jobData: any, options: {
    priority?: number;
    maxAttempts?: number;
    delay?: number;
  } = {}): Promise<string> {
    const jobId = `${this.queueName}:${Date.now()}:${Math.random().toString(36)}`;
    const job: QueueJob = {
      id: jobId,
      type: jobType,
      data: jobData,
      priority: options.priority || 5,
      createdAt: new Date().toISOString(),
      attempts: 0,
      maxAttempts: options.maxAttempts || 3,
    };

    // Add to priority queue (higher priority = lower score)
    const score = (options.delay || 0) + Date.now() + (10 - (options.priority || 5));
    await this.client.zadd(`queue:${this.queueName}:waiting`, { score, member: JSON.stringify(job) });
    
    // Track job count
    await this.client.incr(`queue:${this.queueName}:total`);
    
    return jobId;
  }

  // Get next job from queue
  async getNext(): Promise<QueueJob | null> {
    const now = Date.now();
    const jobs = await this.client.zrange(`queue:${this.queueName}:waiting`, 0, now, { byScore: true, offset: 0, count: 1 });
    
    if (jobs.length === 0) return null;
    
    const jobData = jobs[0] as string;
    const job: QueueJob = JSON.parse(jobData);
    
    // Move from waiting to active
    await this.client.zrem(`queue:${this.queueName}:waiting`, jobData);
    await this.client.hset(`queue:${this.queueName}:active`, { [job.id]: jobData });
    
    return job;
  }

  // Mark job as completed
  async complete(jobId: string): Promise<void> {
    const jobData = await this.client.hget(`queue:${this.queueName}:active`, jobId);
    if (jobData) {
      await this.client.hdel(`queue:${this.queueName}:active`, jobId);
      await this.client.lpush(`queue:${this.queueName}:completed`, jobData);
      await this.client.ltrim(`queue:${this.queueName}:completed`, 0, 100); // Keep last 100
    }
  }

  // Mark job as failed
  async fail(jobId: string, error: string): Promise<void> {
    const jobData = await this.client.hget(`queue:${this.queueName}:active`, jobId);
    if (jobData) {
      const job: QueueJob = JSON.parse(jobData as string);
      job.attempts += 1;
      
      await this.client.hdel(`queue:${this.queueName}:active`, jobId);
      
      if (job.attempts < job.maxAttempts) {
        // Retry with exponential backoff
        const delay = Math.pow(2, job.attempts) * 1000;
        const score = Date.now() + delay;
        await this.client.zadd(`queue:${this.queueName}:waiting`, { score, member: JSON.stringify(job) });
      } else {
        // Move to failed queue
        const failedJob = { ...job, error, failedAt: new Date().toISOString() };
        await this.client.lpush(`queue:${this.queueName}:failed`, JSON.stringify(failedJob));
        await this.client.ltrim(`queue:${this.queueName}:failed`, 0, 50); // Keep last 50
      }
    }
  }

  // Get queue stats
  async getStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  }> {
    const [waiting, active, completed, failed] = await Promise.all([
      this.client.zcard(`queue:${this.queueName}:waiting`),
      this.client.hlen(`queue:${this.queueName}:active`),
      this.client.llen(`queue:${this.queueName}:completed`),
      this.client.llen(`queue:${this.queueName}:failed`)
    ]);

    return {
      waiting: waiting || 0,
      active: active || 0,
      completed: completed || 0,
      failed: failed || 0,
    };
  }

  // Health check
  async healthCheck(): Promise<{ status: 'healthy' | 'degraded' | 'error'; details?: any }> {
    try {
      const stats = await this.getStats();
      
      if (stats.waiting > 100) {
        return { status: 'degraded', details: { reason: 'High queue depth', stats } };
      }
      
      if (stats.failed > 10) {
        return { status: 'degraded', details: { reason: 'High failure rate', stats } };
      }
      
      return { status: 'healthy', details: stats };
    } catch (error) {
      return { 
        status: 'error', 
        details: { error: error instanceof Error ? error.message : 'Unknown error' } 
      };
    }
  }
}

// Singleton instances
let _whatsappQueue: UpstashQueue | null = null;
let _aiProcessingQueue: UpstashQueue | null = null;

export function getWhatsAppQueue(): UpstashQueue {
  if (!_whatsappQueue) {
    _whatsappQueue = new UpstashQueue('whatsapp-webhooks');
  }
  return _whatsappQueue;
}

export function getAIProcessingQueue(): UpstashQueue {
  if (!_aiProcessingQueue) {
    _aiProcessingQueue = new UpstashQueue('ai-processing');
  }
  return _aiProcessingQueue;
}

// Job types for type safety
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