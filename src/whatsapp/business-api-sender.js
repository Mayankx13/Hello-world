/**
 * WhatsApp Business API Sender
 * Uses Meta's Cloud API to send messages from your PRIMARY number.
 * This is the official, safe channel for automated outbound messages.
 */

const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');

const GRAPH_API_URL = 'https://graph.facebook.com/v21.0';

/**
 * Send a text message via WhatsApp Business API
 */
async function sendWhatsAppMessage(to, message) {
  // Normalize phone number: ensure it starts with country code, no +
  const phone = to.replace(/[^0-9]/g, '');

  if (!config.whatsapp.businessPhoneId || !config.whatsapp.businessToken) {
    logger.warn('WhatsApp Business API not configured. Message logged only.');
    logger.info({ to: phone, message }, 'SIMULATED WhatsApp message');
    return { success: false, simulated: true };
  }

  try {
    const response = await axios.post(
      `${GRAPH_API_URL}/${config.whatsapp.businessPhoneId}/messages`,
      {
        messaging_product: 'whatsapp',
        to: phone,
        type: 'text',
        text: { body: message },
      },
      {
        headers: {
          Authorization: `Bearer ${config.whatsapp.businessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    logger.info({ to: phone, messageId: response.data?.messages?.[0]?.id }, 'Message sent');
    return { success: true, messageId: response.data?.messages?.[0]?.id };
  } catch (error) {
    logger.error({
      to: phone,
      error: error.response?.data || error.message,
    }, 'Failed to send WhatsApp message');
    return { success: false, error: error.message };
  }
}

/**
 * Send owner notification about a new match
 */
async function notifyOwnerMatch(match) {
  const message = `🏠 *NEW DEAL MATCH (${match.score}%)*\n\n` +
    `*Seller:* ${match.sellerName || match.sellerPhone}\n` +
    `*Listing:* ${match.listingDescription}\n` +
    `*Price:* ₹${match.price} ${match.priceUnit}\n\n` +
    `*Buyer:* ${match.buyerName || match.buyerPhone}\n` +
    `*Budget:* ₹${match.minBudget}-${match.maxBudget} ${match.budgetUnit}\n` +
    `*Looking for:* ${match.demandDescription}\n\n` +
    `*Match ID:* ${match.matchId}\n` +
    `*Trust:* Seller(${match.sellerTrust}) | Buyer(${match.buyerTrust})\n\n` +
    `Reply with:\n` +
    `• *CONNECT ${match.matchId}* - Auto-message both parties\n` +
    `• *SKIP ${match.matchId}* - Ignore this match`;

  return sendWhatsAppMessage(config.owner.phone, message);
}

/**
 * Send automated intro message to buyer
 */
async function sendBuyerIntro(buyerPhone, listing) {
  const message = `Hi! 👋\n\n` +
    `I found a property that matches what you're looking for:\n\n` +
    `🏠 *${listing.propertyType}* in *${listing.area}*\n` +
    `📐 Size: ${listing.size} ${listing.sizeUnit || ''}\n` +
    `💰 Price: ₹${listing.price} ${listing.priceUnit}\n` +
    `${listing.bedrooms ? `🛏 ${listing.bedrooms} BHK` : ''}\n\n` +
    `Would you like more details or to schedule a visit?\n\n` +
    `— Deal Engine | Chandigarh Tricity Properties`;

  return sendWhatsAppMessage(buyerPhone, message);
}

/**
 * Send automated intro message to seller
 */
async function sendSellerIntro(sellerPhone, demand) {
  const message = `Hi! 👋\n\n` +
    `I have a verified buyer interested in properties like yours:\n\n` +
    `🔍 Looking for: *${demand.propertyType || 'Property'}* in *${demand.area || 'Tricity'}*\n` +
    `💰 Budget: ₹${demand.minBudget || '?'}-${demand.maxBudget || '?'} ${demand.budgetUnit}\n` +
    `${demand.bedrooms ? `🛏 ${demand.bedrooms} BHK` : ''}\n\n` +
    `Is your property still available? Can I connect you?\n\n` +
    `— Deal Engine | Chandigarh Tricity Properties`;

  return sendWhatsAppMessage(sellerPhone, message);
}

module.exports = {
  sendWhatsAppMessage,
  notifyOwnerMatch,
  sendBuyerIntro,
  sendSellerIntro,
};
