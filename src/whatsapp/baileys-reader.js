/**
 * WhatsApp Group Reader using Baileys
 * Connects via QR code scan and listens to group messages.
 * Uses a SECONDARY number to avoid ban risk on primary.
 */

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const logger = require('../utils/logger');
const { processIncomingMessage } = require('../parser/message-processor');

let sock = null;
let isConnected = false;
let latestQR = null;

function getLatestQR() { return latestQR; }

async function startBaileysReader() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

  sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    logger: require('pino')({ level: 'silent' }),
  });

  // Handle connection updates
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      latestQR = qr;
      logger.info('QR code ready! Open http://YOUR_SERVER:3000/qr to scan');
    }

    if (connection === 'close') {
      isConnected = false;
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;

      logger.warn({ shouldReconnect }, 'Connection closed');

      if (shouldReconnect) {
        logger.info('Reconnecting in 5 seconds...');
        setTimeout(startBaileysReader, 5000);
      } else {
        logger.error('Logged out. Delete auth_info_baileys/ folder and restart to re-scan QR.');
      }
    }

    if (connection === 'open') {
      isConnected = true;
      logger.info('WhatsApp Baileys reader connected successfully!');
    }
  });

  // Save credentials on update
  sock.ev.on('creds.update', saveCreds);

  // Listen to all incoming messages
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
      try {
        // Only process group messages
        const isGroup = msg.key.remoteJid?.endsWith('@g.us');
        if (!isGroup) continue;

        // Skip messages from self
        if (msg.key.fromMe) continue;

        const text =
          msg.message?.conversation ||
          msg.message?.extendedTextMessage?.text ||
          msg.message?.imageMessage?.caption ||
          '';

        if (!text || text.length < 10) continue;

        const senderPhone = msg.key.participant || msg.key.remoteJid;
        const groupId = msg.key.remoteJid;

        // Get group name
        let groupName = 'Unknown Group';
        try {
          const groupMeta = await sock.groupMetadata(groupId);
          groupName = groupMeta.subject;
        } catch (e) {
          // ignore - group name not critical
        }

        // Get sender name
        let senderName = msg.pushName || null;

        logger.info({
          group: groupName,
          sender: senderName || senderPhone,
          textLength: text.length,
        }, 'New group message received');

        // Process the message through our pipeline
        await processIncomingMessage({
          whatsappId: msg.key.id,
          groupId,
          groupName,
          senderPhone: senderPhone.replace(/@.*$/, '').replace(/[^0-9+]/g, ''),
          senderName,
          content: text,
          timestamp: msg.messageTimestamp,
        });

      } catch (error) {
        logger.error({ error: error.message }, 'Error processing message');
      }
    }
  });

  return sock;
}

function getSocket() {
  return sock;
}

function getConnectionStatus() {
  return isConnected;
}

/**
 * Get all groups the secondary number is part of
 */
async function getJoinedGroups() {
  if (!sock || !isConnected) return [];
  try {
    const groups = await sock.groupFetchAllParticipating();
    return Object.values(groups).map((g) => ({
      id: g.id,
      name: g.subject,
      memberCount: g.participants?.length || 0,
      description: g.desc || '',
    }));
  } catch (error) {
    logger.error({ error: error.message }, 'Error fetching groups');
    return [];
  }
}

module.exports = {
  startBaileysReader,
  getSocket,
  getConnectionStatus,
  getJoinedGroups,
  getLatestQR,
};
