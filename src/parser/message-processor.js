/**
 * Message Processing Pipeline
 * Takes raw WhatsApp messages → parses → stores → triggers matching
 */

const prisma = require('../utils/db');
const logger = require('../utils/logger');
const { parseRealEstateMessage } = require('./real-estate-nlp');
const { updateTrustOnPost } = require('../trust/trust-engine');
const { findMatchesForListing, findMatchesForDemand } = require('../matcher/match-engine');

async function processIncomingMessage(msg) {
  const { whatsappId, groupId, groupName, senderPhone, senderName, content } = msg;

  // 1. Parse the message
  const parsed = parseRealEstateMessage(content);

  if (!parsed.isRealEstate) {
    logger.debug({ senderPhone, confidence: parsed.confidence }, 'Non-real-estate message, skipping');
    return null;
  }

  logger.info({
    senderPhone,
    dealType: parsed.dealType,
    propertyType: parsed.propertyType,
    area: parsed.area,
    confidence: parsed.confidence,
  }, 'Real estate message detected');

  // 2. Upsert contact
  const contact = await prisma.contact.upsert({
    where: { phone: senderPhone },
    update: {
      name: senderName || undefined,
      lastSeen: new Date(),
      totalPosts: { increment: 1 },
      type: determineContactType(parsed.dealType, undefined),
    },
    create: {
      phone: senderPhone,
      name: senderName,
      type: parsed.dealType === 'SELL' ? 'SELLER' : parsed.dealType === 'BUY' ? 'BUYER' : 'BOTH',
    },
  });

  // 3. Store message
  const storedMsg = await prisma.message.upsert({
    where: { whatsappId: whatsappId || `manual-${Date.now()}` },
    update: {},
    create: {
      whatsappId,
      groupId,
      groupName,
      contactId: contact.id,
      senderPhone,
      senderName,
      content,
      parsed: true,
      parsedData: parsed,
      dealType: parsed.dealType,
    },
  });

  // 4. Update trust score
  await updateTrustOnPost(contact.id, content);

  // 5. Track the WhatsApp group
  if (groupId) {
    await prisma.whatsAppGroup.upsert({
      where: { groupId },
      update: { lastMessage: new Date(), name: groupName || undefined },
      create: { groupId, name: groupName || 'Unknown Group' },
    });
  }

  // 6. Create listing or demand based on deal type
  if (parsed.dealType === 'SELL' || parsed.dealType === 'BOTH') {
    const listing = await prisma.listing.create({
      data: {
        contactId: contact.id,
        messageId: storedMsg.id,
        propertyType: parsed.propertyType || 'OTHER',
        area: parsed.area,
        size: parsed.size.value,
        sizeUnit: parsed.size.unit,
        bedrooms: parsed.bedrooms,
        price: parsed.price.amount,
        priceUnit: parsed.price.unit || 'LAKH',
        facing: parsed.facing,
        amenities: parsed.amenities,
        description: content.substring(0, 500),
        rawMessage: content,
      },
    });

    logger.info({ listingId: listing.id }, 'Listing created');

    // Trigger matching
    await findMatchesForListing(listing.id);
  }

  if (parsed.dealType === 'BUY' || parsed.dealType === 'BOTH') {
    const demand = await prisma.demand.create({
      data: {
        contactId: contact.id,
        messageId: storedMsg.id,
        propertyType: parsed.propertyType,
        area: parsed.area,
        minSize: parsed.size.value,
        minBudget: parsed.price.min || parsed.price.amount,
        maxBudget: parsed.price.max || (parsed.price.amount ? parsed.price.amount * 1.15 : null),
        budgetUnit: parsed.price.unit || 'LAKH',
        bedrooms: parsed.bedrooms,
        preferences: parsed.amenities,
        description: content.substring(0, 500),
        rawMessage: content,
      },
    });

    logger.info({ demandId: demand.id }, 'Demand created');

    // Trigger matching
    await findMatchesForDemand(demand.id);
  }

  return { parsed, contact };
}

function determineContactType(dealType, existingType) {
  if (dealType === 'BOTH') return 'BOTH';
  if (!existingType || existingType === 'UNKNOWN') {
    return dealType === 'SELL' ? 'SELLER' : 'BUYER';
  }
  if (
    (existingType === 'SELLER' && dealType === 'BUY') ||
    (existingType === 'BUYER' && dealType === 'SELL')
  ) {
    return 'BOTH';
  }
  return existingType;
}

module.exports = { processIncomingMessage };
