#!/usr/bin/env node

// =============================================================================
// CAMPAIGN WORKER PROCESS - Dedicated BullMQ Job Processor
// =============================================================================
// Standalone worker service for processing voice campaign jobs
// Handles: Review requests, reactivation calls, follow-ups, promotional campaigns
// Features: Graceful shutdown, health monitoring, scaling support
// =============================================================================

require('dotenv').config();
const { Worker, QueueEvents } = require('bullmq');
const Redis = require('ioredis');
const { createClient } = require('@supabase/supabase-js');
const twilio = require('twilio');
const axios = require('axios');

// Import campaign engine functions
const {
  processCampaignJob,
  QUEUE_NAMES,
  validateCampaignExecution,
  generateCampaignScript,
  checkCampaignConsent
} = require('./campaign-engine');

// =============================================================================
// WORKER CONFIGURATION
// =============================================================================

const WORKER_CONFIG = {
  concurrency: parseInt(process.env.CAMPAIGN_WORKER_CONCURRENCY) || 3,
  maxMemory: parseInt(process.env.CAMPAIGN_WORKER_MAX_MEMORY) || 512, // MB
  healthCheckPort: parseInt(process.env.CAMPAIGN_WORKER_HEALTH_PORT) || 3002,
  gracefulShutdownTimeout: parseInt(process.env.GRACEFUL_SHUTDOWN_TIMEOUT) || 30000, // 30s
  jobTimeout: parseInt(process.env.CAMPAIGN_JOB_TIMEOUT) || 300000, // 5 minutes
  stalledInterval: parseInt(process.env.STALLED_INTERVAL) || 30000, // 30s
  maxStalledCount: parseInt(process.env.MAX_STALLED_COUNT) || 3
};

// Redis configuration (must match campaign-engine.js)
const REDIS_CONFIG = {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  db: process.env.REDIS_DB || 0,
  maxRetriesPerRequest: null, // Required by BullMQ
  retryDelayOnFailover: 100,
  lazyConnect: true
};

// Worker state
const workerInstances = {};
const queueEventInstances = {};
let isShuttingDown = false;
let healthServer = null;

// =============================================================================
// ENHANCED JOB PROCESSOR WITH ERROR HANDLING
// =============================================================================

/**
 * Enhanced campaign job processor with comprehensive error handling
 */
async function enhancedCampaignJobProcessor(job) {
  const startTime = Date.now();
  const jobId = job.id;
  const { campaignType, salonId, customerPhone } = job.data;

  console.log(`🔄 [Worker:${process.pid}] Processing job ${jobId}: ${campaignType} for ${customerPhone}`);

  try {
    // Pre-flight checks
    await performPreflightChecks(job.data);
    
    // Process the campaign job (uses existing logic from campaign-engine.js)
    const result = await processCampaignJob(job);
    
    const processingTime = Date.now() - startTime;
    console.log(`✅ [Worker:${process.pid}] Job ${jobId} completed in ${processingTime}ms`);
    
    // Update job metrics
    await updateJobMetrics('completed', processingTime, campaignType);
    
    return result;

  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    // Categorize error for appropriate retry logic
    const errorCategory = categorizeError(error);
    console.error(`❌ [Worker:${process.pid}] Job ${jobId} failed (${errorCategory}) after ${processingTime}ms:`, error.message);
    
    // Update job metrics
    await updateJobMetrics('failed', processingTime, campaignType, errorCategory);
    
    // Determine if job should be retried based on error category
    if (errorCategory === 'permanent') {
      // Mark job as permanently failed (no retry)
      throw new Error(`PERMANENT_FAILURE: ${error.message}`);
    }
    
    // For temporary failures, let BullMQ handle retry logic
    throw error;
  }
}

/**
 * Perform pre-flight checks before processing job
 */
async function performPreflightChecks(jobData) {
  const { salonId, customerPhone, campaignType } = jobData;
  
  // Check Redis connectivity
  const redis = new Redis(REDIS_CONFIG);
  await redis.ping();
  await redis.disconnect();
  
  // Validate required job data
  if (!salonId || !customerPhone || !campaignType) {
    throw new Error('Missing required job data fields');
  }
  
  // Check if worker is shutting down
  if (isShuttingDown) {
    throw new Error('Worker is shutting down, rejecting new jobs');
  }
  
  // Memory check
  const memoryUsage = process.memoryUsage();
  const memoryUsageMB = memoryUsage.heapUsed / 1024 / 1024;
  if (memoryUsageMB > WORKER_CONFIG.maxMemory) {
    throw new Error(`Memory usage (${memoryUsageMB.toFixed(2)}MB) exceeds limit (${WORKER_CONFIG.maxMemory}MB)`);
  }
}

