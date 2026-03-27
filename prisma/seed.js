/**
 * Database Seed Script
 * Creates sample data for testing the deal engine.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database with sample data...');

  // Create sample contacts
  const seller1 = await prisma.contact.create({
    data: {
      phone: '919876543210',
      name: 'Rajesh Kumar',
      type: 'SELLER',
      trustScore: 65,
      trustLevel: 'MEDIUM',
      totalPosts: 12,
      isBroker: true,
      city: 'chandigarh',
    },
  });

  const seller2 = await prisma.contact.create({
    data: {
      phone: '919876543211',
      name: 'Amit Properties',
      type: 'SELLER',
      trustScore: 80,
      trustLevel: 'TRUSTED',
      totalPosts: 45,
      dealsClosed: 3,
      isBroker: true,
      isVerified: true,
      city: 'mohali',
    },
  });

  const buyer1 = await prisma.contact.create({
    data: {
      phone: '919876543212',
      name: 'Priya Sharma',
      type: 'BUYER',
      trustScore: 55,
      trustLevel: 'MEDIUM',
      totalPosts: 5,
      city: 'zirakpur',
    },
  });

  const buyer2 = await prisma.contact.create({
    data: {
      phone: '919876543213',
      name: 'Vikram Singh',
      type: 'BUYER',
      trustScore: 40,
      trustLevel: 'LOW',
      totalPosts: 2,
      city: 'chandigarh',
    },
  });

  // Create sample listings
  await prisma.listing.create({
    data: {
      contactId: seller1.id,
      propertyType: 'FLAT',
      area: 'Sector 20, Chandigarh',
      size: 1800,
      sizeUnit: 'SQFT',
      bedrooms: 3,
      price: 85,
      priceUnit: 'LAKH',
      facing: 'park',
      amenities: ['parking', 'lift', 'modular kitchen'],
      description: '3 BHK flat for sale in Sector 20, well maintained, park facing',
      rawMessage: '3 BHK flat for sale in Sector 20 Chandigarh, 1800 sqft, price 85 lakh, park facing, with lift and parking',
    },
  });

  await prisma.listing.create({
    data: {
      contactId: seller2.id,
      propertyType: 'PLOT',
      area: 'Mohali, Phase 10',
      size: 200,
      sizeUnit: 'SQYD',
      price: 1.2,
      priceUnit: 'CRORE',
      description: 'Corner plot in Phase 10 Mohali, ideal location',
      rawMessage: 'Plot for sale 200 sq yards in Mohali Phase 10, 1.2 crore, corner',
    },
  });

  await prisma.listing.create({
    data: {
      contactId: seller1.id,
      propertyType: 'KOTHI',
      area: 'Sector 8, Panchkula',
      size: 10,
      sizeUnit: 'MARLA',
      price: 1.8,
      priceUnit: 'CRORE',
      bedrooms: 4,
      description: 'Independent kothi with garden, 10 marla',
      rawMessage: 'Kothi available Sector 8 Panchkula 10 marla, 1.8 cr',
    },
  });

  await prisma.listing.create({
    data: {
      contactId: seller2.id,
      propertyType: 'FLAT',
      area: 'Zirakpur, VIP Road',
      size: 1200,
      sizeUnit: 'SQFT',
      bedrooms: 2,
      price: 45,
      priceUnit: 'LAKH',
      amenities: ['parking', 'furnished'],
      description: '2 BHK fully furnished flat on VIP Road',
      rawMessage: '2 BHK flat for sale VIP Road Zirakpur 1200 sqft 45 lakh furnished',
    },
  });

  // Create sample demands
  await prisma.demand.create({
    data: {
      contactId: buyer1.id,
      propertyType: 'FLAT',
      area: 'Zirakpur',
      minBudget: 40,
      maxBudget: 50,
      budgetUnit: 'LAKH',
      bedrooms: 2,
      preferences: ['parking'],
      description: 'Looking for 2 BHK in Zirakpur within 50 lakh',
      rawMessage: 'Looking for 2 BHK in Zirakpur, budget 40-50 lakh, need parking',
    },
  });

  await prisma.demand.create({
    data: {
      contactId: buyer2.id,
      propertyType: 'FLAT',
      area: 'Sector 20, Chandigarh',
      minBudget: 70,
      maxBudget: 90,
      budgetUnit: 'LAKH',
      bedrooms: 3,
      minSize: 1600,
      sizeUnit: 'SQFT',
      preferences: ['parking', 'lift'],
      description: 'Need 3 BHK in Sector 20 Chandigarh',
      rawMessage: 'Want to buy 3 BHK flat Sector 20 Chandigarh 70-90 lakh min 1600 sqft',
    },
  });

  // Create sample WhatsApp groups
  await prisma.whatsAppGroup.createMany({
    data: [
      { groupId: 'group1@g.us', name: 'Chandigarh Properties Buy/Sell', category: 'buyer-seller', memberCount: 256 },
      { groupId: 'group2@g.us', name: 'Mohali Real Estate Brokers', category: 'broker', memberCount: 180 },
      { groupId: 'group3@g.us', name: 'Zirakpur Flats & Plots', category: 'area-specific', memberCount: 320 },
      { groupId: 'group4@g.us', name: 'Tricity Property Deals', category: 'buyer-seller', memberCount: 450 },
    ],
  });

  console.log('Seed complete!');
  console.log('Created: 4 contacts, 4 listings, 2 demands, 4 groups');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
