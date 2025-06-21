import { NextResponse } from 'next/server';
import { getQueueHealthStatus } from '@/lib/queue/config';

// =============================================================================
// QUEUE HEALTH MONITORING ENDPOINT
// =============================================================================
// Premium SaaS health check for enterprise monitoring
// Provides real-time queue metrics for 99.5% uptime target

export async function GET() {
  try {
    const healthStatus = await getQueueHealthStatus();
    
    // Determine overall health based on queue metrics
    const whatsappQueue = healthStatus.queues?.whatsapp;
    const isHealthy = healthStatus.status === 'healthy' && 
                     (whatsappQueue?.failed ?? 0) < 10 &&
                     (whatsappQueue?.waiting ?? 0) < 100;

    const status = isHealthy ? 200 : 503;
    
    return NextResponse.json({
      status: isHealthy ? 'healthy' : 'degraded',
      service: 'queue-system',
      timestamp: new Date().toISOString(),
      metrics: {
        ...healthStatus,
        sla: {
          target_uptime: '99.5%',
          max_queue_depth: 100,
          max_failed_jobs: 10,
          processing_target: '<2s'
        }
      }
    }, { status });

  } catch (error) {
    console.error('Queue health check failed:', error);
    
    return NextResponse.json({
      status: 'unhealthy',
      service: 'queue-system',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 503 });
  }
}