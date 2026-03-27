# 🏠 Deal Engine - Complete Setup Guide

## Quick Overview

This system:
1. **Reads** WhatsApp group messages (via Baileys on secondary number)
2. **Parses** real estate buy/sell messages using NLP
3. **Matches** buyers with sellers (>70% match threshold)
4. **Notifies** you on WhatsApp when a match is found
5. **Auto-messages** both parties when you approve
6. **Tracks** trust scores and manages a CRM

---

## Pre-Setup Checklist

- [ ] Buy a secondary SIM card (₹100-200) — for WhatsApp Baileys group reading
- [ ] Register WhatsApp on secondary SIM
- [ ] Get added to 15-20 real estate WhatsApp groups (see Group Discovery section below)
- [ ] Create a DigitalOcean account (get $200 free credit: https://m.do.co/c/free)

---

## Option A: DigitalOcean Deployment (Recommended)

### Monthly Cost: ~₹5,000-8,000 (≈$60-95)

| Service | Spec | Cost |
|---------|------|------|
| Droplet (VM) | 2 vCPU, 2GB RAM, BLR1 | ~₹2,100/mo ($25) |
| Swap space | 2GB (free, on disk) | ₹0 |
| **Total** | | **~₹2,100/mo** |

Single droplet with Docker Compose (Postgres on same server) is all you need.

### Step 1: Create Droplet

```bash
# 1. Log in to DigitalOcean → Create Droplet
# 2. Choose: Ubuntu 22.04, Basic, 2 vCPU / 2GB RAM ($25/mo)
# 3. Choose region: Bangalore (BLR1) - closest to you
# 4. Add SSH key or use password
# 5. Create
```

### Step 2: Server Setup

```bash
# SSH into your server
ssh root@YOUR_SERVER_IP

# Add 2GB swap (important for 2GB RAM droplet)
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab

# Install Docker
curl -fsSL https://get.docker.com | sh

# Install Docker Compose
apt install -y docker-compose

# Clone the repo
git clone https://github.com/mayankx13/hello-world.git /opt/deal-engine
cd /opt/deal-engine

# Switch to our branch
git checkout claude/whatsapp-real-estate-deals-TiX7F

# Create .env file
cp .env.example .env
nano .env  # Edit with your values

# Start everything
docker-compose up -d

# Check logs
docker-compose logs -f app
```

### Step 3: Scan WhatsApp QR Code

```bash
# Watch the app logs for QR code
docker-compose logs -f app

# You'll see a QR code in terminal
# Scan it with your SECONDARY WhatsApp number
# Go to WhatsApp > Linked Devices > Link a Device
```

### Step 4: Access Dashboard

Open `http://YOUR_SERVER_IP:3000` in your browser.

---

## Option B: Railway Deployment (Easiest)

### Monthly Cost: ~₹3,000-5,000

```bash
# 1. Go to railway.app, sign up
# 2. New Project → Deploy from GitHub repo
# 3. Add PostgreSQL service
# 4. Set environment variables in Railway dashboard
# 5. Deploy
```

Note: Railway doesn't support QR code scanning easily. You'll need to:
1. Run Baileys locally first to authenticate
2. Upload the `auth_info_baileys/` folder to Railway

---

## WhatsApp Business API Setup (for sending messages)

This takes 2-7 days for Meta approval. Start NOW.

### Step 1: Create Facebook Business

1. Go to https://business.facebook.com
2. Create a Business Account
3. Verify your business (use your name as sole proprietor)

### Step 2: Set Up WhatsApp Business API

1. Go to https://developers.facebook.com
2. Create App → Business → WhatsApp
3. Add WhatsApp product to your app
4. Go to WhatsApp > Getting Started
5. Note your:
   - **Phone Number ID**: Put in `WHATSAPP_BUSINESS_PHONE_ID`
   - **Access Token**: Put in `WHATSAPP_BUSINESS_TOKEN`
6. Register your phone number (+91 7719784712)
7. Verify with OTP

### Step 3: Update .env

```
WHATSAPP_BUSINESS_PHONE_ID=your_phone_id
WHATSAPP_BUSINESS_TOKEN=your_token
```

Until Business API is approved, the system will **log messages** instead of sending them, so you can still test everything.

---

## Group Discovery - Chandigarh Tricity

### How to Join Real Estate WhatsApp Groups

1. **Ask existing brokers**: When you buy/sell, ask the broker to add you to their groups
2. **Google "Chandigarh real estate WhatsApp group link"**: Many are publicly shared
3. **Facebook Groups**: Search for these FB groups, members often share WA group links:
   - "Chandigarh Property Buy Sell"
   - "Mohali Real Estate"
   - "Zirakpur Properties"
   - "Tricity Property Deals"
   - "Panchkula Property Market"
4. **OLX/MagicBricks/99acres**: Contact listed agents and ask to join their groups
5. **Property expos**: Attend local property expos in Chandigarh — great for networking
6. **Instagram**: Search #chandigarhproperty, #mohalirealestate — DM active brokers

### Target Groups to Join (15-20 minimum):

- [ ] 3-4 Chandigarh city property groups
- [ ] 3-4 Mohali/Kharar property groups
- [ ] 3-4 Zirakpur property groups
- [ ] 2-3 Panchkula property groups
- [ ] 2-3 New Chandigarh/Mullanpur groups
- [ ] 2-3 Broker-only groups (premium leads)

### Key Brokers/Agents to Follow

Search on 99acres, MagicBricks, and Housing.com for top-rated agents in:
- Chandigarh Sector 17-35
- Mohali Phase 1-11
- Zirakpur VIP Road / Patiala Road
- Kharar / Sunny Enclave
- New Chandigarh / Mullanpur
- Panchkula Sector 1-15

---

## Testing the System

### Run Parser Tests
```bash
npm test
```

### Manual Test: Simulate a Message
```bash
# Use the API to manually create a listing
curl -X POST http://localhost:3000/api/listings -H "Content-Type: application/json" -d '{
  "contactId": "test",
  "propertyType": "FLAT",
  "area": "Sector 20, Chandigarh",
  "price": 85,
  "priceUnit": "LAKH",
  "bedrooms": 3,
  "rawMessage": "3 BHK flat sector 20 chandigarh 85 lakh"
}'
```

### Seed Sample Data
```bash
npm run db:seed
```

### View Database
```bash
npm run db:studio
```

---

## Go-Live Checklist (April 1st)

- [ ] Server running on DigitalOcean
- [ ] Secondary WhatsApp QR scanned and connected
- [ ] Joined 15+ real estate groups on secondary number
- [ ] WhatsApp Business API approved (or using simulation mode)
- [ ] Dashboard accessible at your server IP
- [ ] Tested with sample messages
- [ ] Daily cron jobs verified (matching at 8 AM, 6 PM; summary at 9 PM)
- [ ] .env configured with real values
- [ ] Monitoring: Set up UptimeRobot (free) to ping your dashboard
