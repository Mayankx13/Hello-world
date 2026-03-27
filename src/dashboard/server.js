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

// WhatsApp QR code page — scan from your phone browser
app.get('/qr', (req, res) => {
  const { getLatestQR, getConnectionStatus } = require('../whatsapp/baileys-reader');
  const qr = getLatestQR();
  const connected = getConnectionStatus();

  if (connected) {
    return res.send('<html><body style="background:#0f172a;color:#22c55e;display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif;font-size:32px">WhatsApp Connected!</body></html>');
  }

  if (!qr) {
    return res.send('<html><head><meta http-equiv="refresh" content="3"></head><body style="background:#0f172a;color:#eab308;display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif;font-size:24px">Waiting for QR code... (auto-refreshing)</body></html>');
  }

  res.send(`<html>
<head><meta http-equiv="refresh" content="30"><script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.4/build/qrcode.min.js"></script></head>
<body style="background:#0f172a;color:white;display:flex;flex-direction:column;justify-content:center;align-items:center;height:100vh;font-family:sans-serif">
<h2>Scan with WhatsApp → Linked Devices → Link a Device</h2>
<canvas id="qr" style="margin:20px"></canvas>
<p style="color:#94a3b8">Auto-refreshes every 30s. QR expires quickly — scan fast!</p>
<script>QRCode.toCanvas(document.getElementById('qr'),${JSON.stringify(qr)},{width:300,margin:2},function(e){if(e)document.body.innerHTML='<p style="color:red">'+e+'</p>'});</script>
</body></html>`);
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
