// Notifier Service - Real-time WebSocket Event Distribution
// Phase 1B: Real-Time Infrastructure

const express = require('express');
const { WebSocketServer } = require('ws');
const jwt = require('jsonwebtoken');
const { Client } = require('pg');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

// =============================================================================
// NOTIFIER SERVICE - ENTERPRISE WEBSOCKET ORCHESTRATOR
// =============================================================================
// Bridges Postgres LISTEN/NOTIFY events to authenticated WebSocket clients
// Ensures multi-tenant isolation for €299.99/month Enterprise security
// =============================================================================

const app = express();
const server = require('http').createServer(app);

// Configuration
const PORT = process.env.NOTIFIER_PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET;
const DATABASE_URL = process.env.DATABASE_URL;

if (!JWT_SECRET) {
  console.error('JWT_SECRET is required for WebSocket authentication');
  process.exit(1);
}

if (!DATABASE_URL) {
  console.error('DATABASE_URL is required for event listening');
  process.exit(1);
}

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Multi-tenant WebSocket connection management
// Map: salon_id -> Set of WebSocket clients
const salonConnections = new Map();

// Connection stats for monitoring
const connectionStats = {
  totalConnections: 0,
  activeSalons: 0,
  eventsProcessed: 0,
  startTime: new Date()
};

// =============================================================================
// WEBSOCKET SERVER WITH JWT AUTHENTICATION
// =============================================================================

const wss = new WebSocketServer({ noServer: true });

// JWT-secured WebSocket handshake
server.on('upgrade', (request, socket, head) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);
    const token = url.searchParams.get('token');
    
    if (!token) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      console.log('WebSocket connection rejected: No token provided');
      return;
    }

    // Verify JWT and extract salon context
    const payload = jwt.verify(token, JWT_SECRET);
    const { salon } = payload.user || {};
    
    if (!salon?.id) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      console.log('WebSocket connection rejected: No salon context in token');
      return;
    }

    const salonId = salon.id;
    
    wss.handleUpgrade(request, socket, head, (ws) => {
      // Add to salon-specific connection pool
      if (!salonConnections.has(salonId)) {
        salonConnections.set(salonId, new Set());
        connectionStats.activeSalons++;
      }
      
      salonConnections.get(salonId).add(ws);
      connectionStats.totalConnections++;
      
      console.log(`WebSocket connected: salon ${salonId} (${salonConnections.get(salonId).size} connections)`);
      
      // Send connection confirmation
      ws.send(JSON.stringify({
        type: 'connection',
        status: 'connected',
        salon_id: salonId,
        timestamp: new Date().toISOString()
      }));

      // Handle client disconnect
      ws.on('close', () => {
        const connections = salonConnections.get(salonId);
        if (connections) {
          connections.delete(ws);
          connectionStats.totalConnections--;
          
          // Clean up empty salon pools
          if (connections.size === 0) {
            salonConnections.delete(salonId);
            connectionStats.activeSalons--;
          }
        }
        
        console.log(`WebSocket disconnected: salon ${salonId}`);
      });

      // Handle client errors
      ws.on('error', (error) => {
        console.error(`WebSocket error for salon ${salonId}:`, error);
      });

      // Handle ping/pong for connection health
      ws.on('pong', () => {
        ws.isAlive = true;
      });

      ws.isAlive = true;
      wss.emit('connection', ws, request, salonId);
    });
    
  } catch (error) {
    console.error('WebSocket authentication error:', error.message);
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
  }
});

// =============================================================================
// POSTGRES EVENT LISTENER
// =============================================================================

const pgClient = new Client({
  connectionString: DATABASE_URL
});

async function initializeEventListener() {
  try {
    await pgClient.connect();
    console.log('Connected to PostgreSQL for event listening');
    
    // Listen to service events channel
    await pgClient.query('LISTEN service_events');
    console.log('Listening to service_events channel');
    
    // Handle incoming events
    pgClient.on('notification', (msg) => {
      try {
        const payload = JSON.parse(msg.payload);
        handleIncomingEvent(payload);
      } catch (error) {
        console.error('Error parsing event payload:', error.message);
        console.error('Raw payload:', msg.payload);
      }
    });

    // Handle connection errors
    pgClient.on('error', (error) => {
      console.error('PostgreSQL connection error:', error);
      // Attempt to reconnect after delay
      setTimeout(initializeEventListener, 5000);
    });

  } catch (error) {
    console.error('Failed to connect to PostgreSQL:', error);
    // Retry connection after delay
    setTimeout(initializeEventListener, 5000);
  }
}

