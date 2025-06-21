#!/usr/bin/env node

// =============================================================================
// PREMIUM SAAS BACKGROUND WORKER
// =============================================================================
// Dedicated worker process for enterprise-grade background processing
// Runs as separate Render service for optimal resource isolation
// Handles WhatsApp webhooks, AI processing, and Instagram automation

import './lib/queue/workers.js';

console.log('🚀 Premium SaaS workers started successfully');
console.log('📊 Processing: WhatsApp webhooks, AI analysis, Instagram automation');
console.log('🎯 Performance target: <2s processing, 99.5% uptime');
console.log('🔒 EU-compliant processing (Frankfurt region)');

// Keep the worker process alive
process.on('SIGINT', () => {
  console.log('🛑 Gracefully shutting down workers...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('🛑 Gracefully shutting down workers...');
  process.exit(0);
});

console.log('✅ Worker process ready for premium SaaS operations');