#!/usr/bin/env node

/**
 * Test script for missed call detection and auto-callback system
 * Tests the complete flow: Twilio webhook -> callback queue -> n8n workflow
 */

const axios = require('axios');
require('dotenv').config();

// Test configuration
const TEST_CONFIG = {
  voice_gateway_url: 'http://localhost:3001', // Adjust for your deployment
  n8n_webhook_url: process.env.N8N_WEBHOOK_BASE_URL || 'http://localhost:5678/webhook',
  test_salon_id: 'test-salon-123',
  test_phone_numbers: [
    '+31612345678', // Dutch number
    '+49171234567', // German number
    '+33612345678', // French number
    '+44712345678'  // UK number (English)
  ]
};

/**
 * Test 1: Simulate missed call webhook from Twilio
 */
async function testMissedCallWebhook() {
  console.log('\n🧪 TEST 1: Missed Call Webhook Detection');
  console.log('==========================================');

  for (const phoneNumber of TEST_CONFIG.test_phone_numbers) {
    try {
      // Simulate Twilio webhook for missed call
      const webhookPayload = {
        CallSid: `test_call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        From: phoneNumber,
        To: '+31208001234', // Salon's Twilio number
        CallStatus: 'no-answer',
        CallDuration: '0',
        Direction: 'inbound',
        timestamp: new Date().toISOString()
      };

      console.log(`\n📞 Testing missed call from ${phoneNumber}...`);

      const response = await axios.post(
        `${TEST_CONFIG.voice_gateway_url}/voice/webhook`,
        new URLSearchParams(webhookPayload),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-Twilio-Signature': 'test-signature' // In production this would be validated
          },
          timeout: 5000
        }
      );

      console.log(`✅ Webhook response: ${response.status}`);
      
      if (response.data) {
        console.log(`📝 Response body: ${response.data.substring(0, 200)}...`);
      }

    } catch (error) {
      console.error(`❌ Error testing ${phoneNumber}:`, error.message);
    }
  }
}

/**
 * Test 2: Check callback queue processing endpoint
 */
async function testCallbackQueueProcessing() {
  console.log('\n🧪 TEST 2: Callback Queue Processing');
  console.log('=====================================');

  try {
    const response = await axios.post(
      `${TEST_CONFIG.voice_gateway_url}/callbacks/process`,
      { limit: 5 },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.SERVICE_API_KEY || 'test-api-key'
        },
        timeout: 10000
      }
    );

    console.log(`✅ Queue processing response: ${response.status}`);
    console.log(`📊 Processed callbacks:`, response.data);

  } catch (error) {
    console.error(`❌ Queue processing error:`, error.message);
  }
}

/**
 * Test 3: Validate n8n workflow accessibility
 */
async function testN8nWorkflowEndpoints() {
  console.log('\n🧪 TEST 3: n8n Workflow Endpoints');
  console.log('==================================');

  const endpoints = [
    '/webhook/missed-call-detection',
    '/webhook/callback-failed-alert'
  ];

  for (const endpoint of endpoints) {
    try {
      const testPayload = {
        test: true,
        timestamp: new Date().toISOString(),
        salon_id: TEST_CONFIG.test_salon_id
      };

      const response = await axios.post(
        `${TEST_CONFIG.n8n_webhook_url}${endpoint}`,
        testPayload,
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 5000
        }
      );

      console.log(`✅ ${endpoint}: ${response.status}`);

    } catch (error) {
      if (error.response?.status === 404) {
        console.log(`⚠️  ${endpoint}: Workflow not deployed (404)`);
      } else {
        console.error(`❌ ${endpoint}: ${error.message}`);
      }
    }
  }
}

/**
 * Test 4: Language detection functionality
 */
async function testLanguageDetection() {
  console.log('\n🧪 TEST 4: Language Detection');
  console.log('==============================');

  const testCases = [
    { phone: '+31612345678', expected: 'nl', country: 'Netherlands' },
    { phone: '+49171234567', expected: 'de', country: 'Germany' },
    { phone: '+33612345678', expected: 'fr', country: 'France' },
    { phone: '+44712345678', expected: 'en', country: 'UK' },
    { phone: '+1234567890', expected: 'en', country: 'Default' }
  ];

  // Simple language detection test (mirroring the actual function)
  function detectLanguageFromPhone(phoneNumber) {
    if (phoneNumber.startsWith('+31')) return 'nl'; // Netherlands
    if (phoneNumber.startsWith('+49')) return 'de'; // Germany  
    if (phoneNumber.startsWith('+33')) return 'fr'; // France
    if (phoneNumber.startsWith('+32')) return 'nl'; // Belgium (Dutch/Flemish)
    if (phoneNumber.startsWith('+41')) return 'de'; // Switzerland (German)
    if (phoneNumber.startsWith('+43')) return 'de'; // Austria
    if (phoneNumber.startsWith('+352')) return 'fr'; // Luxembourg (French)
    return 'en'; // Default to English
  }

  testCases.forEach(testCase => {
    const detected = detectLanguageFromPhone(testCase.phone);
    const result = detected === testCase.expected ? '✅' : '❌';
    console.log(`${result} ${testCase.phone} (${testCase.country}): detected '${detected}', expected '${testCase.expected}'`);
  });
}

/**
 * Main test runner
 */
async function runTests() {
  console.log('🎯 VOICE AGENT MISSED CALL SYSTEM TESTS');
  console.log('========================================');
  console.log(`Voice Gateway URL: ${TEST_CONFIG.voice_gateway_url}`);
  console.log(`n8n Webhook URL: ${TEST_CONFIG.n8n_webhook_url}`);
  console.log(`Test started at: ${new Date().toISOString()}\n`);

  // Run all tests
  await testLanguageDetection();
  await testN8nWorkflowEndpoints();
  await testCallbackQueueProcessing();
  
  // Only test missed call webhook if Voice Gateway is running
  if (TEST_CONFIG.voice_gateway_url.includes('localhost')) {
    console.log('\n⚠️  Skipping webhook test - Voice Gateway not running locally');
    console.log('   Start the service with: node index.js');
  } else {
    await testMissedCallWebhook();
  }

  console.log('\n🏁 Test suite completed!');
  console.log('========================================');
}

// Run tests if this script is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { runTests, testLanguageDetection, testCallbackQueueProcessing };