/**
 * Handle incoming events from Postgres NOTIFY
 */
function handleIncomingEvent(payload) {
  try {
    const { salon_id, event, data, timestamp } = payload;
    
    if (!salon_id) {
      console.warn('Event received without salon_id:', payload);
      return;
    }

    connectionStats.eventsProcessed++;
    
    // Find connections for this salon
    const connections = salonConnections.get(salon_id);
    
    if (!connections || connections.size === 0) {
      console.log(`No active connections for salon ${salon_id}, event: ${event}`);
      return;
    }

    // Prepare event for WebSocket clients
    const clientEvent = {
      type: 'event',
      event,
      data,
      timestamp: timestamp || new Date().toISOString(),
      salon_id
    };

    // Send to all active connections for this salon
    let sentCount = 0;
    for (const client of connections) {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(JSON.stringify(clientEvent));
          sentCount++;
        } catch (error) {
          console.error('Error sending event to WebSocket client:', error);
          // Remove broken connection
          connections.delete(client);
        }
      } else {
        // Remove closed connection
        connections.delete(client);
      }
    }

    console.log(`Event distributed: ${event} to ${sentCount} clients for salon ${salon_id}`);
    
  } catch (error) {
    console.error('Error handling incoming event:', error);
  }
}

// =============================================================================
// HEALTH CHECK & MONITORING
// =============================================================================

// Health check endpoint
app.get('/health', (req, res) => {
  const uptime = Math.floor((new Date() - connectionStats.startTime) / 1000);
  
  res.json({
    status: 'healthy',
    service: 'notifier',
    uptime_seconds: uptime,
    connections: {
      total: connectionStats.totalConnections,
      active_salons: connectionStats.activeSalons,
      events_processed: connectionStats.eventsProcessed
    },
    postgres: {
      connected: pgClient._connected || false
    },
    timestamp: new Date().toISOString()
  });
});

// WebSocket connection stats
app.get('/stats', (req, res) => {
  const salonStats = Array.from(salonConnections.entries()).map(([salonId, connections]) => ({
    salon_id: salonId,
    active_connections: connections.size
  }));

  res.json({
    connection_stats: connectionStats,
    salon_connections: salonStats,
    timestamp: new Date().toISOString()
  });
});

// =============================================================================
// CONNECTION HEALTH MONITORING
// =============================================================================

// Ping connected clients every 30 seconds
const heartbeatInterval = setInterval(() => {
  for (const [salonId, connections] of salonConnections.entries()) {
    for (const ws of connections) {
      if (ws.isAlive === false) {
        // Remove dead connection
        connections.delete(ws);
        ws.terminate();
        connectionStats.totalConnections--;
      } else {
        ws.isAlive = false;
        ws.ping();
      }
    }
    
    // Clean up empty salon pools
    if (connections.size === 0) {
      salonConnections.delete(salonId);
      connectionStats.activeSalons--;
    }
  }
}, 30000);

// =============================================================================
// SERVER STARTUP
// =============================================================================

server.listen(PORT, () => {
  console.log(`🚀 Notifier Service running on port ${PORT}`);
  console.log(`🔐 JWT authentication enabled`);
  console.log(`📡 WebSocket endpoint: ws://localhost:${PORT}/ws?token=<JWT>`);
  
  // Initialize Postgres event listener
  initializeEventListener();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Shutting down Notifier Service...');
  
  clearInterval(heartbeatInterval);
  
  // Close all WebSocket connections
  for (const connections of salonConnections.values()) {
    for (const ws of connections) {
      ws.close(1001, 'Server shutdown');
    }
  }
  
  // Close Postgres connection
  pgClient.end();
  
  server.close(() => {
    console.log('Notifier Service shut down gracefully');
    process.exit(0);
  });
});

module.exports = { app, server, connectionStats };