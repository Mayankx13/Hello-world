require('dotenv').config();

module.exports = {
  db: {
    url: process.env.DATABASE_URL,
  },
  whatsapp: {
    businessPhoneId: process.env.WHATSAPP_BUSINESS_PHONE_ID,
    businessToken: process.env.WHATSAPP_BUSINESS_TOKEN,
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN,
  },
  owner: {
    phone: process.env.OWNER_PHONE || '+917719784712',
  },
  matching: {
    threshold: parseInt(process.env.MATCH_THRESHOLD || '70', 10),
  },
  dashboard: {
    port: parseInt(process.env.DASHBOARD_PORT || '3000', 10),
    password: process.env.DASHBOARD_PASSWORD || 'changeme123',
  },
  city: {
    name: process.env.TARGET_CITY || 'chandigarh-tricity',
    areas: (process.env.TARGET_AREAS || 'chandigarh,zirakpur,mohali,kharar,new-chandigarh,panchkula').split(','),
  },
  logLevel: process.env.LOG_LEVEL || 'info',
};