/**
 * Categorize error for retry logic
 */
function categorizeError(error) {
  const errorMessage = error.message.toLowerCase();
  
  // Permanent failures (no retry)
  if (
    errorMessage.includes('consent') ||
    errorMessage.includes('invalid phone') ||
    errorMessage.includes('blocked number') ||
    errorMessage.includes('permanent_failure') ||
    errorMessage.includes('salon not found')
  ) {
    return 'permanent';
  }
  
  // Rate limiting (retry with delay)
  if (
    errorMessage.includes('rate limit') ||
    errorMessage.includes('too many requests') ||
    errorMessage.includes('budget exceeded')
  ) {
    return 'rate_limited';
  }
  
  // Service unavailable (retry)
  if (
    errorMessage.includes('twilio') ||
    errorMessage.includes('elevenlabs') ||
    errorMessage.includes('database') ||
    errorMessage.includes('timeout') ||
    errorMessage.includes('econnrefused')
  ) {
    return 'service_unavailable';
  }
  
  // Default to temporary (retry)
  return 'temporary';
}

/**
 * Update job processing metrics
 */
async function updateJobMetrics(status, processingTime, campaignType, errorCategory = null) {
  try {
    // Send metrics to monitoring endpoint (if configured)
    if (process.env.METRICS_ENDPOINT) {
      await axios.post(process.env.METRICS_ENDPOINT, {
        worker_pid: process.pid,
        job_status: status,
        processing_time_ms: processingTime,
        campaign_type: campaignType,
        error_category: errorCategory,
        timestamp: new Date().toISOString()
      }, { timeout: 5000 });
    }
  } catch (error) {
    console.warn('Failed to send job metrics:', error.message);
  }
}

// =============================================================================
// WORKER INITIALIZATION
// =============================================================================

/**
 * Initialize campaign workers for all queue types
 */
async function initializeCampaignWorkers() {
  console.log(`🚀 [Worker:${process.pid}] Initializing campaign workers...`);
  console.log(`📊 Configuration: ${WORKER_CONFIG.concurrency} concurrent jobs, ${WORKER_CONFIG.maxMemory}MB memory limit`);
  
  for (const [type, queueName] of Object.entries(QUEUE_NAMES)) {
    try {
      // Create worker instance
      const worker = new Worker(
        queueName,
        enhancedCampaignJobProcessor,
        {
          connection: REDIS_CONFIG,
          concurrency: WORKER_CONFIG.concurrency,
          removeOnComplete: 100,
          removeOnFail: 50,
          settings: {
            stalledInterval: WORKER_CONFIG.stalledInterval,
            maxStalledCount: WORKER_CONFIG.maxStalledCount
          }
        }
      );

      // Worker event handlers
      worker.on('ready', () => {
        console.log(`✅ [Worker:${process.pid}] ${type} worker ready`);
      });

      worker.on('active', (job) => {
        console.log(`🔄 [Worker:${process.pid}] Processing ${type} job: ${job.id}`);
      });

      worker.on('completed', (job, result) => {
        console.log(`✅ [Worker:${process.pid}] ${type} job ${job.id} completed`);
      });

      worker.on('failed', (job, err) => {
        console.error(`❌ [Worker:${process.pid}] ${type} job ${job ? job.id : 'unknown'} failed:`, err.message);
      });

      worker.on('stalled', (jobId) => {
        console.warn(`⚠️  [Worker:${process.pid}] ${type} job ${jobId} stalled`);
      });

      worker.on('error', (err) => {
        console.error(`💥 [Worker:${process.pid}] ${type} worker error:`, err);
      });

      // Store worker instance
      workerInstances[type] = worker;

      // Create queue events for monitoring
      const queueEvents = new QueueEvents(queueName, { connection: REDIS_CONFIG });
      
      queueEvents.on('waiting', ({ jobId }) => {
        console.log(`⏳ [Queue:${type}] Job ${jobId} waiting`);
      });

      queueEvents.on('progress', ({ jobId, data }) => {
        console.log(`📈 [Queue:${type}] Job ${jobId} progress: ${JSON.stringify(data)}`);
      });

      queueEventInstances[type] = queueEvents;

      console.log(`🔄 [Worker:${process.pid}] ${type} worker initialized for queue: ${queueName}`);

    } catch (error) {
      console.error(`❌ [Worker:${process.pid}] Failed to initialize ${type} worker:`, error);
      throw error;
    }
  }

  console.log(`✅ [Worker:${process.pid}] All campaign workers initialized successfully`);
}

// =============================================================================
// HEALTH CHECK SERVER
// =============================================================================

/**
 * Start health check HTTP server
 */
