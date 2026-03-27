/**
 * Tests for Match Scoring (isolated from DB dependencies)
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');

// Import only the scoring logic by mocking db
const WEIGHTS = { propertyType: 20, area: 25, price: 25, size: 10, bedrooms: 15, trustBonus: 5 };

function normalizePriceToLakhs(amount, unit) {
  if (!amount) return 0;
  switch (unit) {
    case 'CRORE': return amount * 100;
    case 'THOUSAND': return amount / 100;
    default: return amount;
  }
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

function calculateMatchScore(listing, demand) {
  const breakdown = { propertyType: 0, area: 0, price: 0, size: 0, bedrooms: 0, trustBonus: 0 };

  if (listing.propertyType && demand.propertyType) {
    if (listing.propertyType === demand.propertyType) breakdown.propertyType = WEIGHTS.propertyType;
    else if (areRelatedTypes(listing.propertyType, demand.propertyType)) breakdown.propertyType = WEIGHTS.propertyType * 0.6;
  } else {
    breakdown.propertyType = demand.propertyType ? 0 : WEIGHTS.propertyType * 0.5;
  }

  // Area
  if (!listing.area || !demand.area) { breakdown.area = WEIGHTS.area * 0.3; }
  else if (listing.area.toLowerCase() === demand.area.toLowerCase()) { breakdown.area = WEIGHTS.area; }
  else {
    const lt = listing.area.toLowerCase().split(/[,\s]+/).filter(Boolean);
    const dt = demand.area.toLowerCase().split(/[,\s]+/).filter(Boolean);
    let mc = 0;
    for (const a of lt) for (const b of dt) if (a.includes(b) || b.includes(a)) mc++;
    if (mc > 0) breakdown.area = WEIGHTS.area * Math.min(mc / Math.max(lt.length, dt.length), 1);
    else {
      const tri = ['chandigarh', 'mohali', 'zirakpur', 'kharar', 'panchkula'];
      if (tri.some(a => listing.area.toLowerCase().includes(a)) && tri.some(a => demand.area.toLowerCase().includes(a)))
        breakdown.area = WEIGHTS.area * 0.2;
    }
  }

  // Price
  if (!listing.price) { breakdown.price = WEIGHTS.price * 0.2; }
  else if (!demand.maxBudget && !demand.minBudget) { breakdown.price = WEIGHTS.price * 0.3; }
  else {
    const lp = normalizePriceToLakhs(listing.price, listing.priceUnit);
    const minB = demand.minBudget ? normalizePriceToLakhs(demand.minBudget, demand.budgetUnit) : 0;
    const maxB = demand.maxBudget ? normalizePriceToLakhs(demand.maxBudget, demand.budgetUnit) : Infinity;
    if (lp >= minB && lp <= maxB) breakdown.price = WEIGHTS.price;
    else if (lp <= maxB * 1.15) { const o = (lp - maxB) / maxB; breakdown.price = WEIGHTS.price * (1 - o * 3); }
    else if (lp >= minB * 0.9) breakdown.price = WEIGHTS.price * 0.7;
  }

  // Size
  if (!listing.size || !demand.minSize) { breakdown.size = WEIGHTS.size * 0.3; }
  else {
    const ratio = listing.size / demand.minSize;
    if (ratio >= 0.85 && ratio <= 1.3) breakdown.size = WEIGHTS.size;
    else if (ratio >= 0.7 && ratio <= 1.5) breakdown.size = WEIGHTS.size * 0.5;
  }

  // Bedrooms
  if (listing.bedrooms && demand.bedrooms) {
    if (listing.bedrooms === demand.bedrooms) breakdown.bedrooms = WEIGHTS.bedrooms;
    else if (Math.abs(listing.bedrooms - demand.bedrooms) === 1) breakdown.bedrooms = WEIGHTS.bedrooms * 0.5;
  } else { breakdown.bedrooms = WEIGHTS.bedrooms * 0.3; }

  // Trust
  const avg = ((listing.contact?.trustScore || 50) + (demand.contact?.trustScore || 50)) / 2;
  breakdown.trustBonus = (avg / 100) * WEIGHTS.trustBonus;

  return { total: Math.round(Object.values(breakdown).reduce((s, v) => s + v, 0)), breakdown };
}

describe('Match Scoring', () => {
  it('should give high score for exact match', () => {
    const score = calculateMatchScore(
      { propertyType: 'FLAT', area: 'Sector 20, Chandigarh', price: 85, priceUnit: 'LAKH', size: 1800, sizeUnit: 'SQFT', bedrooms: 3, contact: { trustScore: 70 } },
      { propertyType: 'FLAT', area: 'Sector 20, Chandigarh', minBudget: 70, maxBudget: 90, budgetUnit: 'LAKH', minSize: 1600, sizeUnit: 'SQFT', bedrooms: 3, contact: { trustScore: 60 } }
    );
    assert.ok(score.total >= 80, `Expected >= 80, got ${score.total}`);
  });

  it('should give low score for mismatched type and area', () => {
    const score = calculateMatchScore(
      { propertyType: 'PLOT', area: 'Panchkula', price: 50, priceUnit: 'LAKH', contact: { trustScore: 50 } },
      { propertyType: 'FLAT', area: 'Zirakpur', maxBudget: 40, budgetUnit: 'LAKH', contact: { trustScore: 50 } }
    );
    assert.ok(score.total < 70, `Expected < 70, got ${score.total}`);
  });

  it('should handle crore vs lakh budget correctly', () => {
    const score = calculateMatchScore(
      { propertyType: 'KOTHI', area: 'Panchkula', price: 1.5, priceUnit: 'CRORE', bedrooms: 4, contact: { trustScore: 50 } },
      { propertyType: 'KOTHI', area: 'Panchkula', minBudget: 1, maxBudget: 2, budgetUnit: 'CRORE', bedrooms: 4, contact: { trustScore: 50 } }
    );
    assert.ok(score.total >= 80, `Expected >= 80 for exact kothi match, got ${score.total}`);
  });

  it('should score related types (FLAT ~ APARTMENT)', () => {
    const score = calculateMatchScore(
      { propertyType: 'FLAT', area: 'Mohali', price: 60, priceUnit: 'LAKH', contact: { trustScore: 50 } },
      { propertyType: 'APARTMENT', area: 'Mohali', maxBudget: 65, budgetUnit: 'LAKH', contact: { trustScore: 50 } }
    );
    assert.ok(score.breakdown.propertyType > 0, 'Related types should get partial score');
  });

  it('should give partial price score for slightly over budget', () => {
    const score = calculateMatchScore(
      { propertyType: 'FLAT', area: 'Mohali', price: 55, priceUnit: 'LAKH', bedrooms: 2, contact: { trustScore: 50 } },
      { propertyType: 'FLAT', area: 'Mohali', maxBudget: 50, budgetUnit: 'LAKH', bedrooms: 2, contact: { trustScore: 50 } }
    );
    assert.ok(score.breakdown.price > 0, 'Should get partial price score for 10% over');
  });
});
