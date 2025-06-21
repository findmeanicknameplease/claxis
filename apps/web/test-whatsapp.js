// =============================================================================
// WHATSAPP CLIENT TEST SCRIPT
// =============================================================================

import { getWhatsAppClient } from './lib/whatsapp/client.js';

async function testWhatsAppClient() {
  console.log('🧪 Testing WhatsApp Business API Client...\n');

  try {
    // Initialize client
    const client = getWhatsAppClient();
    console.log('✅ WhatsApp client initialized successfully');

    // Test 1: Get phone number info
    console.log('\n📞 Testing phone number info...');
    try {
      const phoneInfo = await client.getPhoneNumberInfo();
      console.log('✅ Phone number info retrieved:', {
        id: phoneInfo.id,
        display_phone_number: phoneInfo.display_phone_number,
        verified_name: phoneInfo.verified_name
      });
    } catch (error) {
      console.log('❌ Phone number info failed:', error.message);
    }

    // Test 2: Get message templates
    console.log('\n📋 Testing message templates...');
    try {
      const templates = await client.getMessageTemplates();
      console.log('✅ Templates retrieved:', {
        count: templates.data?.length || 0,
        templates: templates.data?.slice(0, 3).map(t => t.name) || []
      });
    } catch (error) {
      console.log('❌ Templates failed:', error.message);
    }

    // Test 3: Check service window (mock conversation)
    console.log('\n⏰ Testing service window check...');
    try {
      const serviceWindow = await client.checkServiceWindow('+491234567890');
      console.log('✅ Service window check:', serviceWindow);
    } catch (error) {
      console.log('❌ Service window check failed:', error.message);
    }

    console.log('\n🎉 WhatsApp client testing completed!');
    console.log('\n📝 Next steps:');
    console.log('1. Configure webhook URL in Meta Developer Console');
    console.log('2. Test webhook with ngrok or deployed URL');
    console.log('3. Send test messages to verify end-to-end flow');

  } catch (error) {
    console.error('❌ WhatsApp client test failed:', error);
    console.log('\n🔍 Troubleshooting:');
    console.log('1. Check that WHATSAPP_ACCESS_TOKEN is valid');
    console.log('2. Verify WHATSAPP_PHONE_NUMBER_ID is correct');
    console.log('3. Ensure app has required permissions in Meta Console');
  }
}

// Only run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testWhatsAppClient();
}

export { testWhatsAppClient };