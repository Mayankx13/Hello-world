/**
 * CRM API Routes
 * REST API for managing contacts, listings, demands, matches.
 */

const express = require('express');
const prisma = require('../utils/db');
const { flagContact, manuallyTrust, verifyByBroker } = require('../trust/trust-engine');
const { connectParties } = require('../notifications/notification-handler');

const router = express.Router();

// ==========================================
// CONTACTS / CRM
// ==========================================

// List all contacts with filters
router.get('/contacts', async (req, res) => {
  const { type, trustLevel, search, page = 1, limit = 50 } = req.query;
  const where = {};

  if (type) where.type = type;
  if (trustLevel) where.trustLevel = trustLevel;
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search } },
    ];
  }

  const [contacts, total] = await Promise.all([
    prisma.contact.findMany({
      where,
      orderBy: { lastSeen: 'desc' },
      skip: (page - 1) * limit,
      take: parseInt(limit),
    }),
    prisma.contact.count({ where }),
  ]);

  res.json({ contacts, total, page: parseInt(page), limit: parseInt(limit) });
});

// Get single contact with history
router.get('/contacts/:id', async (req, res) => {
  const contact = await prisma.contact.findUnique({
    where: { id: req.params.id },
    include: {
      listings: { orderBy: { createdAt: 'desc' }, take: 20 },
      demands: { orderBy: { createdAt: 'desc' }, take: 20 },
      messages: { orderBy: { createdAt: 'desc' }, take: 50 },
      trustEvents: { orderBy: { createdAt: 'desc' }, take: 20 },
    },
  });

  if (!contact) return res.status(404).json({ error: 'Contact not found' });
  res.json(contact);
});

// Update contact
router.patch('/contacts/:id', async (req, res) => {
  const { name, type, isBroker, notes } = req.body;
  const contact = await prisma.contact.update({
    where: { id: req.params.id },
    data: { name, type, isBroker, notes },
  });
  res.json(contact);
});

// Flag contact
router.post('/contacts/:id/flag', async (req, res) => {
  await flagContact(req.params.id, req.body.reason);
  res.json({ success: true });
});

// Trust contact
router.post('/contacts/:id/trust', async (req, res) => {
  await manuallyTrust(req.params.id, req.body.reason);
  res.json({ success: true });
});

// Verify via broker
router.post('/contacts/:id/verify', async (req, res) => {
  await verifyByBroker(req.params.id, req.body.brokerId);
  res.json({ success: true });
});

// ==========================================
// LISTINGS (SELL)
// ==========================================

router.get('/listings', async (req, res) => {
  const { status = 'ACTIVE', propertyType, area, page = 1, limit = 50 } = req.query;
  const where = {};

  if (status) where.status = status;
  if (propertyType) where.propertyType = propertyType;
  if (area) where.area = { contains: area, mode: 'insensitive' };

  const [listings, total] = await Promise.all([
    prisma.listing.findMany({
      where,
      include: { contact: { select: { name: true, phone: true, trustLevel: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: parseInt(limit),
    }),
    prisma.listing.count({ where }),
  ]);

  res.json({ listings, total, page: parseInt(page), limit: parseInt(limit) });
});

router.patch('/listings/:id', async (req, res) => {
  const { status, isVerified, price } = req.body;
  const listing = await prisma.listing.update({
    where: { id: req.params.id },
    data: { status, isVerified, price },
  });
  res.json(listing);
});

// ==========================================
// DEMANDS (BUY)
// ==========================================

router.get('/demands', async (req, res) => {
  const { status = 'ACTIVE', propertyType, area, page = 1, limit = 50 } = req.query;
  const where = {};

  if (status) where.status = status;
  if (propertyType) where.propertyType = propertyType;
  if (area) where.area = { contains: area, mode: 'insensitive' };

  const [demands, total] = await Promise.all([
    prisma.demand.findMany({
      where,
      include: { contact: { select: { name: true, phone: true, trustLevel: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: parseInt(limit),
    }),
    prisma.demand.count({ where }),
  ]);

  res.json({ demands, total, page: parseInt(page), limit: parseInt(limit) });
});

// ==========================================
// MATCHES
// ==========================================

router.get('/matches', async (req, res) => {
  const { status, minScore, page = 1, limit = 50 } = req.query;
  const where = {};

  if (status) where.status = status;
  if (minScore) where.score = { gte: parseFloat(minScore) };

  const [matches, total] = await Promise.all([
    prisma.match.findMany({
      where,
      include: {
        listing: { select: { propertyType: true, area: true, price: true, priceUnit: true } },
        demand: { select: { propertyType: true, area: true, maxBudget: true, budgetUnit: true } },
        buyer: { select: { name: true, phone: true, trustLevel: true } },
        seller: { select: { name: true, phone: true, trustLevel: true } },
      },
      orderBy: { score: 'desc' },
      skip: (page - 1) * limit,
      take: parseInt(limit),
    }),
    prisma.match.count({ where }),
  ]);

  res.json({ matches, total, page: parseInt(page), limit: parseInt(limit) });
});

router.post('/matches/:id/connect', async (req, res) => {
  const result = await connectParties(req.params.id);
  res.json(result);
});

router.patch('/matches/:id', async (req, res) => {
  const { status, commission, notes } = req.body;
  const match = await prisma.match.update({
    where: { id: req.params.id },
    data: { status, commission, notes },
  });
  res.json(match);
});

// ==========================================
// DASHBOARD STATS
// ==========================================

router.get('/stats', async (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [
    totalContacts, totalListings, totalDemands, totalMatches,
    activeListings, activeDemands, activeMatches,
    closedDeals, todayListings, todayDemands, todayMatches,
    trustedContacts, flaggedContacts, groups,
  ] = await Promise.all([
    prisma.contact.count(),
    prisma.listing.count(),
    prisma.demand.count(),
    prisma.match.count(),
    prisma.listing.count({ where: { status: 'ACTIVE' } }),
    prisma.demand.count({ where: { status: 'ACTIVE' } }),
    prisma.match.count({ where: { status: { in: ['NEW', 'NOTIFIED', 'CONTACTED', 'IN_PROGRESS'] } } }),
    prisma.match.count({ where: { status: 'DEAL_CLOSED' } }),
    prisma.listing.count({ where: { createdAt: { gte: today } } }),
    prisma.demand.count({ where: { createdAt: { gte: today } } }),
    prisma.match.count({ where: { createdAt: { gte: today } } }),
    prisma.contact.count({ where: { trustLevel: 'TRUSTED' } }),
    prisma.contact.count({ where: { trustLevel: 'FLAGGED' } }),
    prisma.whatsAppGroup.count({ where: { isActive: true } }),
  ]);

  res.json({
    total: { contacts: totalContacts, listings: totalListings, demands: totalDemands, matches: totalMatches },
    active: { listings: activeListings, demands: activeDemands, matches: activeMatches },
    today: { listings: todayListings, demands: todayDemands, matches: todayMatches },
    trust: { trusted: trustedContacts, flagged: flaggedContacts },
    closedDeals,
    groups,
  });
});

// ==========================================
// WHATSAPP GROUPS
// ==========================================

router.get('/groups', async (req, res) => {
  const groups = await prisma.whatsAppGroup.findMany({
    orderBy: { lastMessage: 'desc' },
  });
  res.json(groups);
});

module.exports = router;
