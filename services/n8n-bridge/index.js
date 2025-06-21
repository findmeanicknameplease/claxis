// n8n Bridge Service - Postgres Events to n8n Workflows
// Phase 1B: Real-Time Infrastructure

const express = require('express');
const { Client } = require('pg');
const axios = require('axios');
const winston = require('winston');
require('dotenv').config();

// =============================================================================
// N8N BRIDGE SERVICE - EVENT TO WORKFLOW ORCHESTRATOR
// =============================================================================
// Converts Postgres LISTEN/NOTIFY events to n8n webhook triggers
// Ensures reliable delivery with audit logging for enterprise operations
// =============================================================================

const app = express();

// Configuration
const PORT = process.env.N8N_BRIDGE_PORT || 3002;
const DATABASE_URL = process.env.DATABASE_URL;
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || 'http://localhost:5678/webhook/salon-events';
const N8N_API_KEY = process.env.N8N_API_KEY;

if (!DATABASE_URL) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

// Enhanced logging
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({ 
      filename: 'logs/n8n-bridge-error.log', 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: 'logs/n8n-bridge.log' 
    })
  ]
});

// Metrics tracking
const metrics = {
  eventsReceived: 0,
  eventsForwarded: 0,
  eventsFailed: 0,
  lastEventTime: null,
  startTime: new Date()
};

// =============================================================================
// POSTGRES EVENT LISTENER
// =============================================================================

const pgClient = new Client({
  connectionString: DATABASE_URL
});

// Event type mapping to n8n workflow endpoints
const eventEndpoints = {
  'call.started': '/webhook/call-started',
  'call.ended': '/webhook/call-ended',
  'call.answered': '/webhook/call-answered',
  'transcript.updated': '/webhook/transcript-update',
  'booking.intent_detected': '/webhook/booking-intent',
  'callback.requested': '/webhook/callback-request',
  'campaign.started': '/webhook/campaign-started',
  'campaign.completed': '/webhook/campaign-completed',
  'system.health': '/webhook/system-health'
};

async function initializeEventListener() {
  try {
    await pgClient.connect();
    logger.info('Connected to PostgreSQL for event listening');
    
    // Listen to service events channel
    await pgClient.query('LISTEN service_events');
    logger.info('Listening to service_events channel');
    
    // Handle incoming events
    pgClient.on('notification', async (msg) => {
      metrics.eventsReceived++;
      metrics.lastEventTime = new Date();
      
      try {
        const payload = JSON.parse(msg.payload);
        await handleIncomingEvent(payload);
      } catch (error) {
        metrics.eventsFailed++;
        logger.error('Error processing event', {
          error: error.message,
          payload: msg.payload
        });
      }
    });

    // Handle connection errors
    pgClient.on('error', (error) => {
      logger.error('PostgreSQL connection error', { error: error.message });
      // Attempt to reconnect after delay
      setTimeout(initializeEventListener, 5000);
    });

  } catch (error) {
    logger.error('Failed to connect to PostgreSQL', { error: error.message });
    // Retry connection after delay
    setTimeout(initializeEventListener, 5000);
  }
}

/**
 * Handle incoming events and forward to n8n
 */
async function handleIncomingEvent(payload) {
  const { event_id, event, salon_id, data, timestamp } = payload;
  
  logger.info('Processing event', {
    event_id,
    event,
    salon_id,
    timestamp
  });

  try {
    // Determine n8n endpoint
    const endpoint = eventEndpoints[event] || '/webhook/generic-event';
    const n8nUrl = `${N8N_WEBHOOK_URL.replace('/webhook/salon-events', '')}${endpoint}`;
    
    // Prepare payload for n8n
    const n8nPayload = {
      event_id,
      event,
      salon_id,
      timestamp,
      data,
      source: 'postgres-notify',
      bridge_timestamp: new Date().toISOString()
    };

    // Headers for n8n request
    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'Gemini-Salon-Bridge/1.0'
    };

    if (N8N_API_KEY) {
      headers['Authorization'] = `Bearer ${N8N_API_KEY}`;
    }

    // Forward to n8n with timeout
    const response = await axios.post(n8nUrl, n8nPayload, {
      timeout: 10000, // 10 second timeout
      headers,
      validateStatus: (status) => status < 500 // Accept 4xx as successful delivery
    });

    metrics.eventsForwarded++;
    
    logger.info('Event forwarded to n8n', {
      event_id,
      event,
      salon_id,
      n8n_url: n8nUrl,
      response_status: response.status,
      response_time: response.headers['x-response-time']
    });

    // Mark event as processed in database
    if (event_id) {
      try {
        await pgClient.query('SELECT mark_event_processed($1)', [event_id]);
      } catch (dbError) {
        logger.warn('Failed to mark event as processed', {
          event_id,
          error: dbError.message
        });
      }
    }

  } catch (error) {
    metrics.eventsFailed++;
    
    // Log different error types
    if (error.code === 'ECONNREFUSED') {
      logger.error('n8n service unavailable', {
        event_id,
        event,
        salon_id,
        error: 'Connection refused to n8n webhook'
      });
    } else if (error.code === 'ENOTFOUND') {
      logger.error('n8n webhook URL not found', {
        event_id,
        event,
        salon_id,
        url: N8N_WEBHOOK_URL,
        error: error.message
      });
    } else if (error.response) {
      logger.error('n8n webhook error response', {
        event_id,
        event,
        salon_id,
        status: error.response.status,
        data: error.response.data
      });
    } else {
      logger.error('Unexpected error forwarding to n8n', {
        event_id,
        event,
        salon_id,
        error: error.message
      });
    }

    // Store failed event for potential replay
    await storeFailedEvent(payload, error.message);
  }
}

