/**
 * Standalone WhatsApp QR Auth - Fixed version
 */

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Clear any stale auth files (don't delete the dir itself - it's a Docker volume mount)
const AUTH_DIR = '/app/auth_info_baileys';
fs.mkdirSync(AUTH_DIR, { recursive: true });
try {
  const files = fs.readdirSync(AUTH_DIR);
  for (const file of files) {
    fs.unlinkSync(path.join(AUTH_DIR, file));
  }
  console.log(`Cleared ${files.length} auth files for fresh QR`);
} catch (e) {
  console.log('Auth dir clean, starting fresh');
}

let latestQR = null;
let connected = false;

// Serve QR code on port 3001
const server = http.createServer((req, res) => {
  if (connected) {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<html><body style="background:#0f172a;color:#22c55e;display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif;font-size:48px">WhatsApp Connected! Now run: docker compose up -d</body></html>');
    return;
  }
  if (!latestQR) {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<html><head><meta http-equiv="refresh" content="2"></head><body style="background:#0f172a;color:#eab308;display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif;font-size:24px">Generating QR code... (auto-refreshing every 2s)</body></html>');
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(`<html>
<head><meta http-equiv="refresh" content="15"><script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.4/build/qrcode.min.js"><\/script></head>
<body style="background:#0f172a;color:white;display:flex;flex-direction:column;justify-content:center;align-items:center;height:100vh;font-family:sans-serif">
<h1>Scan with WhatsApp</h1>
<h3>Settings - Linked Devices - Link a Device</h3>
<canvas id="qr" style="margin:20px"></canvas>
<p style="color:#94a3b8">Refreshes every 15s. Scan quickly!</p>
<script>QRCode.toCanvas(document.getElementById('qr'),${JSON.stringify(latestQR)},{width:400,margin:2},function(e){});<\/script>
</body></html>`);
});

server.listen(3001, '0.0.0.0', () => {
  console.log('');
  console.log('===========================================');
  console.log('  QR Server: http://157.245.101.144:3001');
  console.log('===========================================');
  console.log('');
});

async function start() {
  const { version } = await fetchLatestBaileysVersion();
  console.log('Using Baileys version:', version);

  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

  const sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: 'silent' }),
    browser: ['Deal Engine', 'Chrome', '120.0'],
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    console.log('Connection update:', JSON.stringify(update));

    if (update.qr) {
      latestQR = update.qr;
      console.log('');
      console.log('*** QR CODE READY! Open http://157.245.101.144:3001 ***');
      console.log('');
    }

    if (update.connection === 'open') {
      connected = true;
      console.log('');
      console.log('=== CONNECTED SUCCESSFULLY! ===');
      console.log('Press Ctrl+C, then run: docker compose up -d');
      console.log('');
    }

    if (update.connection === 'close') {
      const reason = update.lastDisconnect?.error?.output?.statusCode;
      console.log('Connection closed, reason:', reason);

      if (reason !== DisconnectReason.loggedOut && !connected) {
        console.log('Will retry in 5 seconds...');
        setTimeout(start, 5000);
      }
    }
  });
}

start().catch(console.error);
