// Mock n8n Server for Integration Testing
// Simulates n8n webhook endpoints

const express = require('express');
const app = express();
const PORT = 5678;

app.use(express.json());

// Store received webhooks for testing
const receivedWebhooks = [];

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'mock-n8n' });
});

// Generic webhook endpoint
app.post('/webhook/*', (req, res) => {
  const webhook = {
    path: req.path,
    method: req.method,
    headers: req.headers,
    body: req.body,
    timestamp: new Date().toISOString()
  };
  
  receivedWebhooks.push(webhook);
  
  console.log(`📥 Mock n8n received webhook: ${req.path}`);
  console.log(`   Event: ${req.body.event}`);
  console.log(`   Salon: ${req.body.salon_id}`);
  
  // Simulate n8n processing delay
  setTimeout(() => {
    res.json({ 
      success: true, 
      webhook_id: `mock_${Date.now()}`,
      processed_at: new Date().toISOString()
    });
  }, 100);
});

// Test endpoint to retrieve received webhooks
app.get('/test/webhooks', (req, res) => {
  res.json({
    total: receivedWebhooks.length,
    webhooks: receivedWebhooks
  });
});

// Clear webhooks for testing
app.delete('/test/webhooks', (req, res) => {
  receivedWebhooks.length = 0;
  res.json({ message: 'Webhooks cleared' });
});

app.listen(PORT, () => {
  console.log(`🎭 Mock n8n server running on port ${PORT}`);
  console.log(`📡 Webhook endpoints: POST /webhook/*`);
  console.log(`🧪 Test endpoints: GET/DELETE /test/webhooks`);
});