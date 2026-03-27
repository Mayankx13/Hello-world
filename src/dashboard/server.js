/**
 * Dashboard & API Server
 * Simple Express server with API routes and static dashboard.
 */

const express = require('express');
const path = require('path');
const config = require('../config');
const logger = require('../utils/logger');
const crmRouter = require('../crm/crm-api');

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Simple auth middleware
app.use('/api', (req, res, next) => {
  const authHeader = req.headers.authorization;
  const password = config.dashboard.password;

  // Allow no-auth in dev
  if (!password || password === 'changeme123') return next();

  if (authHeader === `Bearer ${password}`) return next();
  res.status(401).json({ error: 'Unauthorized' });
});

// API routes
app.use('/api', crmRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// Static dashboard
app.use(express.static(path.join(__dirname, '../../public')));

// Catch-all: serve dashboard
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/index.html'));
});

function startDashboard() {
  const port = config.dashboard.port;
  app.listen(port, () => {
    logger.info({ port }, `Dashboard running at http://localhost:${port}`);
  });
  return app;
}

module.exports = { startDashboard, app };
