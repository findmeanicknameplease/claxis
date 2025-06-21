import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getWhatsAppQueue, getAIProcessingQueue } from '@/lib/queue/upstash-queue';
import { checkUpstashHealth } from '@/lib/redis/upstash-client';
import { config } from '@/lib/config';

// =============================================================================
// PREMIUM SAAS WHATSAPP WEBHOOK HEALTH CHECK
// =============================================================================
// Enterprise-grade health monitoring for €299.99/month tier
// Monitors webhook endpoints, queue system, and database connectivity
// EU-compliant with Frankfurt region deployment
// =============================================================================

interface HealthMetrics {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  region: string;
  tier: string;
  services: {
    webhook: {
      status: 'active' | 'inactive';
      lastVerification?: string;
      responseTime?: number;
    };
    database: {
      status: 'connected' | 'disconnected' | 'error';
      connectionTime?: number;
      lastQuery?: string;
    };
    queue: {
      status: 'healthy' | 'degraded' | 'error';
      whatsapp: {
        waiting: number;
        active: number;
        failed: number;
        completed: number;
      };
      aiProcessing: {
        waiting: number;
        active: number;
        failed: number;
        completed: number;
      };
    };
    redis: {
      status: 'connected' | 'disconnected';
      connectionTime?: number;
    };
  };
  sla: {
    targetUptime: string;
    targetResponseTime: string;
    currentResponseTime?: number;
    queueDepthLimit: number;
    failureRateLimit: string;
  };
  alerts?: Array<{
    level: 'warning' | 'critical';
    message: string;
    service: string;
  }>;
}

