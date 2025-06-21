// Minimal WhatsApp Webhook Server for Render
// This is a lightweight alternative if you only need webhook handling

const express = require('express');
const crypto = require('crypto');
const app = express();

// Parse JSON bodies
app.use(express.json());

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'WhatsApp Webhook Handler',
    timestamp: new Date().toISOString()
  });
});

// WhatsApp webhook verification (GET)
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  console.log('Webhook verification request:', { mode, token, challenge });

  if (mode === 'subscribe' && token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
    console.log('Webhook verified successfully');
    res.status(200).send(challenge);
  } else {
    console.error('Webhook verification failed');
    res.sendStatus(403);
  }
});

// WhatsApp webhook events (POST)
app.post('/webhook', async (req, res) => {
  try {
    console.log('Webhook received:', JSON.stringify(req.body, null, 2));

    // Verify signature if app secret is set
    if (process.env.WHATSAPP_APP_SECRET) {
      const signature = req.get('x-hub-signature-256');
      const expectedSignature = crypto
        .createHmac('sha256', process.env.WHATSAPP_APP_SECRET)
        .update(JSON.stringify(req.body))
        .digest('hex');
      
      if (signature !== `sha256=${expectedSignature}`) {
        console.error('Invalid webhook signature');
        return res.sendStatus(401);
      }
    }

    // Process webhook data
    if (req.body.entry) {
      for (const entry of req.body.entry) {
        const changes = entry.changes || [];
        
        for (const change of changes) {
          const value = change.value;
          
          // Handle incoming messages
          if (value.messages) {
            for (const message of value.messages) {
              console.log('📱 Incoming message:', {
                from: message.from,
                name: value.contacts?.[0]?.profile?.name,
                type: message.type,
                text: message.text?.body,
                timestamp: new Date(parseInt(message.timestamp) * 1000).toISOString()
              });

              // TODO: Forward to your main app via webhook or queue
              // Example: await forwardToMainApp(message);
            }
          }
          
          // Handle status updates
          if (value.statuses) {
            for (const status of value.statuses) {
              console.log('📬 Status update:', {
                messageId: status.id,
                status: status.status,
                timestamp: new Date(parseInt(status.timestamp) * 1000).toISOString()
              });
            }
          }
        }
      }
    }

    // Always return 200 to acknowledge
    res.sendStatus(200);

  } catch (error) {
    console.error('Webhook error:', error);
    // Still return 200 to prevent retries
    res.sendStatus(200);
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ WhatsApp webhook server running on port ${PORT}`);
  console.log(`📍 Webhook URL: https://your-app.onrender.com/webhook`);
  console.log(`🔑 Verify token: ${process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN}`);
});