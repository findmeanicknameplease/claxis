#!/usr/bin/env tsx
import { VoiceGatewayService } from './index';

// =============================================================================
// VOICE GATEWAY SERVICE STARTUP SCRIPT
// =============================================================================
// Enterprise voice agent startup for premium €299.99/month tier
// Handles graceful startup, configuration validation, and health monitoring
// =============================================================================

interface EnvironmentConfig {
  port: number;
  twilioAccountSid: string;
  twilioAuthToken: string;
  elevenLabsApiKey: string;
  elevenLabsAgentId: string;
  upstashRedisUrl: string;
  upstashRedisToken: string;
  maxConcurrentCalls: number;
  audioBufferSize: number;
}

async function validateEnvironment(): Promise<EnvironmentConfig> {
  const requiredEnvVars = [
    'TWILIO_ACCOUNT_SID',
    'TWILIO_AUTH_TOKEN', 
    'ELEVENLABS_API_KEY',
    'ELEVENLABS_AGENT_ID',
    'UPSTASH_REDIS_REST_URL',
    'UPSTASH_REDIS_REST_TOKEN'
  ];

  const missing = requiredEnvVars.filter(envVar => !process.env[envVar]);
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(envVar => console.error(`   - ${envVar}`));
    console.error('\n📋 Required environment variables for Voice Gateway:');
    console.error('   TWILIO_ACCOUNT_SID=your_twilio_account_sid');
    console.error('   TWILIO_AUTH_TOKEN=your_twilio_auth_token');
    console.error('   ELEVENLABS_API_KEY=your_elevenlabs_api_key');
    console.error('   ELEVENLABS_AGENT_ID=your_agent_id');
    console.error('   UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io');
    console.error('   UPSTASH_REDIS_REST_TOKEN=your_redis_token');
    process.exit(1);
  }

  return {
    port: parseInt(process.env['VOICE_GATEWAY_PORT'] || '8080'),
    twilioAccountSid: process.env['TWILIO_ACCOUNT_SID']!,
    twilioAuthToken: process.env['TWILIO_AUTH_TOKEN']!,
    elevenLabsApiKey: process.env['ELEVENLABS_API_KEY']!,
    elevenLabsAgentId: process.env['ELEVENLABS_AGENT_ID']!,
    upstashRedisUrl: process.env['UPSTASH_REDIS_REST_URL']!,
    upstashRedisToken: process.env['UPSTASH_REDIS_REST_TOKEN']!,
    maxConcurrentCalls: parseInt(process.env['MAX_CONCURRENT_CALLS'] || '100'),
    audioBufferSize: parseInt(process.env['AUDIO_BUFFER_SIZE'] || '50'),
  };
}

async function main() {
  console.log('🎯 Starting Voice Gateway Service for Premium Voice Agent...\n');

  try {
    // Validate environment configuration
    console.log('📋 Validating environment configuration...');
    const config = await validateEnvironment();
    console.log('✅ Environment configuration valid\n');

    // Display configuration (without sensitive data)
    console.log('🔧 Voice Gateway Configuration:');
    console.log(`   Port: ${config.port}`);
    console.log(`   Max Concurrent Calls: ${config.maxConcurrentCalls}`);
    console.log(`   Audio Buffer Size: ${config.audioBufferSize} chunks`);
    console.log(`   Twilio Account: ${config.twilioAccountSid.substring(0, 10)}...`);
    console.log(`   ElevenLabs Agent: ${config.elevenLabsAgentId}`);
    console.log(`   Redis URL: ${config.upstashRedisUrl}`);
    console.log('');

    // Create and start the voice gateway service
    console.log('🚀 Initializing Voice Gateway Service...');
    const voiceGateway = new VoiceGatewayService(config);

    // Handle graceful shutdown
    const shutdown = async (signal: string) => {
      console.log(`\n📴 Received ${signal}. Gracefully shutting down Voice Gateway...`);
      
      try {
        await voiceGateway.stop();
        console.log('✅ Voice Gateway stopped successfully');
        process.exit(0);
      } catch (error) {
        console.error('❌ Error during shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGQUIT', () => shutdown('SIGQUIT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('❌ Uncaught Exception:', error);
      shutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
      shutdown('unhandledRejection');
    });

    // Start the service
    await voiceGateway.start();

    console.log('🎉 Voice Gateway Service started successfully!');
    console.log('📞 Ready to handle premium voice calls');
    console.log(`🌐 WebSocket endpoint: ws://localhost:${config.port}/voice-stream`);
    console.log(`🏥 Health check: http://localhost:${config.port}/health`);
    console.log('\n💰 Premium Voice Agent Features:');
    console.log('   • Real-time AI conversation with <500ms latency');
    console.log('   • Multilingual support (DE, EN, NL, FR)');
    console.log('   • Spam protection with Twilio Lookup');
    console.log('   • Business hours and appointment booking');
    console.log('   • Enterprise call analytics and monitoring');
    console.log('\n📊 Service Status: OPERATIONAL ✅');

    // Monitor service health
    setInterval(async () => {
      const activeConnections = voiceGateway.getActiveConnectionsCount();
      if (activeConnections > 0) {
        console.log(`📈 Active voice connections: ${activeConnections}`);
      }
    }, 30000); // Log every 30 seconds

  } catch (error) {
    console.error('❌ Failed to start Voice Gateway Service:', error);
    process.exit(1);
  }
}

// Start the service
if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}