function startHealthCheckServer() {
  const express = require('express');
  const app = express();
  
  app.use(express.json());

  // Health check endpoint
  app.get('/health', (req, res) => {
    const memoryUsage = process.memoryUsage();
    const uptime = process.uptime();
    
    const healthStatus = {
      status: isShuttingDown ? 'shutting_down' : 'healthy',
      worker_pid: process.pid,
      uptime_seconds: Math.floor(uptime),
      memory_usage: {
        used_mb: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        total_mb: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        max_mb: WORKER_CONFIG.maxMemory
      },
      workers: Object.keys(workerInstances).map(type => ({
        type,
        queue_name: QUEUE_NAMES[type],
        status: workerInstances[type] ? 'running' : 'stopped'
      })),
      timestamp: new Date().toISOString()
    };

    res.json(healthStatus);
  });

  // Worker metrics endpoint
  app.get('/metrics', async (req, res) => {
    try {
      const metrics = {};
      
      for (const [type, worker] of Object.entries(workerInstances)) {
        if (worker) {
          // Get queue statistics (simplified)
          metrics[type] = {
            queue_name: QUEUE_NAMES[type],
            worker_status: 'running'
          };
        }
      }

      res.json({
        worker_pid: process.pid,
        metrics,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Graceful shutdown endpoint
  app.post('/shutdown', (req, res) => {
    res.json({ status: 'shutdown_initiated', worker_pid: process.pid });
    gracefulShutdown('manual_shutdown');
  });

  healthServer = app.listen(WORKER_CONFIG.healthCheckPort, () => {
    console.log(`🏥 [Worker:${process.pid}] Health check server running on port ${WORKER_CONFIG.healthCheckPort}`);
  });
}

// =============================================================================
// GRACEFUL SHUTDOWN
// =============================================================================

/**
 * Graceful shutdown handler
 */
async function gracefulShutdown(signal) {
  if (isShuttingDown) {
    console.log(`⚠️  [Worker:${process.pid}] Shutdown already in progress...`);
    return;
  }

  isShuttingDown = true;
  console.log(`🛑 [Worker:${process.pid}] Received ${signal}, initiating graceful shutdown...`);

  const shutdownTimeout = setTimeout(() => {
    console.error(`💥 [Worker:${process.pid}] Graceful shutdown timed out, forcing exit`);
    process.exit(1);
  }, WORKER_CONFIG.gracefulShutdownTimeout);

  try {
    // Stop accepting new jobs and close workers
    console.log(`🔄 [Worker:${process.pid}] Closing workers...`);
    await Promise.all(
      Object.values(workerInstances).map(worker => worker.close())
    );

    // Close queue events
    console.log(`🔄 [Worker:${process.pid}] Closing queue events...`);
    await Promise.all(
      Object.values(queueEventInstances).map(events => events.close())
    );

    // Close health check server
    if (healthServer) {
      console.log(`🔄 [Worker:${process.pid}] Closing health check server...`);
      healthServer.close();
    }

    clearTimeout(shutdownTimeout);
    console.log(`✅ [Worker:${process.pid}] Graceful shutdown completed`);
    process.exit(0);

  } catch (error) {
    clearTimeout(shutdownTimeout);
    console.error(`❌ [Worker:${process.pid}] Error during shutdown:`, error);
    process.exit(1);
  }
}

// =============================================================================
// MAIN EXECUTION
// =============================================================================

async function main() {
  console.log(`🚀 [Worker:${process.pid}] Campaign Worker Process Starting...`);
  console.log(`📋 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Redis: ${REDIS_CONFIG.host}:${REDIS_CONFIG.port}`);

  try {
    // Test Redis connection
    const redis = new Redis(REDIS_CONFIG);
    await redis.ping();
    console.log(`✅ [Worker:${process.pid}] Redis connection successful`);
    await redis.disconnect();

    // Initialize workers
    await initializeCampaignWorkers();

    // Start health check server
    startHealthCheckServer();

    console.log(`🎉 [Worker:${process.pid}] Campaign Worker Process ready!`);

  } catch (error) {
    console.error(`💥 [Worker:${process.pid}] Failed to start worker process:`, error);
    process.exit(1);
  }
}

// Handle process signals for graceful shutdown
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2')); // Nodemon restart

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error(`💥 [Worker:${process.pid}] Uncaught exception:`, error);
  gracefulShutdown('uncaught_exception');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error(`💥 [Worker:${process.pid}] Unhandled rejection at:`, promise, 'reason:', reason);
  gracefulShutdown('unhandled_rejection');
});

// Start the worker process
if (require.main === module) {
  main().catch(error => {
    console.error(`💥 [Worker:${process.pid}] Fatal error:`, error);
    process.exit(1);
  });
}

module.exports = {
  main,
  gracefulShutdown,
  initializeCampaignWorkers
};