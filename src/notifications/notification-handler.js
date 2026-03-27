/**
 * Notification Handler
 * Processes owner replies (CONNECT / SKIP) and auto-messages parties.
 */

const prisma = require('../utils/db');
const logger = require('../utils/logger');
const { sendBuyerIntro, sendSellerIntro, sendWhatsAppMessage } = require('../whatsapp/business-api-sender');
const config = require('../config');

/**
 * Handle incoming reply from owner on WhatsApp
 * Expected format: "CONNECT <matchId>" or "SKIP <matchId>"
 */
async function handleOwnerReply(text) {
  const connectMatch = text.match(/^CONNECT\s+([a-zA-Z0-9]+)/i);
  const skipMatch = text.match(/^SKIP\s+([a-zA-Z0-9]+)/i);

  if (connectMatch) {
    return await connectParties(connectMatch[1]);
  }

  if (skipMatch) {
    return await skipMatch_fn(skipMatch[1]);
  }

  return null;
}

/**
 * Auto-message both buyer and seller to connect them
 */
async function connectParties(matchId) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      listing: { include: { contact: true } },
      demand: { include: { contact: true } },
      buyer: true,
      seller: true,
    },
  });

  if (!match) {
    logger.warn({ matchId }, 'Match not found');
    return { error: 'Match not found' };
  }

  // Send intro to buyer
  const buyerResult = await sendBuyerIntro(match.buyer.phone, {
    propertyType: match.listing.propertyType,
    area: match.listing.area,
    size: match.listing.size,
    sizeUnit: match.listing.sizeUnit,
    price: match.listing.price,
    priceUnit: match.listing.priceUnit,
    bedrooms: match.listing.bedrooms,
  });

  // Send intro to seller
  const sellerResult = await sendSellerIntro(match.seller.phone, {
    propertyType: match.demand.propertyType,
    area: match.demand.area,
    minBudget: match.demand.minBudget,
    maxBudget: match.demand.maxBudget,
    budgetUnit: match.demand.budgetUnit,
    bedrooms: match.demand.bedrooms,
  });

  // Update match status
  await prisma.match.update({
    where: { id: matchId },
    data: {
      status: 'CONTACTED',
      notifiedBuyer: buyerResult.success,
      notifiedSeller: sellerResult.success,
    },
  });

  // Confirm to owner
  await sendWhatsAppMessage(
    config.owner.phone,
    `✅ Match ${matchId}: Both parties contacted!\n` +
    `Buyer: ${match.buyer.name || match.buyer.phone}\n` +
    `Seller: ${match.seller.name || match.seller.phone}`
  );

  logger.info({ matchId }, 'Parties connected successfully');
  return { success: true, matchId };
}

/**
 * Skip/reject a match
 */
async function skipMatch_fn(matchId) {
  await prisma.match.update({
    where: { id: matchId },
    data: { status: 'REJECTED' },
  });

  await sendWhatsAppMessage(
    config.owner.phone,
    `⏭️ Match ${matchId} skipped.`
  );

  return { success: true, skipped: true };
}

/**
 * Send daily summary to owner
 */
async function sendDailySummary() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [newListings, newDemands, newMatches, activeMatches] = await Promise.all([
    prisma.listing.count({ where: { createdAt: { gte: today } } }),
    prisma.demand.count({ where: { createdAt: { gte: today } } }),
    prisma.match.count({ where: { createdAt: { gte: today } } }),
    prisma.match.count({ where: { status: { in: ['NEW', 'NOTIFIED', 'CONTACTED', 'IN_PROGRESS'] } } }),
  ]);

  const totalListings = await prisma.listing.count({ where: { status: 'ACTIVE' } });
  const totalDemands = await prisma.demand.count({ where: { status: 'ACTIVE' } });
  const totalContacts = await prisma.contact.count();
  const closedDeals = await prisma.match.count({ where: { status: 'DEAL_CLOSED' } });

  const message =
    `📊 *DAILY SUMMARY - ${today.toLocaleDateString('en-IN')}*\n\n` +
    `*Today's Activity:*\n` +
    `📥 New Listings: ${newListings}\n` +
    `🔍 New Demands: ${newDemands}\n` +
    `🤝 New Matches: ${newMatches}\n\n` +
    `*Overall CRM:*\n` +
    `🏠 Active Listings: ${totalListings}\n` +
    `🔍 Active Demands: ${totalDemands}\n` +
    `👥 Total Contacts: ${totalContacts}\n` +
    `⏳ Active Matches: ${activeMatches}\n` +
    `✅ Deals Closed: ${closedDeals}\n\n` +
    `Reply STATS for detailed analytics.`;

  await sendWhatsAppMessage(config.owner.phone, message);
  logger.info('Daily summary sent');
}

module.exports = {
  handleOwnerReply,
  connectParties,
  sendDailySummary,
};
