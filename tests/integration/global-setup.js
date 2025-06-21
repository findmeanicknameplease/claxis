// Global setup for integration tests
// Ensures all services are ready before running tests

const { Client } = require('pg');
const axios = require('axios');

module.exports = async () => {
  console.log('🚀 Setting up integration test environment...');

  // Wait for database to be ready
  await waitForService('postgres', async () => {
    const client = new Client({
      connectionString: process.env.TEST_DATABASE_URL
    });
    
    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.end();
      return true;
    } catch (error) {
      return false;
    }
  });

  // Wait for services to be ready
  await waitForService('notifier', () => 
    checkHttpService('http://localhost:3001/health')
  );

  await waitForService('n8n-bridge', () => 
    checkHttpService('http://localhost:3002/health')
  );

  await waitForService('frontend', () => 
    checkHttpService('http://localhost:3000/api/health')
  );

  console.log('✅ All services ready for integration testing');
};

async function waitForService(name, checkFn, timeout = 30000) {
  console.log(`⏳ Waiting for ${name} service...`);
  
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      if (await checkFn()) {
        console.log(`✅ ${name} service ready`);
        return;
      }
    } catch (error) {
      // Service not ready yet
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  throw new Error(`${name} service not ready within ${timeout}ms`);
}

async function checkHttpService(url) {
  try {
    const response = await axios.get(url, { timeout: 2000 });
    return response.status === 200;
  } catch (error) {
    return false;
  }
}