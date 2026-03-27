/**
 * Deal Matching Engine
 * Scores listing-demand pairs on multiple dimensions.
 * Notifies owner when score >= threshold (default 70%).
 */

const prisma = require('../utils/db');
const logger = require('../utils/logger');
const config = require('../config');
const { notifyOwnerMatch } = require('../whatsapp/business-api-sender');

// ==========================================
// SCORING WEIGHTS (total = 100)
// ==========================================
const WEIGHTS = {
  propertyType: 20,
  area: 25,
  price: 25,
  size: 10,
  bedrooms: 15,
  trustBonus: 5,
};

/**
 * Find matches for a newly created listing (seller posted)
 */
async function findMatchesForListing(listingId) {
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    include: { contact: true },
  });

  if (!listing) return [];

  // Find active demands that could match
  const demands = await prisma.demand.findMany({
    where: {
      status: 'ACTIVE',
      contactId: { not: listing.contactId }, // Don't match same person
    },
    include: { contact: true },
  });

  const matches = [];
  for (const demand of demands) {
    const score = calculateMatchScore(listing, demand);
    if (score.total >= config.matching.threshold) {
      const match = await createMatch(listing, demand, score);
      if (match) matches.push(match);
    }
  }

  logger.info({ listingId, matchCount: matches.length }, 'Matching complete for listing');
  return matches;
}

/**
 * Find matches for a newly created demand (buyer posted)
 */
async function findMatchesForDemand(demandId) {
  const demand = await prisma.demand.findUnique({
    where: { id: demandId },
    include: { contact: true },
  });

  if (!demand) return [];

  // Find active listings that could match
  const listings = await prisma.listing.findMany({
    where: {
      status: 'ACTIVE',
      contactId: { not: demand.contactId },
    },
    include: { contact: true },
  });

  const matches = [];
  for (const listing of listings) {
    const score = calculateMatchScore(listing, demand);
    if (score.total >= config.matching.threshold) {
      const match = await createMatch(listing, demand, score);
      if (match) matches.push(match);
    }
  }

  logger.info({ demandId, matchCount: matches.length }, 'Matching complete for demand');
  return matches;
}

/**
 * Core scoring algorithm
 */
function calculateMatchScore(listing, demand) {
  const breakdown = {
    propertyType: 0,
    area: 0,
    price: 0,
    size: 0,
    bedrooms: 0,
    trustBonus: 0,
  };

  // 1. Property Type Match (exact = full, related = partial)
  if (listing.propertyType && demand.propertyType) {
    if (listing.propertyType === demand.propertyType) {
      breakdown.propertyType = WEIGHTS.propertyType;
    } else if (areRelatedTypes(listing.propertyType, demand.propertyType)) {
      breakdown.propertyType = WEIGHTS.propertyType * 0.6;
    }
  } else {
    // If buyer didn't specify type, give partial score
    breakdown.propertyType = demand.propertyType ? 0 : WEIGHTS.propertyType * 0.5;
  }

  // 2. Area Match (fuzzy location matching)
  breakdown.area = scoreAreaMatch(listing.area, demand.area);

  // 3. Price Match (is listing within buyer's budget?)
  breakdown.price = scorePriceMatch(listing, demand);

  // 4. Size Match
  breakdown.size = scoreSizeMatch(listing, demand);

  // 5. Bedroom Match
  if (listing.bedrooms && demand.bedrooms) {
    if (listing.bedrooms === demand.bedrooms) {
      breakdown.bedrooms = WEIGHTS.bedrooms;
    } else if (Math.abs(listing.bedrooms - demand.bedrooms) === 1) {
      breakdown.bedrooms = WEIGHTS.bedrooms * 0.5;
    }
  } else {
    breakdown.bedrooms = WEIGHTS.bedrooms * 0.3; // Partial if not specified
  }

  // 6. Trust Bonus
  const sellerTrust = listing.contact?.trustScore || 50;
  const buyerTrust = demand.contact?.trustScore || 50;
  const avgTrust = (sellerTrust + buyerTrust) / 2;
  breakdown.trustBonus = (avgTrust / 100) * WEIGHTS.trustBonus;

  const total = Object.values(breakdown).reduce((sum, v) => sum + v, 0);

  return { total: Math.round(total), breakdown };
}

function areRelatedTypes(type1, type2) {
  const groups = [
    ['FLAT', 'APARTMENT', 'PENTHOUSE'],
    ['VILLA', 'KOTHI', 'HOUSE'],
    ['PLOT'],
    ['COMMERCIAL_SHOP', 'COMMERCIAL_SHOWROOM', 'BOOTH', 'SCO', 'SCF'],
    ['COMMERCIAL_OFFICE', 'WAREHOUSE'],
  ];
  return groups.some((g) => g.includes(type1) && g.includes(type2));
}

