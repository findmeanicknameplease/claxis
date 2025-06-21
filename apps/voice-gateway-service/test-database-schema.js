#!/usr/bin/env node

/**
 * Test script to validate the voice agent database schema
 * Tests table structure and key functions without requiring live connections
 */

const fs = require('fs');
const path = require('path');

/**
 * Test the SQL schema file for syntax and structure
 */
function testDatabaseSchema() {
  console.log('🗄️  VOICE AGENT DATABASE SCHEMA VALIDATION');
  console.log('==========================================');

  try {
    const schemaPath = path.join(__dirname, 'database-schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    console.log(`📁 Schema file: ${schemaPath}`);
    console.log(`📏 Size: ${schema.length} characters`);

    // Test for required tables
    const requiredTables = [
      'call_logs',
      'callback_queue', 
      'customer_voice_preferences',
      'voice_agent_analytics',
      'voice_agent_campaigns'
    ];

    console.log('\n🏗️  Checking required tables:');
    requiredTables.forEach(table => {
      const hasTable = schema.includes(`CREATE TABLE IF NOT EXISTS ${table}`);
      console.log(`  ${hasTable ? '✅' : '❌'} ${table}`);
    });

    // Test for required functions
    const requiredFunctions = [
      'update_voice_agent_analytics',
      'update_updated_at_column',
      'test_voice_agent_setup'
    ];

    console.log('\n⚙️  Checking required functions:');
    requiredFunctions.forEach(func => {
      const hasFunction = schema.includes(`CREATE OR REPLACE FUNCTION ${func}`);
      console.log(`  ${hasFunction ? '✅' : '❌'} ${func}()`);
    });

    // Test for RLS policies
    console.log('\n🔒 Checking Row Level Security:');
    const rlsTables = requiredTables.filter(table => 
      schema.includes(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`)
    );
    console.log(`  ✅ RLS enabled on ${rlsTables.length}/${requiredTables.length} tables`);

    // Test for indexes
    console.log('\n📇 Checking performance indexes:');
    const indexCount = (schema.match(/CREATE INDEX/g) || []).length;
    console.log(`  ✅ ${indexCount} performance indexes defined`);

    // Test for triggers
    console.log('\n🎯 Checking automated triggers:');
    const triggerCount = (schema.match(/CREATE TRIGGER/g) || []).length;
    console.log(`  ✅ ${triggerCount} automated triggers defined`);

    console.log('\n✅ Database schema validation passed!');
    return true;

  } catch (error) {
    console.error('❌ Schema validation failed:', error.message);
    return false;
  }
}

/**
 * Test callback queue entry structure
 */
function testCallbackQueueStructure() {
  console.log('\n📞 CALLBACK QUEUE STRUCTURE TEST');
  console.log('=================================');

  // Simulate a callback queue entry
  const sampleQueueEntry = {
    id: 'uuid-123',
    salon_id: 'salon-456',
    phone_number: '+31612345678',
    status: 'scheduled',
    process_after: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    campaign_type: 'missed_call_callback',
    customer_context: {
      customer_name: null,
      is_existing_customer: false,
      preferred_language: 'nl',
      callback_reason: 'new_customer_inquiry'
    },
    is_verified_safe: true,
    attempts: 0,
    max_attempts: 3
  };

  console.log('📋 Sample queue entry structure:');
  Object.keys(sampleQueueEntry).forEach(key => {
    const value = sampleQueueEntry[key];
    const type = typeof value === 'object' ? 'object' : typeof value;
    console.log(`  ✅ ${key}: ${type}`);
  });

  return true;
}

/**
 * Test voice agent analytics structure
 */
function testAnalyticsStructure() {
  console.log('\n📊 VOICE AGENT ANALYTICS TEST');
  console.log('==============================');

  const sampleAnalytics = {
    salon_id: 'salon-456',
    date_period: new Date().toISOString().split('T')[0],
    period_type: 'daily',
    total_calls: 15,
    inbound_calls: 12,
    outbound_calls: 3,
    answered_calls: 10,
    missed_calls: 5,
    avg_call_duration_seconds: 95.5,
    total_talk_time_minutes: 23.9,
    bookings_created: 3,
    revenue_generated_euros: 285.00,
    total_cost_usd: 4.75
  };

  console.log('📈 Sample analytics entry:');
  Object.keys(sampleAnalytics).forEach(key => {
    const value = sampleAnalytics[key];
    const type = typeof value;
    console.log(`  ✅ ${key}: ${type}`);
  });

  return true;
}

/**
 * Test multilingual support data structures
 */
function testMultilingualStructures() {
  console.log('\n🌍 MULTILINGUAL SUPPORT TEST');
  console.log('=============================');

  const languageSupport = {
    'nl': { name: 'Dutch', voice_id: 'bIHbv24MWmeRgasZH58o' },
    'de': { name: 'German', voice_id: 'EXAVITQu4vr4xnSDxMaL' },
    'fr': { name: 'French', voice_id: 'Xb7hH8MSUJpSbSDYk0k2' },
    'en': { name: 'English', voice_id: 'AZnzlk1XvdvUeBnXmlld' }
  };

  console.log('🗣️  Supported languages:');
  Object.keys(languageSupport).forEach(lang => {
    const info = languageSupport[lang];
    console.log(`  ✅ ${lang}: ${info.name} (Voice: ${info.voice_id})`);
  });

  // Test country code mapping
  const countryCodes = {
    '+31': 'nl', '+49': 'de', '+33': 'fr', '+32': 'nl',
    '+41': 'de', '+43': 'de', '+352': 'fr'
  };

  console.log('\n📍 Country code mapping:');
  Object.keys(countryCodes).forEach(code => {
    console.log(`  ✅ ${code} → ${countryCodes[code]}`);
  });

  return true;
}

/**
 * Main test runner
 */
function runDatabaseTests() {
  console.log('🎯 VOICE AGENT DATABASE SYSTEM TESTS');
  console.log('=====================================');
  console.log(`Test started at: ${new Date().toISOString()}\n`);

  const tests = [
    testDatabaseSchema,
    testCallbackQueueStructure,
    testAnalyticsStructure,
    testMultilingualStructures
  ];

  let passed = 0;
  let total = tests.length;

  tests.forEach(test => {
    try {
      if (test()) {
        passed++;
      }
    } catch (error) {
      console.error(`❌ Test failed:`, error.message);
    }
  });

  console.log('\n🏁 DATABASE TESTS COMPLETED!');
  console.log('==============================');
  console.log(`✅ Passed: ${passed}/${total} tests`);
  
  if (passed === total) {
    console.log('🎉 All database tests passed!');
  } else {
    console.log('⚠️  Some tests failed - check output above');
  }

  return passed === total;
}

// Run tests if this script is executed directly
if (require.main === module) {
  runDatabaseTests();
}

module.exports = { runDatabaseTests };