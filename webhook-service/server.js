// WhatsApp Webhook Server for Render
// Lightweight server dedicated to handling WhatsApp webhooks
const express = require('express');
const crypto = require('crypto');
const app = express();

// Parse JSON bodies
app.use(express.json());

// CORS for development
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'Gemini Salon WhatsApp Webhook',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// WhatsApp webhook verification (GET)
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  console.log('🔍 Webhook verification request:', { 
    mode, 
    token: token ? '***' + token.slice(-4) : 'missing',
    challenge 
  });

  if (mode === 'subscribe' && token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
    console.log('✅ Webhook verified successfully');
    res.status(200).send(challenge);
  } else {
    console.error('❌ Webhook verification failed - token mismatch');
    console.error('Expected:', process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN ? '***' + process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN.slice(-4) : 'not set');
    res.sendStatus(403);
  }
});

// WhatsApp webhook events (POST)
app.post('/webhook', async (req, res) => {
  try {
    console.log('📨 Webhook received at:', new Date().toISOString());
    console.log('📨 Raw webhook data:', JSON.stringify(req.body, null, 2));

    // Verify signature if app secret is set
    if (process.env.WHATSAPP_APP_SECRET) {
      const signature = req.get('x-hub-signature-256');
      if (signature) {
        const expectedSignature = crypto
          .createHmac('sha256', process.env.WHATSAPP_APP_SECRET)
          .update(JSON.stringify(req.body))
          .digest('hex');
        
        if (signature !== `sha256=${expectedSignature}`) {
          console.error('❌ Invalid webhook signature');
          return res.sendStatus(401);
        }
        console.log('✅ Webhook signature verified');
      }
    }

    // Process webhook data
    if (req.body.entry && req.body.entry.length > 0) {
      for (const entry of req.body.entry) {
        console.log('📋 Processing entry ID:', entry.id);
        const changes = entry.changes || [];
        
        for (const change of changes) {
          const value = change.value;
          console.log('🔄 Change field:', change.field);
          
          // Handle incoming messages
          if (value.messages && value.messages.length > 0) {
            for (const message of value.messages) {
              const contact = value.contacts?.find(c => c.wa_id === message.from);
              
              console.log('💬 INCOMING MESSAGE:', {
                messageId: message.id,
                from: message.from,
                name: contact?.profile?.name || 'Unknown',
                type: message.type,
                text: message.text?.body,
                timestamp: new Date(parseInt(message.timestamp) * 1000).toISOString(),
                businessPhoneNumberId: value.metadata?.phone_number_id
              });

              // TODO: Here you can:
              // - Store message in database
              // - Trigger n8n workflows
              // - Send auto-replies
              // - Forward to your main app
              
              if (message.text?.body) {
                console.log(`📝 Message text: "${message.text.body}"`);
                
                // Example: Simple auto-reply logic
                if (message.text.body.toLowerCase().includes('hello')) {
                  console.log('🤖 Auto-reply triggered for greeting');
                  // TODO: Send auto-reply via WhatsApp API
                }
              }
            }
          }
          
          // Handle message status updates
          if (value.statuses && value.statuses.length > 0) {
            for (const status of value.statuses) {
              console.log('📬 MESSAGE STATUS UPDATE:', {
                messageId: status.id,
                recipientId: status.recipient_id,
                status: status.status,
                timestamp: new Date(parseInt(status.timestamp) * 1000).toISOString(),
                conversation: status.conversation
              });

              // TODO: Update message status in your database
            }
          }

          // Handle other webhook events
          if (value.message_template_status_update) {
            console.log('📋 Template status update:', value.message_template_status_update);
          }
        }
      }
    } else {
      console.log('ℹ️ No entry data in webhook');
    }

    // Always return 200 to acknowledge receipt
    res.status(200).json({ received: true });

  } catch (error) {
    console.error('💥 Webhook processing error:', error);
    console.error('Error stack:', error.stack);
    // Still return 200 to prevent WhatsApp from retrying
    res.status(200).json({ received: true, error: 'Processing error' });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('💥 Express error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('🚀 WhatsApp Webhook Server Started');
  console.log('🌍 Port:', PORT);
  console.log('📍 Webhook URL: /webhook');
  console.log('🔑 Verify Token:', process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN ? '✅ Set' : '❌ Missing');
  console.log('🔐 App Secret:', process.env.WHATSAPP_APP_SECRET ? '✅ Set' : '⚠️ Missing (optional)');
  console.log('⏰ Started at:', new Date().toISOString());
  
  if (process.env.NODE_ENV === 'production') {
    console.log('🌐 Production webhook URL: https://your-app.onrender.com/webhook');
  } else {
    console.log('🏠 Local webhook URL: http://localhost:' + PORT + '/webhook');
  }
});