/**
 * Store failed events for manual replay
 */
async function storeFailedEvent(payload, errorMessage) {
  try {
    await pgClient.query(`
      INSERT INTO system_events (salon_id, event_type, event_data, channel)
      VALUES ($1, $2, $3, $4)
    `, [
      payload.salon_id,
      `failed.${payload.event}`,
      {
        ...payload.data,
        original_event: payload.event,
        error_message: errorMessage,
        failed_at: new Date().toISOString()
      },
      'failed_events'
    ]);
  } catch (dbError) {
    logger.error('Failed to store failed event', {
      error: dbError.message,
      original_payload: payload
    });
  }
}

// =============================================================================
// HEALTH CHECK & MONITORING
// =============================================================================

app.use(express.json());

// Health check endpoint
app.get('/health', async (req, res) => {
  const uptime = Math.floor((new Date() - metrics.startTime) / 1000);
  
  // Test n8n connectivity
  let n8nHealthy = false;
  try {
    await axios.get(`${N8N_WEBHOOK_URL}/health`, { timeout: 3000 });
    n8nHealthy = true;
  } catch (error) {
    // n8n health check failed
  }

  res.json({
    status: 'healthy',
    service: 'n8n-bridge',
    uptime_seconds: uptime,
    metrics,
    postgres: {
      connected: pgClient._connected || false
    },
    n8n: {
      healthy: n8nHealthy,
      webhook_url: N8N_WEBHOOK_URL
    },
    timestamp: new Date().toISOString()
  });
});

// Metrics endpoint
app.get('/metrics', (req, res) => {
  const successRate = metrics.eventsReceived > 0 
    ? ((metrics.eventsForwarded / metrics.eventsReceived) * 100).toFixed(2)
    : 0;

  res.json({
    metrics: {
      ...metrics,
      success_rate_percent: parseFloat(successRate)
    },
    event_endpoints: eventEndpoints,
    timestamp: new Date().toISOString()
  });
});

// Manual event replay endpoint
app.post('/replay-failed', async (req, res) => {
  try {
    // Get failed events from database
    const { rows } = await pgClient.query(`
      SELECT * FROM system_events 
      WHERE event_type LIKE 'failed.%' 
      AND processed_at IS NULL
      ORDER BY created_at ASC
      LIMIT 10
    `);

    let replayedCount = 0;
    for (const event of rows) {
      try {
        const originalEvent = event.event_type.replace('failed.', '');
        const payload = {
          event_id: event.id,
          event: originalEvent,
          salon_id: event.salon_id,
          data: event.event_data,
          timestamp: event.created_at
        };

        await handleIncomingEvent(payload);
        replayedCount++;
      } catch (error) {
        logger.error('Failed to replay event', {
          event_id: event.id,
          error: error.message
        });
      }
    }

    res.json({
      message: `Replayed ${replayedCount} failed events`,
      total_failed: rows.length,
      replayed: replayedCount
    });

  } catch (error) {
    logger.error('Error replaying failed events', { error: error.message });
    res.status(500).json({ error: 'Failed to replay events' });
  }
});

// =============================================================================
// SERVER STARTUP
// =============================================================================

app.listen(PORT, () => {
  logger.info(`🚀 n8n Bridge Service running on port ${PORT}`);
  logger.info(`🔗 n8n webhook URL: ${N8N_WEBHOOK_URL}`);
  logger.info(`📊 Metrics available at http://localhost:${PORT}/metrics`);
  
  // Initialize Postgres event listener
  initializeEventListener();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('Shutting down n8n Bridge Service...');
  
  // Close Postgres connection
  pgClient.end();
  
  process.exit(0);
});

module.exports = { app, metrics, logger };