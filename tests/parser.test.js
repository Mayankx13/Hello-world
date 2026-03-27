/**
 * Tests for Real Estate Message Parser
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');
const { parseRealEstateMessage } = require('../src/parser/real-estate-nlp');

describe('parseRealEstateMessage', () => {
  it('should parse a standard sell message', () => {
    const msg = '3 BHK flat for sale in Sector 20 Chandigarh, 1800 sqft, price 85 lakh, park facing, with lift and parking';
    const result = parseRealEstateMessage(msg);

    assert.strictEqual(result.isRealEstate, true);
    assert.strictEqual(result.dealType, 'SELL');
    assert.strictEqual(result.propertyType, 'FLAT');
    assert.strictEqual(result.bedrooms, 3);
    assert.strictEqual(result.price.amount, 85);
    assert.strictEqual(result.price.unit, 'LAKH');
    assert.strictEqual(result.size.value, 1800);
    assert.strictEqual(result.size.unit, 'SQFT');
    assert.ok(result.area.includes('Sector 20'));
    assert.ok(result.amenities.includes('parking'));
    assert.ok(result.amenities.includes('lift'));
    assert.strictEqual(result.facing, 'park');
    assert.ok(result.confidence >= 70);
  });

  it('should parse a buy/demand message', () => {
    const msg = 'Looking for 2 BHK in Zirakpur, budget 40-50 lakh, need parking';
    const result = parseRealEstateMessage(msg);

    assert.strictEqual(result.isRealEstate, true);
    assert.strictEqual(result.dealType, 'BUY');
    assert.strictEqual(result.bedrooms, 2);
    assert.strictEqual(result.price.min, 40);
    assert.strictEqual(result.price.max, 50);
    assert.ok(result.area.toLowerCase().includes('zirakpur'));
  });

  it('should parse a plot sale message', () => {
    const msg = 'Plot for sale 200 sq yards in Mohali Phase 10, 1.2 crore';
    const result = parseRealEstateMessage(msg);

    assert.strictEqual(result.isRealEstate, true);
    assert.strictEqual(result.dealType, 'SELL');
    assert.strictEqual(result.propertyType, 'PLOT');
    assert.strictEqual(result.size.value, 200);
    assert.strictEqual(result.size.unit, 'SQYD');
    assert.strictEqual(result.price.amount, 1.2);
    assert.strictEqual(result.price.unit, 'CRORE');
  });

  it('should parse a kothi sale', () => {
    const msg = 'Kothi available Sector 8 Panchkula 10 marla, 1.8 cr, ground + 1st floor';
    const result = parseRealEstateMessage(msg);

    assert.strictEqual(result.isRealEstate, true);
    assert.strictEqual(result.propertyType, 'KOTHI');
    assert.strictEqual(result.size.value, 10);
    assert.strictEqual(result.size.unit, 'MARLA');
    assert.ok(result.area.toLowerCase().includes('panchkula'));
  });

  it('should parse commercial SCO', () => {
    const msg = 'SCO for sale in Aerocity Mohali, 90 sq yards, 2.5 crore';
    const result = parseRealEstateMessage(msg);

    assert.strictEqual(result.propertyType, 'SCO');
    assert.strictEqual(result.price.amount, 2.5);
    assert.strictEqual(result.price.unit, 'CRORE');
    assert.ok(result.area.toLowerCase().includes('aerocity'));
  });

  it('should reject non-real-estate messages', () => {
    const msg = 'Good morning everyone! Have a great day!';
    const result = parseRealEstateMessage(msg);

    assert.strictEqual(result.isRealEstate, false);
    assert.ok(result.confidence < 30);
  });

  it('should handle Hindi-English mixed messages', () => {
    const msg = '3 BHK flat bechna hai Zirakpur mein, 65 lakh, furnished';
    const result = parseRealEstateMessage(msg);

    assert.strictEqual(result.isRealEstate, true);
    assert.strictEqual(result.dealType, 'SELL');
    assert.strictEqual(result.bedrooms, 3);
    assert.ok(result.area.toLowerCase().includes('zirakpur'));
  });

  it('should detect buyer intent with budget range', () => {
    const msg = 'Genuine buyer need 4 BHK villa in New Chandigarh budget 1.5-2 crore';
    const result = parseRealEstateMessage(msg);

    assert.strictEqual(result.dealType, 'BUY');
    assert.strictEqual(result.propertyType, 'VILLA');
    assert.strictEqual(result.bedrooms, 4);
    assert.strictEqual(result.price.min, 1.5);
    assert.strictEqual(result.price.max, 2);
    assert.strictEqual(result.price.unit, 'CRORE');
  });

  it('should detect Kharar/Sunny Enclave area', () => {
    const msg = 'Plot for sale Sunny Enclave Kharar 150 sq yards 30 lakh';
    const result = parseRealEstateMessage(msg);

    assert.ok(result.area.toLowerCase().includes('kharar'));
  });
});

describe('Match Scoring', () => {
  const { calculateMatchScore } = require('../src/matcher/match-engine');

  it('should give high score for exact property + area + price match', () => {
    const listing = {
      propertyType: 'FLAT',
      area: 'Sector 20, Chandigarh',
      price: 85,
      priceUnit: 'LAKH',
      size: 1800,
      sizeUnit: 'SQFT',
      bedrooms: 3,
      contact: { trustScore: 70 },
    };

    const demand = {
      propertyType: 'FLAT',
      area: 'Sector 20, Chandigarh',
      minBudget: 70,
      maxBudget: 90,
      budgetUnit: 'LAKH',
      minSize: 1600,
      sizeUnit: 'SQFT',
      bedrooms: 3,
      contact: { trustScore: 60 },
    };

    const score = calculateMatchScore(listing, demand);
    assert.ok(score.total >= 80, `Expected score >= 80, got ${score.total}`);
  });

  it('should give low score for mismatched property type and area', () => {
    const listing = {
      propertyType: 'PLOT',
      area: 'Panchkula',
      price: 50,
      priceUnit: 'LAKH',
      contact: { trustScore: 50 },
    };

    const demand = {
      propertyType: 'FLAT',
      area: 'Zirakpur',
      maxBudget: 40,
      budgetUnit: 'LAKH',
      contact: { trustScore: 50 },
    };

    const score = calculateMatchScore(listing, demand);
    assert.ok(score.total < 70, `Expected score < 70, got ${score.total}`);
  });

  it('should give partial score when price is slightly over budget', () => {
    const listing = {
      propertyType: 'FLAT',
      area: 'Mohali',
      price: 55,
      priceUnit: 'LAKH',
      bedrooms: 2,
      contact: { trustScore: 50 },
    };

    const demand = {
      propertyType: 'FLAT',
      area: 'Mohali',
      maxBudget: 50,
      budgetUnit: 'LAKH',
      bedrooms: 2,
      contact: { trustScore: 50 },
    };

    const score = calculateMatchScore(listing, demand);
    // Should still score decently since only 10% over budget
    assert.ok(score.total >= 50, `Expected score >= 50, got ${score.total}`);
  });
});
