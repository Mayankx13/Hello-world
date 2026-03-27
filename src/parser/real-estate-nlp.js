/**
 * Real Estate Message Parser
 * Extracts structured property data from WhatsApp messages.
 * Handles Hindi-English mixed text common in Chandigarh Tricity groups.
 */

// ==========================================
// PROPERTY TYPE PATTERNS
// ==========================================
const PROPERTY_PATTERNS = {
  FLAT: /\b(flat|apartment|apt)\b/i,
  VILLA: /\b(villa|bungalow)\b/i,
  KOTHI: /\b(kothi|independent\s*house)\b/i,
  HOUSE: /\b(house|home|makan)\b/i,
  PLOT: /\b(plot|land|zameen|zamin)\b/i,
  FLOOR: /\b(floor|manzil)\b/i,
  PENTHOUSE: /\b(penthouse|pent\s*house)\b/i,
  SCO: /\b(sco)\b/i,
  SCF: /\b(scf)\b/i,
  BOOTH: /\b(booth)\b/i,
  COMMERCIAL_SHOP: /\b(shop|dukan|showroom)\b/i,
  COMMERCIAL_OFFICE: /\b(office|commercial\s*space)\b/i,
  WAREHOUSE: /\b(warehouse|godown)\b/i,
};

// ==========================================
// AREA / LOCATION PATTERNS (Chandigarh Tricity)
// ==========================================
const AREA_PATTERNS = [
  // Chandigarh sectors
  /sector[\s-]*(\d{1,2}[a-d]?)/i,
  /sec[\s-]*(\d{1,2}[a-d]?)/i,
  // Mohali
  /mohali/i, /phase[\s-]*(\d{1,2})/i, /sas\s*nagar/i,
  // Zirakpur
  /zirakpur/i, /vip\s*road/i, /patiala\s*road/i, /ambala\s*highway/i,
  /dhakoli/i, /baltana/i, /gazipur/i, /lohgarh/i, /peer\s*muchalla/i,
  // Kharar
  /kharar/i, /sunny\s*enclave/i, /gillco/i,
  // New Chandigarh
  /new\s*chandigarh/i, /mullanpur/i, /omaxe/i, /eco\s*city/i,
  // Panchkula
  /panchkula/i, /pkl/i,
  // Major projects/areas
  /aerocity/i, /it\s*city/i, /gmada/i, /mansa\s*devi/i,
  /tribune\s*chowk/i, /airport\s*road/i, /pr[\s-]*7/i,
  /elante/i, /chandigarh\s*university/i,
  /dera\s*bassi/i, /rajpura/i, /derabassi/i,
  /mohali\s*hills/i, /mohali\s*sector/i,
];

// ==========================================
// PRICE PATTERNS
// ==========================================
const PRICE_PATTERNS = [
  // "45 lakh", "45L", "₹45 lac"
  /(?:rs\.?|₹|inr)?\s*(\d+\.?\d*)\s*(lakh|lac|lacs|lakhs|l)\b/i,
  // "1.5 crore", "2 cr", "₹1.5cr"
  /(?:rs\.?|₹|inr)?\s*(\d+\.?\d*)\s*(crore|cr|crs)\b/i,
  // "45,00,000" or "4500000"
  /(?:rs\.?|₹|inr)\s*(\d{1,3}(?:,?\d{2})*(?:,?\d{3}))/i,
  // Budget range: "40-50 lakh"
  /(\d+\.?\d*)\s*-\s*(\d+\.?\d*)\s*(lakh|lac|lacs|lakhs|l|crore|cr)\b/i,
];

// ==========================================
// SIZE PATTERNS
// ==========================================
const SIZE_PATTERNS = [
  // "200 sq yard", "200 gaj", "200 sqyd"
  /(\d+\.?\d*)\s*(sq\.?\s*y(?:ar)?d?s?|gaj|sqyd)/i,
  // "1200 sq ft", "1200 sqft", "1200 sft"
  /(\d+\.?\d*)\s*(sq\.?\s*f(?:ee)?t?|sqft|sft)/i,
  // "10 marla"
  /(\d+\.?\d*)\s*(marla|marle)/i,
  // "1 kanal"
  /(\d+\.?\d*)\s*(kanal|kanals)/i,
  // "1 acre"
  /(\d+\.?\d*)\s*(acre|acres|bigha)/i,
];

// ==========================================
// BHK PATTERNS
// ==========================================
const BHK_PATTERN = /(\d)\s*bhk/i;
const BEDROOM_PATTERN = /(\d)\s*(bed(?:room)?s?|br)/i;

// ==========================================
// DEAL TYPE DETECTION
// ==========================================
const SELL_PATTERNS = [
  /\b(for\s*sale|selling|sell|available|avail|on\s*sale|bikau|bechna|bech)\b/i,
  /\b(distress|urgent\s*sale|immediate|possession|ready\s*to\s*move|registry)\b/i,
  /\b(newly\s*constructed|just\s*built|brand\s*new|new\s*construction)\b/i,
];

const BUY_PATTERNS = [
  /\b(want\s*to\s*buy|looking\s*for|need|require|chahiye|lena\s*hai|buyer)\b/i,
  /\b(interested|budget|requirement|demand)\b/i,
  /\b(genuine\s*buyer|serious\s*buyer|end\s*user|investor)\b/i,
];

// ==========================================
// MAIN PARSER
// ==========================================

