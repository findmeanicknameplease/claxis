// Integration Test: Voice Call Flow
// Phase 1D: Testing & Validation

const request = require('supertest');
const { Client } = require('pg');
const WebSocket = require('ws');
const jwt = require('jsonwebtoken');

describe('Voice Call Integration Flow', () => {
  let pgClient;
  let testSalonId;
  let authToken;
  let notifierWs;

  beforeAll(async () => {
    // Setup test database connection
    pgClient = new Client({
      connectionString: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL
    });
    await pgClient.connect();

    // Create test salon
    const salonResult = await pgClient.query(`
      INSERT INTO salons (id, business_name, twilio_phone_number, subscription_tier)
      VALUES (gen_random_uuid(), 'Test Salon', '+1234567890', 'enterprise')
      RETURNING id
    `);
    testSalonId = salonResult.rows[0].id;

    // Create test JWT token
    authToken = jwt.sign(
      { 
        user: { 
          salon: { id: testSalonId },
          role: 'owner' 
        } 
      },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );
  });

  afterAll(async () => {
    // Cleanup
    await pgClient.query('DELETE FROM salons WHERE id = $1', [testSalonId]);
    await pgClient.end();
    
    if (notifierWs) {
      notifierWs.close();
    }
  });

  describe('End-to-End Voice Call Flow', () => {
    it('should propagate call events from Voice Gateway to Frontend Dashboard', async () => {
      // Step 1: Setup WebSocket connection to Notifier service
      const wsPromise = new Promise((resolve, reject) => {
        const wsUrl = `ws://localhost:3001/ws?token=${encodeURIComponent(authToken)}`;
        notifierWs = new WebSocket(wsUrl);

        notifierWs.on('open', () => {
          console.log('WebSocket connected to Notifier service');
          resolve();
        });

        notifierWs.on('error', (error) => {
          console.error('WebSocket connection error:', error);
          reject(error);
        });

        setTimeout(() => reject(new Error('WebSocket connection timeout')), 5000);
      });

      await wsPromise;

      // Step 2: Listen for events on WebSocket
      const receivedEvents = [];
      notifierWs.on('message', (data) => {
        const event = JSON.parse(data.toString());
        receivedEvents.push(event);
        console.log('Received WebSocket event:', event.type, event.event);
      });

      // Step 3: Simulate Twilio webhook call (Voice Gateway publishes event)
      const callStartedEvent = await pgClient.query(`
        SELECT publish_event_with_log($1, $2, $3) as event_id
      `, [
        testSalonId,
        'call.started',
        {
          call_sid: 'test-call-123',
          phone_number: '+1987654321',
          direction: 'inbound',
          language: 'en',
          salon_open: true
        }
      ]);

      const eventId = callStartedEvent.rows[0].event_id;

      // Step 4: Wait for WebSocket event propagation
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Step 5: Verify WebSocket received the event
      const callStartedWsEvent = receivedEvents.find(e => e.event === 'call.started');
      expect(callStartedWsEvent).toBeDefined();
      expect(callStartedWsEvent.data.call_sid).toBe('test-call-123');
      expect(callStartedWsEvent.salon_id).toBe(testSalonId);

      // Step 6: Simulate call ended event
      await pgClient.query(`
        SELECT publish_event_with_log($1, $2, $3)
      `, [
        testSalonId,
        'call.ended',
        {
          call_sid: 'test-call-123',
          duration_seconds: 120,
          outcome: 'booking_scheduled',
          summary: 'Customer scheduled haircut appointment',
          customer_satisfied: true
        }
      ]);

      // Step 7: Wait and verify call ended event
      await new Promise(resolve => setTimeout(resolve, 1000));

      const callEndedWsEvent = receivedEvents.find(e => e.event === 'call.ended');
      expect(callEndedWsEvent).toBeDefined();
      expect(callEndedWsEvent.data.call_sid).toBe('test-call-123');
      expect(callEndedWsEvent.data.outcome).toBe('booking_scheduled');

      // Step 8: Verify database state
      const systemEvents = await pgClient.query(`
        SELECT * FROM system_events 
        WHERE salon_id = $1 
        ORDER BY created_at DESC 
        LIMIT 2
      `, [testSalonId]);

      expect(systemEvents.rows).toHaveLength(2);
      expect(systemEvents.rows[0].event_type).toBe('call.ended');
      expect(systemEvents.rows[1].event_type).toBe('call.started');

      console.log('✅ Voice call flow test completed successfully');
    }, 15000);

    it('should handle n8n workflow triggering', async () => {
      // Mock n8n webhook response
      const mockN8nServer = require('express')();
      mockN8nServer.use(require('express').json());
      
      const receivedWebhooks = [];
      mockN8nServer.post('/webhook/*', (req, res) => {
        receivedWebhooks.push({
          path: req.path,
          body: req.body,
          timestamp: new Date()
        });
        res.json({ success: true });
      });

      const server = mockN8nServer.listen(5679);

      try {
        // Set test n8n webhook URL
        process.env.N8N_WEBHOOK_URL = 'http://localhost:5679/webhook/salon-events';

        // Trigger event that should reach n8n bridge
        await pgClient.query(`
          SELECT publish_event_with_log($1, $2, $3)
        `, [
          testSalonId,
          'booking.intent_detected',
          {
            call_sid: 'test-call-124',
            confidence: 0.92,
            service_type: 'Premium Facial',
            customer_info: {
              name: 'Test Customer',
              phone: '+1987654321'
            }
          }
        ]);

        // Wait for n8n bridge to process
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Verify n8n webhook was called
        expect(receivedWebhooks).toHaveLength(1);
        
        const webhook = receivedWebhooks[0];
        expect(webhook.path).toBe('/webhook/booking-intent');
        expect(webhook.body.event).toBe('booking.intent_detected');
        expect(webhook.body.salon_id).toBe(testSalonId);
        expect(webhook.body.data.confidence).toBe(0.92);

        console.log('✅ n8n workflow trigger test completed successfully');

      } finally {
        server.close();
      }
    }, 10000);
  });

  describe('Multi-Tenant Security Isolation', () => {
    it('should enforce salon isolation in WebSocket connections', async () => {
      // Create second test salon
      const salon2Result = await pgClient.query(`
        INSERT INTO salons (id, business_name, twilio_phone_number, subscription_tier)
        VALUES (gen_random_uuid(), 'Test Salon 2', '+1234567891', 'enterprise')
        RETURNING id
      `);
      const testSalon2Id = salon2Result.rows[0].id;

      // Create JWT for second salon
      const authToken2 = jwt.sign(
        { 
          user: { 
            salon: { id: testSalon2Id },
            role: 'owner' 
          } 
        },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '1h' }
      );

      try {
        // Setup WebSocket for salon 2
        const wsUrl2 = `ws://localhost:3001/ws?token=${encodeURIComponent(authToken2)}`;
        const notifierWs2 = new WebSocket(wsUrl2);

        await new Promise((resolve, reject) => {
          notifierWs2.on('open', resolve);
          notifierWs2.on('error', reject);
          setTimeout(() => reject(new Error('Connection timeout')), 5000);
        });

        const salon2Events = [];
        notifierWs2.on('message', (data) => {
          salon2Events.push(JSON.parse(data.toString()));
        });

        // Publish event for salon 1
        await pgClient.query(`
          SELECT publish_event_with_log($1, $2, $3)
        `, [
          testSalonId,
          'call.started',
          { call_sid: 'isolation-test-call', phone_number: '+1111111111' }
        ]);

        // Wait for event propagation
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Verify salon 2 did NOT receive salon 1's event
        const receivedCallEvents = salon2Events.filter(e => e.event === 'call.started');
        expect(receivedCallEvents).toHaveLength(0);

        console.log('✅ Multi-tenant isolation test completed successfully');

        notifierWs2.close();

      } finally {
        // Cleanup salon 2
        await pgClient.query('DELETE FROM salons WHERE id = $1', [testSalon2Id]);
      }
    }, 10000);

    it('should enforce RLS policies in BFF API', async () => {
      // Create test data for current salon
      const callResult = await pgClient.query(`
        INSERT INTO call_logs (salon_id, twilio_call_sid, phone_number, direction, call_status)
        VALUES ($1, 'test-call-rls', '+1234567890', 'inbound', 'completed')
        RETURNING id
      `, [testSalonId]);

      // Create another salon and call (should not be accessible)
      const otherSalonResult = await pgClient.query(`
        INSERT INTO salons (id, business_name, subscription_tier)
        VALUES (gen_random_uuid(), 'Other Salon', 'professional')
        RETURNING id
      `);
      const otherSalonId = otherSalonResult.rows[0].id;

      await pgClient.query(`
        INSERT INTO call_logs (salon_id, twilio_call_sid, phone_number, direction, call_status)
        VALUES ($1, 'other-salon-call', '+1111111111', 'inbound', 'completed')
      `, [otherSalonId]);

      try {
        // Test BFF API with current salon context
        const bffResponse = await request('http://localhost:3000')
          .get('/api/bff?endpoint=recent-calls')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        const calls = bffResponse.body.calls;
        
        // Verify only current salon's calls are returned
        expect(calls).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              twilio_call_sid: 'test-call-rls'
            })
          ])
        );

        // Verify other salon's call is NOT returned
        const otherSalonCall = calls.find(c => c.twilio_call_sid === 'other-salon-call');
        expect(otherSalonCall).toBeUndefined();

        console.log('✅ RLS policy enforcement test completed successfully');

      } finally {
        // Cleanup
        await pgClient.query('DELETE FROM salons WHERE id = $1', [otherSalonId]);
      }
    }, 8000);
  });

  describe('Error Recovery and Resilience', () => {
    it('should handle WebSocket reconnection after disconnection', async () => {
      // Force disconnect WebSocket
      if (notifierWs) {
        notifierWs.close();
      }

      // Wait for disconnection
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Reconnect
      const wsUrl = `ws://localhost:3001/ws?token=${encodeURIComponent(authToken)}`;
      notifierWs = new WebSocket(wsUrl);

      await new Promise((resolve, reject) => {
        notifierWs.on('open', resolve);
        notifierWs.on('error', reject);
        setTimeout(() => reject(new Error('Reconnection failed')), 5000);
      });

      // Test that events are received after reconnection
      const postReconnectEvents = [];
      notifierWs.on('message', (data) => {
        postReconnectEvents.push(JSON.parse(data.toString()));
      });

      // Publish test event
      await pgClient.query(`
        SELECT publish_event_with_log($1, $2, $3)
      `, [
        testSalonId,
        'system.health',
        { status: 'healthy', test: 'reconnection' }
      ]);

      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify event was received after reconnection
      const healthEvent = postReconnectEvents.find(e => e.event === 'system.health');
      expect(healthEvent).toBeDefined();
      expect(healthEvent.data.test).toBe('reconnection');

      console.log('✅ WebSocket reconnection test completed successfully');
    }, 10000);
  });
});