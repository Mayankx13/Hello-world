/**
 * Standalone WhatsApp QR Auth - Fixed version
 * Generates QR in terminal + serves on port 3001
 */

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const http = require('http');
const fs = require('fs');
const path = require('path');
const qrcode = require('qrcode-terminal');

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

/**
 * Convert QR string to a simple text-block using Unicode block chars.
 * Works in any terminal that supports UTF-8.
 */
function qrToText(qrString) {
  // Use qrcode-terminal to print directly
  qrcode.generate(qrString, { small: true }, (text) => {
    console.log('\n' + text + '\n');
  });
}

// Serve QR code on port 3001 — self-contained, no CDN needed
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

  // Serve QR as a PNG image using inline SVG generation (no external deps)
  const escaped = latestQR.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(`<html>
<head>
<meta http-equiv="refresh" content="20">
<title>WhatsApp QR - Scan Now</title>
<script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.4/build/qrcode.min.js"><\/script>
</head>
<body style="background:#0f172a;color:white;display:flex;flex-direction:column;justify-content:center;align-items:center;height:100vh;font-family:sans-serif">
<h1>Scan with WhatsApp</h1>
<h3>Settings &gt; Linked Devices &gt; Link a Device</h3>
<canvas id="qr" style="margin:20px"></canvas>
<div id="fallback" style="display:none;background:white;padding:20px;margin:20px">
  <img id="qr-img" />
</div>
<p style="color:#94a3b8">Refreshes every 20s. Scan quickly!</p>
<script>
var qrData = ${JSON.stringify(latestQR)};
if (typeof QRCode !== 'undefined') {
  QRCode.toCanvas(document.getElementById('qr'), qrData, {width:400,margin:2}, function(e){
    if(e) { showFallback(); }
  });
} else {
  showFallback();
}
function showFallback() {
  document.getElementById('fallback').style.display='block';
  // Use Google Charts API as fallback QR generator
  var img = document.getElementById('qr-img');
  img.src = 'https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=' + encodeURIComponent(qrData);
  img.width = 400;
  img.height = 400;
}
<\/script>
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
      console.log('========== QR CODE — SCAN THIS ==========');
      // Print QR as text blocks in terminal
      qrToText(update.qr);
      console.log('==========================================');
      console.log('Or open: http://157.245.101.144:3001');
      console.log('==========================================');
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