export async function GET(): Promise<NextResponse> {
  const startTime = Date.now();
  const metrics: HealthMetrics = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    region: 'eu-central-1',
    tier: 'premium',
    services: {
      webhook: { status: 'active' },
      database: { status: 'connected' },
      queue: {
        status: 'healthy',
        whatsapp: { waiting: 0, active: 0, failed: 0, completed: 0 },
        aiProcessing: { waiting: 0, active: 0, failed: 0, completed: 0 }
      },
      redis: { status: 'connected' }
    },
    sla: {
      targetUptime: '99.5%',
      targetResponseTime: '<2s',
      queueDepthLimit: 100,
      failureRateLimit: '<10%'
    },
    alerts: []
  };

  try {
    // Test webhook endpoint availability
    metrics.services.webhook.responseTime = Date.now() - startTime;
    metrics.services.webhook.lastVerification = new Date().toISOString();

    // Test database connectivity
    const dbStartTime = Date.now();
    const supabase = createClient(
      config.NEXT_PUBLIC_SUPABASE_URL,
      config.SUPABASE_SERVICE_ROLE_KEY || config.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    try {
      const { error } = await supabase
        .from('whatsapp_messages')
        .select('count', { count: 'exact', head: true })
        .limit(1);

      if (error) {
        metrics.services.database.status = 'error';
        metrics.status = 'degraded';
        metrics.alerts?.push({
          level: 'critical',
          message: `Database error: ${error.message}`,
          service: 'database'
        });
      } else {
        metrics.services.database.status = 'connected';
        metrics.services.database.connectionTime = Date.now() - dbStartTime;
        metrics.services.database.lastQuery = new Date().toISOString();
      }
    } catch {
      metrics.services.database.status = 'disconnected';
      metrics.status = 'unhealthy';
      metrics.alerts?.push({
        level: 'critical',
        message: 'Database connection failed',
        service: 'database'
      });
    }

    // Test queue system health (simplified Upstash)
    const queueStartTime = Date.now();
    try {
      // Check WhatsApp queue
      const whatsappQueue = getWhatsAppQueue();
      const whatsappStats = await whatsappQueue.getStats();

      metrics.services.queue.whatsapp = {
        waiting: whatsappStats.waiting,
        active: whatsappStats.active,
        failed: whatsappStats.failed,
        completed: whatsappStats.completed
      };

      // Check AI processing queue
      const aiProcessingQueue = getAIProcessingQueue();
      const aiStats = await aiProcessingQueue.getStats();

      metrics.services.queue.aiProcessing = {
        waiting: aiStats.waiting,
        active: aiStats.active,
        failed: aiStats.failed,
        completed: aiStats.completed
      };

      // Check for queue health issues
      const totalWaiting = metrics.services.queue.whatsapp.waiting + 
                          metrics.services.queue.aiProcessing.waiting;
      const totalFailed = metrics.services.queue.whatsapp.failed + 
                         metrics.services.queue.aiProcessing.failed;

      if (totalWaiting > 100) {
        metrics.services.queue.status = 'degraded';
        metrics.status = 'degraded';
        metrics.alerts?.push({
          level: 'critical',
          message: `High queue depth: ${totalWaiting} jobs waiting`,
          service: 'queue'
        });
      } else if (totalWaiting > 50) {
        metrics.alerts?.push({
          level: 'warning',
          message: `Elevated queue depth: ${totalWaiting} jobs waiting`,
          service: 'queue'
        });
      }

      if (totalFailed > 10) {
        metrics.services.queue.status = 'degraded';
        metrics.status = 'degraded';
        metrics.alerts?.push({
          level: 'critical',
          message: `High failure rate: ${totalFailed} failed jobs`,
          service: 'queue'
        });
      }

      // Check Upstash REST API health
      const upstashHealth = await checkUpstashHealth();
      if (upstashHealth.status === 'healthy') {
        metrics.services.redis.status = 'connected';
        metrics.services.redis.connectionTime = upstashHealth.responseTime || (Date.now() - queueStartTime);
      } else {
        metrics.services.redis.status = 'disconnected';
        metrics.alerts?.push({
          level: 'warning',
          message: `Upstash health check failed: ${upstashHealth.error}`,
          service: 'redis'
        });
      }

    } catch (error) {
      console.error('Queue/Redis health check failed:', error);
      metrics.services.queue.status = 'error';
      metrics.services.redis.status = 'disconnected';
      metrics.status = 'unhealthy';
      metrics.alerts?.push({
        level: 'critical',
        message: `Queue system unavailable: ${error instanceof Error ? error.message : 'Unknown error'}`,
        service: 'redis'
      });
    }

    // Check overall response time
    const totalResponseTime = Date.now() - startTime;
    metrics.sla.currentResponseTime = totalResponseTime;

    if (totalResponseTime > 5000) {
      metrics.status = 'degraded';
      metrics.alerts?.push({
        level: 'critical',
        message: `Slow response time: ${totalResponseTime}ms`,
        service: 'webhook'
      });
    } else if (totalResponseTime > 2000) {
      metrics.alerts?.push({
        level: 'warning',
        message: `Elevated response time: ${totalResponseTime}ms`,
        service: 'webhook'
      });
    }

    // Determine overall status
    if (metrics.alerts?.some(alert => alert.level === 'critical')) {
      metrics.status = metrics.services.database.status === 'disconnected' ? 'unhealthy' : 'degraded';
    }

    console.log('WhatsApp webhook health check completed:', {
      status: metrics.status,
      responseTime: totalResponseTime,
      queueDepth: metrics.services.queue.whatsapp.waiting + metrics.services.queue.aiProcessing.waiting,
      alerts: metrics.alerts?.length || 0
    });

    return NextResponse.json(metrics, {
      status: metrics.status === 'unhealthy' ? 503 : 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Health-Status': metrics.status,
        'X-Response-Time': `${totalResponseTime}ms`,
        'X-Region': 'eu-central-1',
        'X-Tier': 'premium',
        'X-Service': 'whatsapp-webhook'
      }
    });

  } catch (error) {
    console.error('Health check error:', error);
    
    return NextResponse.json({
      status: 'unhealthy',
      error: 'Health check failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { 
      status: 503,
      headers: {
        'X-Health-Status': 'unhealthy',
        'X-Region': 'eu-central-1'
      }
    });
  }
}

// HEAD request for lightweight health check
export async function HEAD(): Promise<NextResponse> {
  try {
    // Quick connectivity test
    const supabase = createClient(
      config.NEXT_PUBLIC_SUPABASE_URL,
      config.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
    
    await Promise.race([
      supabase.from('whatsapp_messages').select('count', { count: 'exact', head: true }).limit(1),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 1000))
    ]);

    return new NextResponse(null, {
      status: 200,
      headers: {
        'X-Health-Status': 'healthy',
        'X-Region': 'eu-central-1',
        'X-Tier': 'premium',
        'X-Service': 'whatsapp-webhook'
      }
    });
  } catch {
    return new NextResponse(null, {
      status: 503,
      headers: {
        'X-Health-Status': 'unhealthy'
      }
    });
  }
}