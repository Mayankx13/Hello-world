/**
 * Trust Scoring Engine
 * Tracks source reliability over time.
 *
 * Trust Levels:
 *   NEW     (0-30 score)  - First-time posters, unverified
 *   LOW     (31-45)       - Few posts, no deals closed
 *   MEDIUM  (46-65)       - Regular poster, some activity
 *   TRUSTED (66-100)      - Frequent poster, deals closed, verified
 *   FLAGGED (any)         - Manually flagged or spam detected
 *
 * Score changes:
 *   +2  per post (up to daily cap of 3)
 *   +15 per deal closed
 *   +20 verified by reputed broker
 *   -5  duplicate/spammy post
 *   -10 price inconsistency
 *   -30 manual flag
 */

const prisma = require('../utils/db');
const logger = require('../utils/logger');

const TRUST_THRESHOLDS = {
  NEW: 30,
  LOW: 45,
  MEDIUM: 65,
  TRUSTED: 100,
};

function getTrustLevel(score) {
  if (score <= TRUST_THRESHOLDS.NEW) return 'NEW';
  if (score <= TRUST_THRESHOLDS.LOW) return 'LOW';
  if (score <= TRUST_THRESHOLDS.MEDIUM) return 'MEDIUM';
  return 'TRUSTED';
}

/**
 * Update trust when a contact posts a message
 */
async function updateTrustOnPost(contactId, messageContent) {
  const contact = await prisma.contact.findUnique({ where: { id: contactId } });
  if (!contact) return;

  // Check if flagged - don't auto-increase
  if (contact.trustLevel === 'FLAGGED') {
    logger.debug({ contactId }, 'Flagged contact, trust unchanged');
    return;
  }

  // Check daily post cap (max 3 trust bumps per day)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayEvents = await prisma.trustEvent.count({
    where: {
      contactId,
      event: 'POST_FREQUENCY',
      createdAt: { gte: today },
    },
  });

  if (todayEvents >= 3) {
    logger.debug({ contactId }, 'Daily trust cap reached');
    return;
  }

  // Check for duplicate posts (same content within 24h)
  const recentMessages = await prisma.message.findMany({
    where: {
      contactId,
      createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  const isDuplicate = recentMessages.some(
    (m) => m.content !== messageContent && similarity(m.content, messageContent) > 0.8
  );

  if (isDuplicate) {
    await adjustTrust(contactId, 'DUPLICATE_POST', -5, 'Similar message posted within 24h');
    return;
  }

  // Normal post trust bump
  await adjustTrust(contactId, 'POST_FREQUENCY', 2, 'Regular posting');
}

/**
 * Update trust when a deal is closed
 */
async function updateTrustOnDealClosed(contactId) {
  await adjustTrust(contactId, 'DEAL_CLOSED', 15, 'Deal successfully closed');
  await prisma.contact.update({
    where: { id: contactId },
    data: { dealsClosed: { increment: 1 } },
  });
}

/**
 * Verify a contact through a reputed broker
 */
async function verifyByBroker(contactId, brokerId) {
  await adjustTrust(contactId, 'VERIFIED_BY_BROKER', 20, `Verified by broker ${brokerId}`);
  await prisma.contact.update({
    where: { id: contactId },
    data: { isVerified: true },
  });
}

/**
 * Manually flag a contact
 */
async function flagContact(contactId, reason) {
  await prisma.contact.update({
    where: { id: contactId },
    data: { trustLevel: 'FLAGGED' },
  });
  await prisma.trustEvent.create({
    data: {
      contactId,
      event: 'MANUAL_FLAG',
      delta: -30,
      reason: reason || 'Manually flagged',
    },
  });
  logger.warn({ contactId, reason }, 'Contact flagged');
}

/**
 * Manually trust a contact
 */
async function manuallyTrust(contactId, reason) {
  await adjustTrust(contactId, 'MANUAL_TRUST', 25, reason || 'Manually trusted');
}

/**
 * Core trust adjustment function
 */
async function adjustTrust(contactId, event, delta, reason) {
  const contact = await prisma.contact.findUnique({ where: { id: contactId } });
  if (!contact) return;

  const newScore = Math.max(0, Math.min(100, contact.trustScore + delta));
  const newLevel = contact.trustLevel === 'FLAGGED' ? 'FLAGGED' : getTrustLevel(newScore);

  await prisma.$transaction([
    prisma.contact.update({
      where: { id: contactId },
      data: { trustScore: newScore, trustLevel: newLevel },
    }),
    prisma.trustEvent.create({
      data: { contactId, event, delta, reason },
    }),
  ]);

  logger.info({
    contactId,
    event,
    delta,
    oldScore: contact.trustScore,
    newScore,
    newLevel,
  }, 'Trust updated');
}

/**
 * Simple text similarity (Jaccard on words)
 */
function similarity(text1, text2) {
  const words1 = new Set(text1.toLowerCase().split(/\s+/));
  const words2 = new Set(text2.toLowerCase().split(/\s+/));
  const intersection = new Set([...words1].filter((w) => words2.has(w)));
  const union = new Set([...words1, ...words2]);
  return union.size > 0 ? intersection.size / union.size : 0;
}

/**
 * Daily trust decay for inactive contacts
 */
async function runTrustDecay() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const inactiveContacts = await prisma.contact.findMany({
    where: {
      lastSeen: { lt: thirtyDaysAgo },
      trustScore: { gt: 30 },
      trustLevel: { not: 'FLAGGED' },
    },
  });

  for (const contact of inactiveContacts) {
    await adjustTrust(contact.id, 'POST_FREQUENCY', -2, 'Inactivity decay');
  }

  logger.info({ count: inactiveContacts.length }, 'Trust decay complete');
}

module.exports = {
  updateTrustOnPost,
  updateTrustOnDealClosed,
  verifyByBroker,
  flagContact,
  manuallyTrust,
  adjustTrust,
  runTrustDecay,
  getTrustLevel,
};
