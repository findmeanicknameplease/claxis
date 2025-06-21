# Step-by-Step Render Deployment Guide

Perfect! Your webhook service is ready. Follow these exact steps:

## Step 1: Create GitHub Repository

1. **Go to GitHub.com** in your browser
2. **Sign in** with your account (findmeanicknameplease)
3. **Click "New repository"** (green button)
4. **Repository settings**:
   - Name: `gemini-salon-webhook`
   - Description: `WhatsApp webhook service for Gemini Salon AI`
   - ✅ Public (so Render can access it)
   - ❌ Don't initialize with README (we already have one)
5. **Click "Create repository"**

## Step 2: Push Your Code

After creating the repo, GitHub will show you commands. **Copy the "push an existing repository" commands** and run them:

```bash
# You'll run these in your terminal:
git remote add origin https://github.com/findmeanicknameplease/gemini-salon-webhook.git
git branch -M main
git push -u origin main
```

## Step 3: Deploy to Render

1. **Go to render.com** and sign in
2. **Click "New +"** → **"Web Service"**
3. **Connect GitHub**: Click "Connect GitHub" if not already connected
4. **Select Repository**: Find and select `gemini-salon-webhook`
5. **Configuration**:
   ```
   Name: gemini-salon-webhook
   Region: Frankfurt
   Branch: main
   Root Directory: (leave empty)
   Runtime: Node
   Build Command: npm install
   Start Command: npm start
   Instance Type: Free
   ```

## Step 4: Set Environment Variables

In Render dashboard, go to **Environment** tab and add:

```env
WHATSAPP_WEBHOOK_VERIFY_TOKEN=GeminiSalon2024SecureToken
WHATSAPP_APP_SECRET=your_meta_app_secret_here
NODE_ENV=production
```

## Step 5: Deploy!

1. **Click "Create Web Service"**
2. **Wait 3-5 minutes** for deployment
3. **Your webhook URL will be**: `https://gemini-salon-webhook.onrender.com/webhook`

## Step 6: Test Your Webhook

```bash
# Test verification endpoint
curl "https://gemini-salon-webhook.onrender.com/webhook?hub.mode=subscribe&hub.verify_token=GeminiSalon2024SecureToken&hub.challenge=test123"
```

Should return: `test123`

## Next: Configure WhatsApp

1. Go to **Meta Business Manager**
2. **WhatsApp** → **Configuration** → **Webhook**
3. **Callback URL**: `https://gemini-salon-webhook.onrender.com/webhook`
4. **Verify Token**: `GeminiSalon2024SecureToken`
5. **Subscribe to**: `messages`, `message_status`

## What You Get

✅ **Stable webhook URL** - No more tunneling issues
✅ **24/7 uptime** - Receive messages anytime
✅ **HTTPS security** - Required by WhatsApp
✅ **Detailed logging** - See all webhook events
✅ **Free hosting** - Render free tier is perfect for webhooks

---

**Need help?** Check the Render logs in the dashboard to see webhook activity!