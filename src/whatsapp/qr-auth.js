/**
 * Standalone WhatsApp QR Authentication Script
 * Run this ONCE to link your WhatsApp, then restart the main app.
 */

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const http = require('http');

let latestQR = null;
let connected = false;

// Serve QR code on port 3001
const server = http.createServer((req, res) => {
  if (connected) {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<html><body style="background:#0f172a;color:#22c55e;display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif;font-size:48px">WhatsApp Connected! Close this and restart the app.</body></html>');
    return;
  }

  if (!latestQR) {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<html><head><meta http-equiv="refresh" content="2"></head><body style="background:#0f172a;color:#eab308;display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif;font-size:24px">Generating QR code... (auto-refreshing every 2s)</body></html>');
    return;
  }

  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(`<html>
<head><meta http-equiv="refresh" content="20"><script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.4/build/qrcode.min.js"></script></head>
<body style="background:#0f172a;color:white;display:flex;flex-direction:column;justify-content:center;align-items:center;height:100vh;font-family:sans-serif">
<h1>Scan with WhatsApp</h1>
<h3>Settings → Linked Devices → Link a Device</h3>
<canvas id="qr" style="margin:20px"></canvas>
<p style="color:#94a3b8">QR refreshes every 20s. Scan quickly!</p>
<script>QRCode.toCanvas(document.getElementById('qr'),${JSON.stringify(latestQR)},{width:400,margin:2},function(e){if(e)document.body.innerHTML='<p style=color:red>Error: '+e+'</p>'});</script>
</body></html>`);
});

server.listen(3001, () => {
  console.log('QR Server running at http://0.0.0.0:3001');
  console.log('Open http://YOUR_SERVER_IP:3001 in your browser to scan');
});

async function authenticate() {
  const { state, saveCreds } = await useMultiFileAuthState('/app/auth_info_baileys');

  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'silent' }),
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      latestQR = qr;
      console.log('QR code generated! Open http://YOUR_SERVER_IP:3001 to scan');
    }

    if (connection === 'open') {
      connected = true;
      console.log('\n✅ WhatsApp CONNECTED successfully!');
      console.log('You can now close this and restart the main app.');
      console.log('Run: docker compose restart app\n');
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      if (statusCode === DisconnectReason.loggedOut) {
        console.log('Logged out. Clearing auth and retrying...');
      }
      if (!connected) {
        console.log('Reconnecting for QR...');
        setTimeout(authenticate, 3000);
      }
    }
  });
}

authenticate();