function scoreAreaMatch(listingArea, demandArea) {
  if (!listingArea || !demandArea) return WEIGHTS.area * 0.3;

  const la = listingArea.toLowerCase();
  const da = demandArea.toLowerCase();

  // Exact match
  if (la === da) return WEIGHTS.area;

  // Check if any area token matches
  const listingTokens = la.split(/[,\s]+/).filter(Boolean);
  const demandTokens = da.split(/[,\s]+/).filter(Boolean);

  let matchCount = 0;
  for (const lt of listingTokens) {
    for (const dt of demandTokens) {
      if (lt.includes(dt) || dt.includes(lt)) matchCount++;
    }
  }

  if (matchCount > 0) {
    const maxTokens = Math.max(listingTokens.length, demandTokens.length);
    return WEIGHTS.area * Math.min(matchCount / maxTokens, 1);
  }

  // Same city/region = small partial score
  const tricityAreas = ['chandigarh', 'mohali', 'zirakpur', 'kharar', 'panchkula'];
  const inTriCity = tricityAreas.some((a) => la.includes(a)) &&
                    tricityAreas.some((a) => da.includes(a));
  if (inTriCity) return WEIGHTS.area * 0.2;

  return 0;
}

function scorePriceMatch(listing, demand) {
  if (!listing.price) return WEIGHTS.price * 0.2;
  if (!demand.maxBudget && !demand.minBudget) return WEIGHTS.price * 0.3;

  // Normalize to same unit (lakhs)
  const listingPriceLakhs = normalizePriceToLakhs(listing.price, listing.priceUnit);
  const minBudgetLakhs = demand.minBudget ? normalizePriceToLakhs(demand.minBudget, demand.budgetUnit) : 0;
  const maxBudgetLakhs = demand.maxBudget ? normalizePriceToLakhs(demand.maxBudget, demand.budgetUnit) : Infinity;

  // Perfect: listing is within budget
  if (listingPriceLakhs >= minBudgetLakhs && listingPriceLakhs <= maxBudgetLakhs) {
    return WEIGHTS.price;
  }

  // Within 15% over budget: partial
  if (listingPriceLakhs <= maxBudgetLakhs * 1.15) {
    const overBy = (listingPriceLakhs - maxBudgetLakhs) / maxBudgetLakhs;
    return WEIGHTS.price * (1 - overBy * 3);
  }

  // Within 10% under min budget: partial (might indicate smaller unit)
  if (listingPriceLakhs >= minBudgetLakhs * 0.9) {
    return WEIGHTS.price * 0.7;
  }

  return 0;
}

function normalizePriceToLakhs(amount, unit) {
  if (!amount) return 0;
  switch (unit) {
    case 'CRORE': return amount * 100;
    case 'THOUSAND': return amount / 100;
    default: return amount; // LAKH
  }
}

function scoreSizeMatch(listing, demand) {
  if (!listing.size || !demand.minSize) return WEIGHTS.size * 0.3;

  // Simple: if same unit, compare directly
  if (listing.sizeUnit === demand.sizeUnit || !demand.sizeUnit) {
    const ratio = listing.size / demand.minSize;
    if (ratio >= 0.85 && ratio <= 1.3) return WEIGHTS.size;
    if (ratio >= 0.7 && ratio <= 1.5) return WEIGHTS.size * 0.5;
    return 0;
  }

  return WEIGHTS.size * 0.3; // Different units - partial
}

/**
 * Create match record and notify owner
 */
async function createMatch(listing, demand, score) {
  try {
    const match = await prisma.match.create({
      data: {
        listingId: listing.id,
        demandId: demand.id,
        buyerId: demand.contactId,
        sellerId: listing.contactId,
        score: score.total,
        scoreBreakdown: score.breakdown,
      },
    });

    logger.info({
      matchId: match.id,
      score: score.total,
      seller: listing.contact?.phone,
      buyer: demand.contact?.phone,
    }, 'New match created!');

    // Notify owner via WhatsApp
    await notifyOwnerMatch({
      matchId: match.id,
      score: score.total,
      sellerPhone: listing.contact?.phone,
      sellerName: listing.contact?.name,
      sellerTrust: listing.contact?.trustLevel,
      buyerPhone: demand.contact?.phone,
      buyerName: demand.contact?.name,
      buyerTrust: demand.contact?.trustLevel,
      listingDescription: `${listing.propertyType} in ${listing.area || 'Tricity'}`,
      price: listing.price,
      priceUnit: listing.priceUnit,
      minBudget: demand.minBudget,
      maxBudget: demand.maxBudget,
      budgetUnit: demand.budgetUnit,
      demandDescription: `${demand.propertyType || 'Property'} in ${demand.area || 'Tricity'}`,
    });

    return match;
  } catch (error) {
    // Unique constraint violation = match already exists
    if (error.code === 'P2002') {
      logger.debug('Match already exists, skipping');
      return null;
    }
    throw error;
  }
}

/**
 * Run daily full re-matching (cron job)
 */
async function runFullMatching() {
  logger.info('Starting daily full match run...');

  const activeListings = await prisma.listing.findMany({
    where: { status: 'ACTIVE' },
  });

  let totalMatches = 0;
  for (const listing of activeListings) {
    const matches = await findMatchesForListing(listing.id);
    totalMatches += matches.length;
  }

  logger.info({ totalMatches }, 'Daily matching complete');
  return totalMatches;
}

module.exports = {
  findMatchesForListing,
  findMatchesForDemand,
  calculateMatchScore,
  runFullMatching,
};
