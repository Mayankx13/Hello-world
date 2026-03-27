/**
 * Real Estate Deal Engine - Main Entry Point
 */

require('dotenv').config();
const logger = require('./utils/logger');
const prisma = require('./utils/db');
const { startBaileysReader } = require('./whatsapp/baileys-reader');
const { startDashboard } = require('./dashboard/server');
const { startScheduler } = require('./jobs/scheduler');

async function waitForDB(retries = 15) {
  for (let i = 1; i <= retries; i++) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      logger.info('Database connected!');
      return true;
    } catch (e) {
      logger.warn(`Waiting for database... attempt ${i}/${retries}`);
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  throw new Error('Could not connect to database after ' + retries + ' attempts');
}

async function main() {
  logger.info('==============================================');
  logger.info('  Real Estate Deal Engine - Chandigarh Tricity');
  logger.info('==============================================');

  // 0. Wait for database
  await waitForDB();

  // 1. Start Dashboard & API
  startDashboard();
  logger.info('Dashboard started');

  // 2. Start Cron Scheduler
  startScheduler();
  logger.info('Scheduler started');

  // 3. Start WhatsApp Reader
  try {
    logger.info('Starting WhatsApp reader...');
    logger.info('Scan the QR code with your WhatsApp to connect.');
    await startBaileysReader();
    logger.info('WhatsApp reader started');
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to start WhatsApp reader');
  }
}

process.on('SIGINT', async () => {
  logger.info('Shutting down...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled rejection');
});

main().catch((error) => {
  logger.error({ error: error.message }, 'Fatal error');
  process.exit(1);
});
