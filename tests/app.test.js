/**
 * Automated Test Suite for CloudSentinel Secure Demo Application
 * Uses Node.js native test runner and Supertest
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { createApp, startServer, APP_NAME, APP_VERSION } = require('../src/app');

describe('CloudSentinel Secure Demo Application Test Suite', () => {
  const app = createApp();

  // Test 1: Homepage returns HTTP 200
  it('1. Homepage returns HTTP 200', async () => {
    const res = await request(app).get('/');
    assert.strictEqual(res.status, 200);
    assert.ok(res.headers['content-type'].includes('text/html'));
  });

  // Test 2: Homepage displays "Deployed securely through CloudSentinel"
  it('2. Homepage displays "Deployed securely through CloudSentinel"', async () => {
    const res = await request(app).get('/');
    assert.strictEqual(res.status, 200);
    assert.ok(
      res.text.includes('Deployed securely through CloudSentinel'),
      'Expected exact phrase "Deployed securely through CloudSentinel" on homepage'
    );
  });

  // Test 3: /health returns HTTP 200
  it('3. /health returns HTTP 200', async () => {
    const res = await request(app).get('/health');
    assert.strictEqual(res.status, 200);
    assert.ok(res.headers['content-type'].includes('application/json'));
  });

  // Test 4: /health returns the correct application identity
  it('4. /health returns the correct application identity', async () => {
    const res = await request(app).get('/health');
    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(res.body, {
      status: 'healthy',
      application: APP_NAME,
      version: APP_VERSION,
    });
  });

  // Test 5: /ready returns HTTP 200
  it('5. /ready returns HTTP 200', async () => {
    const res = await request(app).get('/ready');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, 'ready');
    assert.strictEqual(res.body.application, APP_NAME);
    assert.ok(res.body.timestamp, 'Timestamp should be present in readiness response');
  });

  // Test 6: /api/info excludes sensitive fields
  it('6. /api/info excludes sensitive fields', async () => {
    const res = await request(app).get('/api/info');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.application, APP_NAME);
    assert.strictEqual(res.body.version, APP_VERSION);
    assert.ok(res.body.environment);
    assert.ok(res.body.purpose);

    // Verify sensitive properties are never exposed
    const prohibitedKeys = [
      'password',
      'token',
      'secret',
      'key',
      'apiKey',
      'env',
      'path',
      'serverPath',
      'credentials',
      'databaseUrl',
      'config',
    ];

    prohibitedKeys.forEach((key) => {
      assert.strictEqual(
        res.body[key],
        undefined,
        `Sensitive field "${key}" must not be exposed in /api/info`
      );
    });
  });

  // Test 7: Unknown routes return 404
  it('7. Unknown routes return 404', async () => {
    const res = await request(app).get('/non-existent-security-endpoint-probe');
    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.body.error, 'Not Found');
    assert.strictEqual(res.body.status, 404);
  });

  // Test 8: HTTP security headers are present
  it('8. HTTP security headers are present', async () => {
    const res = await request(app).get('/health');
    
    // X-Powered-By must be completely disabled/omitted
    assert.strictEqual(
      res.headers['x-powered-by'],
      undefined,
      'X-Powered-By header must be disabled'
    );

    // Helmet security headers
    assert.strictEqual(res.headers['x-content-type-options'], 'nosniff');
    assert.strictEqual(res.headers['x-frame-options'], 'SAMEORIGIN');
    assert.ok(res.headers['content-security-policy'], 'Content-Security-Policy should be set');
  });

  // Test 9: Application starts with a configured PORT
  it('9. Application starts with a configured PORT', async () => {
    const testPort = 3199;
    const { serverPromise, shutdown } = startServer(testPort);
    const server = await serverPromise;
    
    try {
      const address = server.address();
      assert.ok(address, 'Server address should be valid');
      assert.strictEqual(address.port, testPort, `Server should listen on port ${testPort}`);
    } finally {
      await shutdown('TEST_CLEANUP');
    }
  });

  // Test 10: Graceful shutdown behaves correctly
  it('10. Graceful shutdown behaves correctly', async () => {
    // Start server on an ephemeral port (0)
    const { serverPromise, shutdown } = startServer(0);
    const server = await serverPromise;
    assert.strictEqual(server.listening, true, 'Server should be listening prior to shutdown');

    // Perform graceful shutdown
    await shutdown('TEST_SHUTDOWN');

    assert.strictEqual(server.listening, false, 'Server should stop listening after graceful shutdown');
  });
});
