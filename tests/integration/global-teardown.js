// Global teardown for integration tests
// Cleanup after all tests complete

module.exports = async () => {
  console.log('🧹 Cleaning up integration test environment...');
  
  // Allow services to finish processing
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  console.log('✅ Integration test cleanup complete');
};