/**
 * Real Estate Deal Engine - Main Entry Point
 *
 * Starts all services:
 * 1. WhatsApp Baileys reader (group message listener)
 * 2. Dashboard + CRM API server
 * 3. Cron scheduler (daily matching, trust decay, summaries)
 */

require('dotenv').config();
const logger = require('./utils/logger');
const { startBaileysReader } = require('./whatsapp/baileys-reader');
const { startDashboard } = require('./dashboard/server');
const { startScheduler } = require('./jobs/scheduler');

async function main() {
  logger.info('==============================================');
  logger.info('  Real Estate Deal Engine - Chandigarh Tricity');
  logger.info('==============================================');
  logger.info('Starting all services...');

  // 1. Start Dashboard & API
  try {
    startDashboard();
    logger.info('Dashboard started');
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to start dashboard');
  }

  // 2. Start Cron Scheduler
  try {
    startScheduler();
    logger.info('Scheduler started');
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to start scheduler');
  }

  // 3. Start WhatsApp Reader
  try {
    logger.info('Starting WhatsApp reader...');
    logger.info('You will need to scan a QR code with your SECONDARY WhatsApp number.');
    await startBaileysReader();
    logger.info('WhatsApp reader started');
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to start WhatsApp reader');
    logger.info('System will continue without WhatsApp reader. You can use the API/dashboard.');
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Shutting down...');
  const prisma = require('./utils/db');
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
