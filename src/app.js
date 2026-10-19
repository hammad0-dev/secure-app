/**
 * CloudSentinel — Secure Demo Application (App A)
 * 
 * Standalone reference application designed for CloudSentinel DevSecOps
 * pipeline validation and hardened Kubernetes deployment demonstrations.
 */

'use strict';

const path = require('path');
const express = require('express');
const helmet = require('helmet');

const APP_NAME = 'cloudsentinel-secure-demo';
const APP_VERSION = '1.0.0';
const DEMO_PURPOSE = 'CloudSentinel security-gated CI/CD pipeline and Kubernetes deployment demonstration';

function createApp() {
  const app = express();

  // 1. Security Headers & Hardening
  // Explicitly disable X-Powered-By header (Helmet also handles this)
  app.disable('x-powered-by');

  // Configure Helmet with modern Content Security Policy and security headers
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          imgSrc: ["'self'", 'data:'],
          scriptSrc: ["'self'"],
          objectSrc: ["'none'"],
          upgradeInsecureRequests: [],
        },
      },
      crossOriginEmbedderPolicy: false, // Compatibility for demo resources
    })
  );

  // 2. Strict Request Body Limits
  app.use(express.json({ limit: '10kb' }));
  app.use(express.urlencoded({ extended: false, limit: '10kb' }));

  // 3. Static Assets (Public Directory)
  const publicDir = path.resolve(__dirname, '..', 'public');
  app.use(express.static(publicDir, {
    index: false,
    dotfiles: 'ignore',
    maxAge: '1h',
  }));

  // 4. Routes

  /**
   * Root Homepage Endpoint
   * Route: GET /
   */
  app.get('/', (req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
  });

  /**
   * Health Check Endpoint
   * Route: GET /health
   * Deterministic, unauthenticated liveness check for Kubernetes and load balancers.
   */
  app.get('/health', (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.status(200).json({
      status: 'healthy',
      application: APP_NAME,
      version: APP_VERSION,
    });
  });

  /**
   * Readiness Check Endpoint
   * Route: GET /ready
   * Deterministic readiness check verifying application can serve incoming traffic.
   */
  app.get('/ready', (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.status(200).json({
      status: 'ready',
      application: APP_NAME,
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * API Metadata / Safe Info Endpoint
   * Route: GET /api/info
   * Exposes safe non-sensitive application identity metadata.
   */
  app.get('/api/info', (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.status(200).json({
      application: APP_NAME,
      version: APP_VERSION,
      environment: process.env.NODE_ENV || 'production',
      purpose: DEMO_PURPOSE,
    });
  });

  // 5. 404 Not Found Handler
  app.use((req, res) => {
    res.status(404).json({
      error: 'Not Found',
      status: 404,
      message: 'The requested resource does not exist.',
    });
  });

  // 6. Centralized Error Handler (No sensitive leakages)
  app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
    res.status(500).json({
      error: 'Internal Server Error',
      status: 500,
    });
  });

  return app;
}

/**
 * Server startup and Graceful Shutdown configuration
 */
function startServer(port = process.env.PORT || 3000, host = '0.0.0.0') {
  const app = createApp();
  let server;

  const serverPromise = new Promise((resolve, reject) => {
    server = app.listen(port, host, () => {
      console.log(`[CloudSentinel] ${APP_NAME} v${APP_VERSION} listening on ${host}:${port}`);
      resolve(server);
    });
    server.on('error', reject);
  });

  const shutdown = (signal = 'SIGTERM') => {
    return new Promise((resolve) => {
      console.log(`[CloudSentinel] Received ${signal}. Initiating graceful shutdown...`);
      if (!server || !server.listening) {
        return resolve();
      }

      server.close((err) => {
        if (err) {
          console.error('[CloudSentinel] Error during server close:', err.message);
        } else {
          console.log('[CloudSentinel] HTTP server closed cleanly.');
        }
        resolve();
      });

      const timer = setTimeout(() => {
        console.error('[CloudSentinel] Forced shutdown due to timeout.');
        resolve();
      }, 5000);
      timer.unref();
    });
  };

  process.on('SIGTERM', () => {
    shutdown('SIGTERM').then(() => process.exit(0));
  });
  process.on('SIGINT', () => {
    shutdown('SIGINT').then(() => process.exit(0));
  });

  return { app, server, serverPromise, shutdown };
}

// Start server if executed directly
if (require.main === module) {
  startServer();
}

module.exports = {
  createApp,
  startServer,
  APP_NAME,
  APP_VERSION,
  DEMO_PURPOSE,
};
