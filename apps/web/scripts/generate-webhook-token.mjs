#!/usr/bin/env node

// =============================================================================
// SECURE WEBHOOK TOKEN GENERATOR
// =============================================================================
// Generates cryptographically secure tokens for WhatsApp webhook verification
// Usage: node scripts/generate-webhook-token.js

import crypto from 'crypto';

/**
 * Generate a secure webhook verify token
 */
function generateSecureToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Generate production-ready WhatsApp webhook tokens
 */
function generateWebhookTokens() {
  console.log('🔐 Generating Secure WhatsApp Webhook Tokens\n');
  
  // Generate verification token for Meta Developer Console
  const verifyToken = generateSecureToken(32);
  
  // Generate app secret for HMAC signature validation (if needed)
  const appSecret = generateSecureToken(32);
  
  console.log('📋 Add these to your Render Environment Variables:\n');
  console.log('WHATSAPP_WEBHOOK_VERIFY_TOKEN=' + verifyToken);
  console.log('WHATSAPP_APP_SECRET=' + appSecret);
  
  console.log('\n📱 Configure in Meta Developer Console:');
  console.log('Verify Token: ' + verifyToken);
  
  console.log('\n🔄 Token Rotation Schedule:');
  console.log('- Quarterly rotation recommended for enterprise security');
  console.log('- Update Render environment variables first');
  console.log('- Deploy application with new tokens');
  console.log('- Update Meta Developer Console with new verify token');
  
  console.log('\n✅ Tokens generated successfully!');
  console.log('Store these securely and never commit to version control.');
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  generateWebhookTokens();
}

export { generateSecureToken, generateWebhookTokens };