function parseRealEstateMessage(text) {
  const result = {
    dealType: detectDealType(text),
    propertyType: detectPropertyType(text),
    area: detectArea(text),
    price: detectPrice(text),
    size: detectSize(text),
    bedrooms: detectBedrooms(text),
    facing: detectFacing(text),
    floor: detectFloor(text),
    amenities: detectAmenities(text),
    isRealEstate: false,
    confidence: 0,
  };

  // Calculate confidence score
  let score = 0;
  if (result.dealType) score += 25;
  if (result.propertyType) score += 20;
  if (result.area) score += 15;
  if (result.price.amount) score += 20;
  if (result.size.value) score += 10;
  if (result.bedrooms) score += 10;

  result.confidence = score;
  result.isRealEstate = score >= 30; // At least deal type + one more field

  return result;
}

function detectDealType(text) {
  const sellScore = SELL_PATTERNS.reduce((s, p) => s + (p.test(text) ? 1 : 0), 0);
  const buyScore = BUY_PATTERNS.reduce((s, p) => s + (p.test(text) ? 1 : 0), 0);

  if (sellScore > 0 && buyScore > 0) return 'BOTH';
  if (sellScore > 0) return 'SELL';
  if (buyScore > 0) return 'BUY';
  return null;
}

function detectPropertyType(text) {
  for (const [type, pattern] of Object.entries(PROPERTY_PATTERNS)) {
    if (pattern.test(text)) return type;
  }
  return null;
}

function detectArea(text) {
  const areas = [];
  for (const pattern of AREA_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      areas.push(match[0].trim());
    }
  }

  // Clean up sector mentions
  const sectorMatch = text.match(/sector[\s-]*(\d{1,2}[a-d]?)/i) ||
                      text.match(/sec[\s-]*(\d{1,2}[a-d]?)/i);
  if (sectorMatch) {
    areas.unshift(`Sector ${sectorMatch[1]}`);
  }

  return areas.length > 0 ? areas.join(', ') : null;
}

function detectPrice(text) {
  const result = { amount: null, unit: 'LAKH', min: null, max: null };

  // Range pattern: "40-50 lakh"
  const rangeMatch = text.match(/(\d+\.?\d*)\s*-\s*(\d+\.?\d*)\s*(lakh|lac|lacs|lakhs|l|crore|cr)\b/i);
  if (rangeMatch) {
    result.min = parseFloat(rangeMatch[1]);
    result.max = parseFloat(rangeMatch[2]);
    result.unit = rangeMatch[3].toLowerCase().startsWith('cr') ? 'CRORE' : 'LAKH';
    result.amount = (result.min + result.max) / 2;
    return result;
  }

  // Crore
  const croreMatch = text.match(/(?:rs\.?|₹|inr)?\s*(\d+\.?\d*)\s*(crore|cr|crs)\b/i);
  if (croreMatch) {
    result.amount = parseFloat(croreMatch[1]);
    result.unit = 'CRORE';
    return result;
  }

  // Lakh
  const lakhMatch = text.match(/(?:rs\.?|₹|inr)?\s*(\d+\.?\d*)\s*(lakh|lac|lacs|lakhs|l)\b/i);
  if (lakhMatch) {
    result.amount = parseFloat(lakhMatch[1]);
    result.unit = 'LAKH';
    return result;
  }

  return result;
}

function detectSize(text) {
  const result = { value: null, unit: null };

  for (const pattern of SIZE_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      result.value = parseFloat(match[1]);
      const rawUnit = match[2].toLowerCase();

      if (/sq.*y|gaj|sqyd/.test(rawUnit)) result.unit = 'SQYD';
      else if (/sq.*f|sqft|sft/.test(rawUnit)) result.unit = 'SQFT';
      else if (/marla/.test(rawUnit)) result.unit = 'MARLA';
      else if (/kanal/.test(rawUnit)) result.unit = 'KANAL';
      else if (/acre|bigha/.test(rawUnit)) result.unit = 'ACRE';

      return result;
    }
  }

  return result;
}

function detectBedrooms(text) {
  const bhkMatch = text.match(BHK_PATTERN);
  if (bhkMatch) return parseInt(bhkMatch[1], 10);

  const bedMatch = text.match(BEDROOM_PATTERN);
  if (bedMatch) return parseInt(bedMatch[1], 10);

  return null;
}

function detectFacing(text) {
  const facingMatch = text.match(/\b(north|south|east|west|park)\s*facing\b/i) ||
                      text.match(/\bfacing\s*(north|south|east|west|park)\b/i);
  return facingMatch ? facingMatch[1].toLowerCase() : null;
}

function detectFloor(text) {
  const floorMatch = text.match(/(\d+)(?:st|nd|rd|th)\s*floor/i);
  if (floorMatch) return parseInt(floorMatch[1], 10);

  const groundMatch = text.match(/\b(ground|gf)\s*floor\b/i);
  if (groundMatch) return 0;

  return null;
}

function detectAmenities(text) {
  const amenities = [];
  const patterns = {
    'parking': /\b(parking|car\s*space)\b/i,
    'lift': /\b(lift|elevator)\b/i,
    'garden': /\b(garden|lawn|park)\b/i,
    'modular kitchen': /\b(modular\s*kitchen)\b/i,
    'gated community': /\b(gated\s*community|gated\s*society)\b/i,
    'swimming pool': /\b(pool|swimming)\b/i,
    'gym': /\b(gym|fitness)\b/i,
    'power backup': /\b(power\s*backup|generator|dg)\b/i,
    'furnished': /\b(furnished|furnish)\b/i,
    'semi-furnished': /\b(semi[\s-]*furnished)\b/i,
  };

  for (const [amenity, pattern] of Object.entries(patterns)) {
    if (pattern.test(text)) amenities.push(amenity);
  }

  return amenities;
}

module.exports = { parseRealEstateMessage };
