/**
 * Cron Job Scheduler
 * Runs daily tasks: matching, trust decay, summary, expiry cleanup.
 */

const cron = require('node-cron');
const logger = require('../utils/logger');
const { runFullMatching } = require('../matcher/match-engine');
const { runTrustDecay } = require('../trust/trust-engine');
const { sendDailySummary } = require('../notifications/notification-handler');
const prisma = require('../utils/db');

function startScheduler() {
  logger.info('Starting cron scheduler...');

  // Daily matching run - 8 AM IST (2:30 AM UTC)
  cron.schedule('30 2 * * *', async () => {
    logger.info('Running daily matching...');
    try {
      const matches = await runFullMatching();
      logger.info({ matches }, 'Daily matching complete');
    } catch (error) {
      logger.error({ error: error.message }, 'Daily matching failed');
    }
  });

  // Evening matching run - 6 PM IST (12:30 PM UTC)
  cron.schedule('30 12 * * *', async () => {
    logger.info('Running evening matching...');
    try {
      const matches = await runFullMatching();
      logger.info({ matches }, 'Evening matching complete');
    } catch (error) {
      logger.error({ error: error.message }, 'Evening matching failed');
    }
  });

  // Daily summary - 9 PM IST (3:30 PM UTC)
  cron.schedule('30 15 * * *', async () => {
    logger.info('Sending daily summary...');
    try {
      await sendDailySummary();
    } catch (error) {
      logger.error({ error: error.message }, 'Daily summary failed');
    }
  });

  // Trust decay - midnight IST (6:30 PM UTC previous day)
  cron.schedule('30 18 * * *', async () => {
    logger.info('Running trust decay...');
    try {
      await runTrustDecay();
    } catch (error) {
      logger.error({ error: error.message }, 'Trust decay failed');
    }
  });

  // Expire old listings (>30 days) - daily at 1 AM IST
  cron.schedule('30 19 * * *', async () => {
    logger.info('Expiring old listings...');
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const result = await prisma.listing.updateMany({
        where: {
          status: 'ACTIVE',
          createdAt: { lt: thirtyDaysAgo },
        },
        data: { status: 'EXPIRED' },
      });
      logger.info({ expired: result.count }, 'Listings expired');

      // Also expire old demands
      const demandResult = await prisma.demand.updateMany({
        where: {
          status: 'ACTIVE',
          createdAt: { lt: thirtyDaysAgo },
        },
        data: { status: 'EXPIRED' },
      });
      logger.info({ expired: demandResult.count }, 'Demands expired');
    } catch (error) {
      logger.error({ error: error.message }, 'Expiry cleanup failed');
    }
  });

  logger.info('Cron scheduler started with 5 daily jobs');
}

module.exports = { startScheduler };
