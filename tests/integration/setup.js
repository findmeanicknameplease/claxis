// Jest setup for integration tests
// Global test configuration and utilities

// Increase timeout for integration tests
jest.setTimeout(30000);

// Global test utilities
global.delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

global.waitForCondition = async (condition, timeout = 5000, interval = 100) => {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await condition()) {
      return true;
    }
    await global.delay(interval);
  }
  throw new Error(`Condition not met within ${timeout}ms`);
};

// Suppress console.log in tests unless VERBOSE=true
if (!process.env.VERBOSE) {
  const originalConsole = console.log;
  console.log = (...args) => {
    if (args[0] && args[0].includes('✅')) {
      originalConsole(...args);
    }
  };
}