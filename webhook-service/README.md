# Gemini Salon WhatsApp Webhook Service

Lightweight Node.js server dedicated to handling WhatsApp Business API webhooks.

## Features

- ✅ WhatsApp webhook verification
- 📨 Incoming message handling
- 📬 Message status updates
- 🔒 Signature verification
- 📊 Detailed logging
- 🚀 Optimized for Render deployment

## Environment Variables

```env
WHATSAPP_WEBHOOK_VERIFY_TOKEN=GeminiSalon2024SecureToken
WHATSAPP_APP_SECRET=your_meta_app_secret
PORT=3000
NODE_ENV=production
```

## Local Testing

```bash
npm install
npm start
```

Server runs on http://localhost:3000

## Render Deployment

1. Connect GitHub repo to Render
2. Use these settings:
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Region: Frankfurt
3. Set environment variables in Render dashboard
4. Deploy!

## Webhook URL

After deployment: `https://your-app.onrender.com/webhook`

## Test Verification

```bash
curl "https://your-app.onrender.com/webhook?hub.mode=subscribe&hub.verify_token=GeminiSalon2024SecureToken&hub.challenge=test123"
```

Should return: `test123`